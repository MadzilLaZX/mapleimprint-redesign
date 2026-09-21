import { NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { markOrderPaidAndNotify } from "@/lib/checkout/fulfillOrder";

/**
 * Repairs uncertain client states: if a customer's browser loses the response after Square
 * already charged them, this is what still marks the order PAID and sends the confirmation email
 * — without this, that customer would show as unpaid despite having been charged.
 */
export async function POST(request: Request) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;
  if (!signatureKey || !notificationUrl) {
    console.error("[webhook] Square webhook received but SQUARE_WEBHOOK_SIGNATURE_KEY/SQUARE_WEBHOOK_NOTIFICATION_URL is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Must verify against the exact raw bytes, before any JSON.parse — the signature covers
  // notificationUrl + this literal body string.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");
  if (!signatureHeader) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const valid = await WebhooksHelper.verifySignature({ requestBody: rawBody, signatureHeader, signatureKey, notificationUrl });
  if (!valid) {
    console.error("[webhook] invalid Square webhook signature.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event_id?: string; type?: string; data?: { object?: { payment?: { id?: string; order_id?: string; status?: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventId = event.event_id;
  if (!eventId) return NextResponse.json({ error: "Missing event id." }, { status: 400 });

  const supabaseAdmin = createAdminClient();

  // Idempotency: rely on the unique constraint on squareEventId rather than a read-then-write
  // check, so two concurrent deliveries of the same event can't both slip past a race.
  const { error: insertError } = await supabaseAdmin
    .from("ProcessedWebhookEvent")
    .insert({ squareEventId: eventId, eventType: event.type ?? "unknown", payload: event });
  if (insertError) {
    // Unique violation = genuine duplicate delivery — acknowledge without reprocessing.
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[webhook] failed to record event:", insertError);
    return NextResponse.json({ error: "Couldn't process webhook." }, { status: 502 });
  }

  if (event.type === "payment.created" || event.type === "payment.updated") {
    const payment = event.data?.object?.payment;
    if (payment?.status === "COMPLETED" && payment.order_id && payment.id) {
      const { data: order } = await supabaseAdmin
        .from("MapleOrder")
        .select("id")
        .eq("squareOrderId", payment.order_id)
        .maybeSingle();
      if (order) {
        await markOrderPaidAndNotify(supabaseAdmin, {
          orderId: order.id,
          squareOrderId: payment.order_id,
          squarePaymentId: payment.id,
        });
        await supabaseAdmin
          .from("PaymentAttempt")
          .update({ status: "SUCCEEDED", squarePaymentId: payment.id })
          .eq("orderId", order.id)
          .neq("status", "SUCCEEDED");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
