import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { createSquareClient, squareLocationId } from "@/lib/server/squareClient";
import { priceCartItem, type CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";
import { taxProvider } from "@/lib/checkout/taxProvider";
import { shippingProvider } from "@/lib/checkout/shippingProvider";
import { generateOrderReference } from "@/lib/checkout/generateOrderReference";
import { humanPaymentError } from "@/lib/checkout/errorMessages";
import { markOrderPaidAndNotify } from "@/lib/checkout/fulfillOrder";
import { SquareError } from "square";

interface DeliveryAddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface PayRequestBody {
  items: CheckoutCartItemInput[];
  contact: { fullName: string; email: string; phone: string };
  shippingAddress: DeliveryAddressInput;
  sourceId: string;
  sourceType: "CARD" | "APPLE_PAY" | "GOOGLE_PAY";
  idempotencyKey: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * The one place money actually moves. Recomputes the full total server-side (never trusts the
 * client), creates/reuses an internal MapleOrder BEFORE calling Square, and only ever marks it
 * PAID from a confirmed Square payment status — never from "the request returned 200."
 */
export async function POST(request: Request) {
  let body: PayRequestBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) return badRequest("Your cart is empty.");
  if (!body.contact?.fullName || !body.contact?.email || !body.contact?.phone) {
    return badRequest("Missing contact information.");
  }
  const addr = body.shippingAddress;
  if (!addr?.addressLine1 || !addr?.city || !addr?.province || !addr?.postalCode || !addr?.country) {
    return badRequest("Missing delivery address.");
  }
  if (!body.sourceId || !body.idempotencyKey || !body.sourceType) {
    return badRequest("Missing payment information.");
  }

  const supabaseAdmin = createAdminClient();

  // Authoritative recompute — identical logic to /api/checkout/quote, run again here rather than
  // trusting any total the browser sent, per the non-negotiable "server calculates the charge".
  const priced = await Promise.all(body.items.map((item) => priceCartItem(item, supabaseAdmin)));
  const unresolved = priced.filter((r) => !r.ok) as Extract<(typeof priced)[number], { ok: false }>[];
  if (unresolved.length > 0) {
    return NextResponse.json(
      { error: "Some items in your cart can't be checked out.", unresolvedItems: unresolved },
      { status: 422 },
    );
  }
  const lines = priced.filter((r): r is Extract<(typeof priced)[number], { ok: true }> => r.ok).map((r) => r.line);
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingOptions = await shippingProvider.getOptions(addr);
  const shippingOption = shippingOptions[0] ?? { id: "free", label: "Free Shipping", cents: 0 };
  const { taxCents } = await taxProvider.calculate({ subtotalCents, shippingAddress: addr });
  const totalCents = subtotalCents + shippingOption.cents + taxCents;

  // Idempotency: if this exact attempt was already submitted (retry after a lost response,
  // accidental double-click with the same key), reuse the existing order/attempt rather than
  // creating a second one or double-charging.
  const { data: existingAttempt, error: existingAttemptError } = await supabaseAdmin
    .from("PaymentAttempt")
    .select("id, orderId, status, squarePaymentId")
    .eq("idempotencyKey", body.idempotencyKey)
    .maybeSingle();
  if (existingAttemptError) {
    console.error("[checkout] idempotency lookup failed:", existingAttemptError);
    return NextResponse.json({ error: "Couldn't process your payment. Please try again." }, { status: 502 });
  }

  let orderId: string;
  let orderReference: string;

  if (existingAttempt) {
    orderId = existingAttempt.orderId;
    const { data: existingOrder } = await supabaseAdmin
      .from("MapleOrder")
      .select("reference, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!existingOrder) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    orderReference = existingOrder.reference;

    if (existingAttempt.status === "SUCCEEDED" || existingOrder.status === "PAID") {
      return NextResponse.json({ ok: true, orderReference });
    }
    // status === "CREATED" (a prior attempt with this key started but never resolved) falls
    // through to re-call Square below with the SAME idempotencyKey — Square's own idempotency
    // guarantee makes that safe to repeat.
  } else {
    orderReference = generateOrderReference();
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from("MapleOrder")
      .insert({
        reference: orderReference,
        status: "PENDING_PAYMENT",
        contactName: body.contact.fullName,
        contactEmail: body.contact.email,
        contactPhone: body.contact.phone,
        shippingAddress: addr,
        subtotalCents,
        taxCents,
        shippingCents: shippingOption.cents,
        totalCents,
        currency: "CAD",
        squareLocationId: squareLocationId(),
      })
      .select("id")
      .single();
    if (orderError || !newOrder) {
      console.error("[checkout] order creation failed:", orderError);
      return NextResponse.json({ error: "Couldn't start your order. Please try again." }, { status: 502 });
    }
    orderId = newOrder.id;

    const { error: linesError } = await supabaseAdmin.from("MapleOrderLine").insert(
      lines.map((l) => ({
        orderId,
        cartItemId: l.cartItemId,
        productName: l.productName,
        categorySlug: l.categorySlug,
        colourName: l.colourName,
        sizeBreakdown: l.sizeBreakdown,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        customizationType: l.customizationType,
        designProjectId: l.designProjectId,
        designFrozenRevision: l.designFrozenRevision,
        designSnapshot: l.designSnapshot,
      })),
    );
    if (linesError) {
      console.error("[checkout] order line creation failed:", linesError);
      return NextResponse.json({ error: "Couldn't start your order. Please try again." }, { status: 502 });
    }

    const { error: attemptError } = await supabaseAdmin.from("PaymentAttempt").insert({
      orderId,
      idempotencyKey: body.idempotencyKey,
      status: "CREATED",
      sourceType: body.sourceType,
    });
    if (attemptError) {
      console.error("[checkout] payment attempt creation failed:", attemptError);
      return NextResponse.json({ error: "Couldn't process your payment. Please try again." }, { status: 502 });
    }
  }

  const square = createSquareClient();
  const locationId = squareLocationId();

  try {
    const orderResponse = await square.orders.create({
      order: {
        locationId,
        referenceId: orderReference,
        lineItems: lines.map((l) => ({
          name: l.productName,
          quantity: String(l.quantity),
          basePriceMoney: { amount: BigInt(l.unitPriceCents), currency: "CAD" },
        })),
        fulfillments: [
          {
            type: "SHIPMENT",
            shipmentDetails: {
              recipient: {
                displayName: body.contact.fullName,
                phoneNumber: body.contact.phone,
                emailAddress: body.contact.email,
                address: {
                  addressLine1: addr.addressLine1,
                  addressLine2: addr.addressLine2 || undefined,
                  locality: addr.city,
                  administrativeDistrictLevel1: addr.province,
                  postalCode: addr.postalCode,
                  country: addr.country as never,
                },
              },
            },
          },
        ],
        // Short, non-sensitive references only — never PII or design JSON in Square metadata.
        metadata: { mapleOrderReference: orderReference },
      },
      idempotencyKey: `order-${body.idempotencyKey}`,
    });

    const squareOrderId = orderResponse.order?.id;
    if (!squareOrderId) {
      throw new Error("Square order creation returned no order id.");
    }
    // Persisted before the payment call (not just on success) so a webhook that arrives before
    // this request finishes can still find this MapleOrder via squareOrderId.
    await supabaseAdmin.from("MapleOrder").update({ squareOrderId }).eq("id", orderId);

    const paymentResponse = await square.payments.create({
      sourceId: body.sourceId,
      idempotencyKey: body.idempotencyKey,
      amountMoney: { amount: BigInt(totalCents), currency: "CAD" },
      orderId: squareOrderId,
      locationId,
      buyerEmailAddress: body.contact.email,
    });

    const payment = paymentResponse.payment;
    if (!payment || paymentResponse.errors?.length) {
      const reason = humanPaymentError(paymentResponse.errors?.[0]?.code);
      await supabaseAdmin
        .from("PaymentAttempt")
        .update({ status: "FAILED", failureReason: reason, rawResponse: paymentResponse as unknown as object })
        .eq("idempotencyKey", body.idempotencyKey);
      return NextResponse.json({ error: reason }, { status: 402 });
    }

    if (payment.status !== "COMPLETED" || !payment.id) {
      const reason = "Your payment is still processing. We'll confirm it shortly — please check back.";
      await supabaseAdmin
        .from("PaymentAttempt")
        .update({ status: "FAILED", failureReason: reason, squarePaymentId: payment.id ?? null, rawResponse: paymentResponse as unknown as object })
        .eq("idempotencyKey", body.idempotencyKey);
      return NextResponse.json({ error: reason }, { status: 202 });
    }

    await markOrderPaidAndNotify(supabaseAdmin, { orderId, squareOrderId, squarePaymentId: payment.id });

    await supabaseAdmin
      .from("PaymentAttempt")
      .update({ status: "SUCCEEDED", squarePaymentId: payment.id, rawResponse: paymentResponse as unknown as object })
      .eq("idempotencyKey", body.idempotencyKey);

    return NextResponse.json({ ok: true, orderReference });
  } catch (err) {
    // Square's SDK throws (rather than returning an inline `errors` array) for most payment
    // declines — a SquareError here is usually a legitimate customer-facing decline (map to 402),
    // not a real server/gateway failure (502), which is what a raw try/catch status would imply.
    const isDeclineLike = err instanceof SquareError;
    const reason = isDeclineLike ? humanPaymentError(err.errors?.[0]?.code) : "Your payment didn't go through. Please try again.";
    console.error("[checkout] Square call failed:", err);
    await supabaseAdmin
      .from("PaymentAttempt")
      .update({ status: "FAILED", failureReason: reason })
      .eq("idempotencyKey", body.idempotencyKey);
    return NextResponse.json({ error: reason }, { status: isDeclineLike ? 402 : 502 });
  }
}
