import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { createSquareClient, squareLocationId } from "@/lib/server/squareClient";
import { priceCartItem, type CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";
import { taxProvider } from "@/lib/checkout/taxProvider";
import { shippingProvider } from "@/lib/checkout/shippingProvider";
import { associateShippingQuoteWithOrder } from "@/lib/checkout/chitChatsOrderQuoteAssociation";
import { ShippingRateUnavailableError, OTTAWA_PICKUP_OPTION } from "@/lib/checkout/canadaPostShippingProvider";
import { generateOrderReference } from "@/lib/checkout/generateOrderReference";
import { humanPaymentError } from "@/lib/checkout/errorMessages";
import { markOrderPaidAndNotify } from "@/lib/checkout/fulfillOrder";
import { validatePostalCode } from "@/lib/checkout/validation";
import { PICKUP_LOCATION } from "@/lib/checkout/pickupLocation";
import { decideCheckoutAttemptAction, type ExistingOrderForAttempt } from "@/lib/checkout/checkoutAttemptState";
import { SquareError } from "square";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** Required for "delivery", absent/ignored for "pickup" -- a pickup customer is never asked to
   *  type a delivery address at all (see CheckoutClient.tsx's fulfillment selector). */
  shippingAddress?: DeliveryAddressInput;
  sourceId: string;
  sourceType: "CARD" | "APPLE_PAY" | "GOOGLE_PAY";
  idempotencyKey: string;
  /** Stable for one checkout session, NEVER regenerated on retry (unlike idempotencyKey above) --
   *  see docs/payment-idempotency-design.md. Optional for backward compatibility with any caller
   *  that doesn't send it; omitting it just means this request gets today's per-idempotencyKey
   *  behavior only, with no durable attempt tracking across a client-regenerated key. */
  checkoutAttemptId?: string;
  /** Defaults to "delivery" -- existing callers that don't send this field are unaffected.
   *  "pickup" means Ottawa local pickup: $0 shipping, Ontario's point-of-sale HST rate regardless
   *  of any address, a Square PICKUP fulfillment (not SHIPMENT), and no delivery address required. */
  fulfillmentMethod?: "delivery" | "pickup";
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
  const isPickup = body.fulfillmentMethod === "pickup";
  const addr = body.shippingAddress;
  // A pickup order is never required to supply a delivery address -- it isn't being shipped
  // anywhere, it's collected in person at PICKUP_LOCATION (see below).
  if (!isPickup) {
    if (!addr?.addressLine1 || !addr?.city || !addr?.province || !addr?.postalCode || !addr?.country) {
      return badRequest("Missing delivery address.");
    }
    // Client-side validation (CheckoutForm) already checks this format, but that's bypassable by
    // calling this endpoint directly — the authoritative payment path must not trust it unverified.
    const postalCodeError = validatePostalCode(addr.postalCode, addr.country);
    if (postalCodeError) return badRequest(postalCodeError);
  }
  if (!body.sourceId || !body.idempotencyKey || !body.sourceType) {
    return badRequest("Missing payment information.");
  }

  const supabaseAdmin = createAdminClient();

  // Durable attempt tracking (docs/payment-idempotency-design.md): resolved BEFORE any pricing/
  // shipping/Square work, on the stable checkoutAttemptId -- unlike idempotencyKey (regenerated
  // by the client on every failed attempt), this identifies the whole checkout session across
  // retries. Closes the lost-response double-charge window: if a prior attempt for this exact
  // session already succeeded, this returns success immediately and never calls Square again,
  // regardless of what idempotencyKey this particular retry carries.
  let existingOrderForAttempt: ExistingOrderForAttempt | null = null;
  if (body.checkoutAttemptId) {
    const { data, error: attemptLookupError } = await supabaseAdmin
      .from("MapleOrder")
      .select("id, reference, status, squareOrderId")
      .eq("checkoutAttemptId", body.checkoutAttemptId)
      .maybeSingle();
    if (attemptLookupError) {
      console.error("[checkout] checkoutAttemptId lookup failed:", attemptLookupError);
      return NextResponse.json({ error: "Couldn't process your payment. Please try again." }, { status: 502 });
    }
    existingOrderForAttempt = data;
  }
  const attemptAction = decideCheckoutAttemptAction(existingOrderForAttempt);

  if (attemptAction.kind === "ALREADY_PAID") {
    return NextResponse.json({ ok: true, orderReference: attemptAction.orderReference });
  }
  if (attemptAction.kind === "REJECT_CANCELLED_ORDER") {
    return NextResponse.json(
      { error: "This order was cancelled. Please start a new checkout from your cart." },
      { status: 409 },
    );
  }

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

  let shippingOption: { id: string; label: string; cents: number };
  if (isPickup) {
    // No carrier rate needed for pickup -- never call the shipping provider at all.
    shippingOption = OTTAWA_PICKUP_OPTION;
  } else {
    let shippingOptions: Awaited<ReturnType<typeof shippingProvider.getOptions>>;
    try {
      shippingOptions = await shippingProvider.getOptions(
        // Non-null: validated above when !isPickup (the only way this branch runs).
        addr!,
        subtotalCents,
        lines.map((l) => ({ unitWeightLb: l.unitWeightLb, quantity: l.quantity, productId: l.productId })),
      );
    } catch (err) {
      // A live-rate provider (e.g. CanadaPostShippingProvider once activated) can legitimately fail
      // to quote — never let that crash checkout with an unhandled 500. FreeShippingProvider never
      // throws, so this only ever fires once a real carrier integration is live.
      //
      // ShippingRateUnavailableError means the customer can fix this themselves (bad postal code,
      // non-Canadian address, no live rate configured yet) — its message is already written to be
      // shown as-is, and 422 signals "your input, not our system." Anything else is an unexpected
      // failure (network error, Chit Chats/Canada Post outage) and gets the generic message + 502.
      if (err instanceof ShippingRateUnavailableError) {
        // Same `shippingUnavailable` tag /api/checkout/quote uses -- lets the frontend offer a
        // "Request a Shipping Quote" path here too, in the unlikely case this is ever reached
        // without a successful quote already having set it there first (e.g. a destination that
        // became unserviceable between the two calls).
        return NextResponse.json({ error: err.message, shippingUnavailable: true }, { status: 422 });
      }
      console.error("[checkout] shipping quote failed:", err);
      return NextResponse.json(
        { error: "We couldn't get a shipping rate for this address right now. Please try again or contact us.", shippingUnavailable: true },
        { status: 502 },
      );
    }
    shippingOption = shippingOptions[0] ?? { id: "free", label: "Free Shipping", cents: 0 };
  }

  const { taxCents } = await taxProvider.calculate({
    subtotalCents,
    shippingCents: shippingOption.cents,
    // PICKUP_LOCATION, not addr -- isPickup forces the Ontario point-of-sale rate regardless of
    // the address passed here, but this is also the semantically correct address for a pickup
    // order: the sale is physically completed at PICKUP_LOCATION, not wherever the customer lives.
    shippingAddress: isPickup ? PICKUP_LOCATION : addr!,
    isPickup,
  });
  const totalCents = subtotalCents + shippingOption.cents + taxCents;

  // What MapleOrder.shippingAddress (jsonb, not a fixed schema) stores for either fulfillment
  // method -- no migration needed, this column already accepts any JSON shape. fulfillmentMethod
  // is the field the confirmation page, admin order view, and email templates all branch on.
  const orderAddressRecord = isPickup
    ? { fulfillmentMethod: "pickup" as const, pickupLocation: PICKUP_LOCATION }
    : { fulfillmentMethod: "delivery" as const, ...addr! };

  let orderId: string;
  let orderReference: string;
  // Non-null only for REUSE_ORDER_REUSE_SQUARE_ORDER -- an existing Square Order from a prior
  // attempt for this same checkoutAttemptId, reused instead of creating a second one.
  let reusedSquareOrderId: string | null = null;

  if (attemptAction.kind === "REUSE_ORDER_NEW_SQUARE_ORDER" || attemptAction.kind === "REUSE_ORDER_REUSE_SQUARE_ORDER") {
    // A retry of a known, not-yet-paid checkoutAttemptId -- the MapleOrder/MapleOrderLine rows
    // already exist from the attempt that created them; never insert a second copy. Only a fresh
    // PaymentAttempt is needed, since this request's sourceId/idempotencyKey are necessarily new
    // (Square Web Payments SDK tokens are single-use).
    orderId = attemptAction.orderId;
    orderReference = attemptAction.orderReference;
    if (attemptAction.kind === "REUSE_ORDER_REUSE_SQUARE_ORDER") {
      reusedSquareOrderId = attemptAction.squareOrderId;
    }

    const { error: attemptError } = await supabaseAdmin.from("PaymentAttempt").insert({
      orderId,
      idempotencyKey: body.idempotencyKey,
      status: "CREATED",
      sourceType: body.sourceType,
    });
    if (attemptError) {
      console.error("[checkout] payment attempt creation failed (reuse path):", attemptError);
      // Deliberately NOT deleting MapleOrder on failure here, unlike the fresh-order path below --
      // this order existed before this request (created by an earlier attempt for the same
      // checkoutAttemptId) and must survive regardless of this particular retry's outcome.
      return NextResponse.json({ error: "Couldn't process your payment. Please try again." }, { status: 502 });
    }
  } else {
    // attemptAction.kind === "CREATE_NEW_ORDER" -- today's behavior, unchanged.
    //
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
          shippingAddress: orderAddressRecord,
          subtotalCents,
          taxCents,
          shippingCents: shippingOption.cents,
          totalCents,
          currency: "CAD",
          squareLocationId: squareLocationId(),
          checkoutAttemptId: body.checkoutAttemptId ?? null,
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
        // Same orphaned-order concern as the PaymentAttempt race below -- a MapleOrder with no
        // lines and no PaymentAttempt would otherwise sit in the admin orders list forever.
        await supabaseAdmin.from("MapleOrder").delete().eq("id", orderId);
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
        // A near-simultaneous duplicate submission (same idempotencyKey -- a double-click, or a
        // retried request racing the original before either's PaymentAttempt existed yet) can lose
        // PaymentAttempt.idempotencyKey's unique-constraint race: both requests found no
        // existingAttempt above, both inserted their own MapleOrder/MapleOrderLine, but only one can
        // ever win this insert. Without this cleanup, the loser leaves an orphaned
        // PENDING_PAYMENT MapleOrder behind forever -- no PaymentAttempt will ever reference it, so
        // it would never transition to PAID or FAILED, just sit in the admin orders list
        // indefinitely. Deleting it here (cascades to MapleOrderLine, see migration 002) means the
        // race fails cleanly instead of littering the orders table; the other, winning request's own
        // order and payment proceed completely unaffected.
        await supabaseAdmin.from("MapleOrder").delete().eq("id", orderId);
        return NextResponse.json({ error: "Couldn't process your payment. Please try again." }, { status: 502 });
      }
    }
  }

  // Best-effort, never blocks/delays payment -- see associateShippingQuoteWithOrder's own header.
  // Only for delivery orders: pickup never calls the real shipping provider, so there is nothing
  // real to associate. Uses the EXACT same (addr, subtotalCents, lines) already passed to
  // shippingProvider.getOptions() above in this same request -- orderId is a real FK to the order
  // just created/reused, never a fingerprint reconstructed from stored data later. Idempotent on
  // retry (orderId is unique; see migration 015), so safe to call unconditionally here regardless
  // of which branch above produced this orderId.
  if (!isPickup) {
    await associateShippingQuoteWithOrder(
      supabaseAdmin,
      orderId,
      addr!,
      subtotalCents,
      lines.map((l) => ({ unitWeightLb: l.unitWeightLb, quantity: l.quantity, productId: l.productId })),
      shippingOption,
    );
  }

  const square = createSquareClient();
  const locationId = squareLocationId();

  try {
    // REUSE_ORDER_REUSE_SQUARE_ORDER already has a live Square Order from a prior attempt for
    // this same checkoutAttemptId -- creating a second one would be exactly the duplicate this
    // whole model exists to prevent. Every other path (a genuine first attempt, or a retry that
    // never got far enough to create one) still needs this call.
    let squareOrderId: string;
    if (reusedSquareOrderId) {
      squareOrderId = reusedSquareOrderId;
    } else {
      // Square's Payments API validates that a payment's amount matches its referenced Order's
      // own computed total -- confirmed directly against sandbox (ORDER_TOTAL_MISMATCH) when this
      // only listed product line items: the Order totaled subtotalCents alone while the Payment
      // below charges subtotalCents + taxCents + shippingOption.cents, and Square rejects the
      // mismatch rather than silently accepting a payment that doesn't match its order. Tax and
      // shipping as their own line items (not Square's percentage-based `taxes`/`service_charges`)
      // keeps the Order's total exactly equal to totalCents with no separate rounding path to
      // drift from our own already-computed cents values. Omitted entirely when zero (a pickup
      // order's shippingOption.cents) rather than sent as a $0 line item.
      const squareLineItems = [
        ...lines.map((l) => ({
          name: l.productName,
          quantity: String(l.quantity),
          basePriceMoney: { amount: BigInt(l.unitPriceCents), currency: "CAD" as const },
        })),
        ...(shippingOption.cents > 0
          ? [{ name: shippingOption.label, quantity: "1", basePriceMoney: { amount: BigInt(shippingOption.cents), currency: "CAD" as const } }]
          : []),
        ...(taxCents > 0
          ? [{ name: "Tax", quantity: "1", basePriceMoney: { amount: BigInt(taxCents), currency: "CAD" as const } }]
          : []),
      ];

      const orderResponse = await square.orders.create({
        order: {
          locationId,
          referenceId: orderReference,
          lineItems: squareLineItems,
          fulfillments: isPickup
            ? [
                {
                  type: "PICKUP",
                  pickupDetails: {
                    recipient: {
                      displayName: body.contact.fullName,
                      phoneNumber: body.contact.phone,
                      emailAddress: body.contact.email,
                    },
                    // ASAP, not a specific scheduled pickupAt window -- no confirmed prep-time or
                    // appointment-slot system exists for pickup orders (see pickupLocation.ts's own
                    // caveat on BUSINESS.hours), so this doesn't invent a pickup time; Square
                    // computes pickup_at itself for ASAP fulfillments. The note surfaces the real,
                    // already-public hours to Square Point of Sale / staff, not a fabricated window.
                    scheduleType: "ASAP",
                    note: `Local pickup — ${PICKUP_LOCATION.label}. Hours: ${PICKUP_LOCATION.hours.map((h) => `${h.days} ${h.time}`).join("; ")}`,
                  },
                },
              ]
            : [
                {
                  type: "SHIPMENT",
                  shipmentDetails: {
                    recipient: {
                      displayName: body.contact.fullName,
                      phoneNumber: body.contact.phone,
                      emailAddress: body.contact.email,
                      address: {
                        addressLine1: addr!.addressLine1,
                        addressLine2: addr!.addressLine2 || undefined,
                        locality: addr!.city,
                        administrativeDistrictLevel1: addr!.province,
                        postalCode: addr!.postalCode,
                        country: addr!.country as never,
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

      const newSquareOrderId = orderResponse.order?.id;
      if (!newSquareOrderId) {
        throw new Error("Square order creation returned no order id.");
      }
      squareOrderId = newSquareOrderId;
      // Persisted before the payment call (not just on success) so a webhook that arrives before
      // this request finishes can still find this MapleOrder via squareOrderId.
      await supabaseAdmin.from("MapleOrder").update({ squareOrderId }).eq("id", orderId);
    }

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
      const winnerReference = await alreadyPaidByConcurrentAttempt(supabaseAdmin, orderId);
      if (winnerReference) return NextResponse.json({ ok: true, orderReference: winnerReference });
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

    await markOrderPaidAndNotify(supabaseAdmin, {
      orderId,
      squareOrderId,
      squarePaymentId: payment.id,
      rawResponse: paymentResponse as unknown as object,
      idempotencyKey: body.idempotencyKey,
    });

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
    // Confirmed live against sandbox: a genuinely concurrent retry against the same squareOrderId
    // is rejected by Square itself with "The order is already paid" once a racing request's
    // payment already completed -- Square is the authoritative source of truth here, not
    // something this app needs to pre-check or lock around. But that rejection would otherwise
    // surface to THIS request's caller as a confusing "payment didn't go through" error even
    // though the checkout attempt as a whole genuinely succeeded (via the other request) --
    // checking our own now-authoritative order status catches that and returns success instead.
    const winnerReference = await alreadyPaidByConcurrentAttempt(supabaseAdmin, orderId);
    if (winnerReference) return NextResponse.json({ ok: true, orderReference: winnerReference });
    return NextResponse.json({ error: reason }, { status: isDeclineLike ? 402 : 502 });
  }
}

/** After a payment call fails, checks whether a genuinely concurrent request for the SAME order
 *  (not a sequential retry -- those are already caught earlier by the checkoutAttemptId lookup)
 *  won the race and already marked this exact order PAID, between this request's own order
 *  lookup and its payment attempt. Returns the order's reference if so, null otherwise -- never
 *  throws, since a failed check here should fall back to reporting the original failure rather
 *  than masking it with a second error. */
async function alreadyPaidByConcurrentAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  orderId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin.from("MapleOrder").select("status, reference").eq("id", orderId).maybeSingle();
  if (data?.status === "PAID") return data.reference as string;
  return null;
}
