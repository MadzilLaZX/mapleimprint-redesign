import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/automation/email/resend";
import { orderConfirmationEmail, adminOrderPaidEmail } from "@/lib/automation/email/templates";
import { triggerDesignExport } from "@/lib/studio/exportDesign";

/**
 * The single place an order is marked PAID and notified — called from BOTH the synchronous
 * /api/checkout/pay response path and the /api/webhooks/square reconciliation path, since either
 * can be the one that first learns a payment succeeded.
 *
 * The MapleOrder and PaymentAttempt transitions happen inside mark_order_paid_and_sync_attempt(),
 * a single Postgres function call — not two separate Supabase REST calls. That matters: a real
 * order was found live (MO-KZULY7SS) correctly PAID with its confirmation email already sent, but
 * PaymentAttempt still showing FAILED from an earlier synchronous decline that Square later
 * reversed, because those used to be two independent, non-atomic writes and only one completed.
 * Wrapping both inside one plpgsql function gives them the function's own implicit transaction —
 * Postgres's row lock on the first UPDATE's `WHERE status != 'PAID'` also serializes concurrent
 * callers (verified live against synthetic rows: two simultaneous calls for the same order always
 * produce exactly one winner), which is what makes calling this twice for the same order safe:
 * whichever call arrives first wins and transitions both tables together, the other becomes a
 * no-op that skips the email.
 */
export async function markOrderPaidAndNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  {
    orderId,
    squareOrderId,
    squarePaymentId,
    rawResponse,
  }: {
    orderId: string;
    squareOrderId: string;
    squarePaymentId: string;
    /** The full Square payments.create() response, when this call is the synchronous /pay
     *  success path — kept on PaymentAttempt as an audit trail. Omitted when called from the
     *  webhook path, which has no equivalent payments.create() response of its own (the webhook
     *  event itself is already stored separately in ProcessedWebhookEvent.payload). */
    rawResponse?: object;
  },
): Promise<void> {
  const { data: rows, error: rpcError } = await supabaseAdmin.rpc("mark_order_paid_and_sync_attempt", {
    p_order_id: orderId,
    p_square_order_id: squareOrderId,
    p_square_payment_id: squarePaymentId,
    p_raw_response: rawResponse ?? null,
  });

  if (rpcError) {
    console.error("[checkout] mark_order_paid_and_sync_attempt failed:", rpcError);
    return;
  }
  const result = rows?.[0] as
    | {
        newly_paid: boolean;
        order_reference: string | null;
        contact_name: string | null;
        contact_email: string | null;
        total_cents: number | null;
        already_emailed: boolean | null;
      }
    | undefined;
  // newly_paid false means either the order didn't exist, or (far more likely) it was already
  // PAID — the other convergent path (sync response vs. webhook, or a duplicate webhook delivery)
  // got there first and already transitioned both tables together. Either way, there's nothing
  // further to do here.
  if (!result?.newly_paid) return;

  const transitioned = {
    reference: result.order_reference as string,
    contactName: result.contact_name as string,
    contactEmail: result.contact_email as string,
    totalCents: result.total_cents as number,
  };

  if (result.already_emailed) return;

  const { data: lines } = await supabaseAdmin
    .from("MapleOrderLine")
    .select(
      "id, productName, categorySlug, colourName, quantity, sizeBreakdown, designProjectId, designSnapshot",
    )
    .eq("orderId", orderId);

  // mark_order_paid_and_sync_attempt's return row doesn't carry shippingAddress (it was written
  // before pickup existed) -- a plain, cheap extra read rather than altering a live Postgres
  // function, which would need its own separate approval as a database change.
  const { data: orderAddress } = await supabaseAdmin
    .from("MapleOrder")
    .select("shippingAddress")
    .eq("id", orderId)
    .maybeSingle();
  const addressRecord = orderAddress?.shippingAddress as
    | { fulfillmentMethod?: "delivery" | "pickup"; pickupLocation?: { label: string; addressLine1: string; addressLine2: string; city: string; province: string; postalCode: string; hours: { days: string; time: string }[] } }
    | null
    | undefined;
  const fulfillment =
    addressRecord?.fulfillmentMethod === "pickup" && addressRecord.pickupLocation
      ? {
          method: "pickup" as const,
          pickupLabel: addressRecord.pickupLocation.label,
          pickupAddressLine: `${addressRecord.pickupLocation.addressLine1}, ${addressRecord.pickupLocation.addressLine2}, ${addressRecord.pickupLocation.city}, ${addressRecord.pickupLocation.province} ${addressRecord.pickupLocation.postalCode}`,
          pickupHoursLines: addressRecord.pickupLocation.hours.map((h) => `${h.days}: ${h.time}`),
        }
      : { method: "delivery" as const };

  const { subject, html, text } = orderConfirmationEmail({
    reference: transitioned.reference,
    contactName: transitioned.contactName,
    contactEmail: transitioned.contactEmail,
    totalCents: transitioned.totalCents,
    lines: lines ?? [],
    fulfillment,
  });

  await sendEmail({ to: transitioned.contactEmail, subject, html, text });
  await supabaseAdmin.from("MapleOrder").update({ emailSentAt: new Date().toISOString() }).eq("id", orderId);

  // Staff-facing counterpart — until now a paid order notified *only* the customer. Own try/catch,
  // same isolation style as the n8n-webhook block below: a Resend outage or missing
  // OWNER_NOTIFICATION_EMAIL must never affect the PAID transition or the customer's own email,
  // both of which have already succeeded by this point.
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
  if (ownerEmail) {
    try {
      const adminEmail = adminOrderPaidEmail({
        reference: transitioned.reference,
        contactName: transitioned.contactName,
        contactEmail: transitioned.contactEmail,
        totalCents: transitioned.totalCents,
        lines: (lines ?? []).map((l) => ({ productName: l.productName, quantity: l.quantity, colourName: l.colourName })),
        fulfillment,
      });
      await sendEmail({ to: ownerEmail, ...adminEmail });
    } catch (err) {
      console.error("[checkout] admin paid-order notification failed:", err);
    }
  }

  // Production file export (300dpi PNG + SVG where vector-eligible) for every CUSTOM line —
  // customer's payment confirmation must never wait on this, so each line is triggered
  // fire-and-forget rather than awaited in sequence. Uses the service-role client since there's
  // no customer session cookie available in a webhook/server-to-server context; safe because
  // triggerDesignExport only ever touches the one DesignProject row it's given.
  for (const line of lines ?? []) {
    if (!line.designProjectId) continue;
    triggerDesignExport(supabaseAdmin, line.designProjectId).catch((err) =>
      console.error("[checkout] export trigger failed for line", line.id, err),
    );
  }

  // Separate, best-effort production handoff to n8n — isolated in its own try/catch so an n8n
  // outage (or the env var being unset, e.g. in local dev) never blocks the customer email or the
  // PAID transition above. Each line's designSnapshot already carries every asset URL and layout
  // field n8n needs to build that item's Asset file (logos/PNGs) and Design file (the layout spec)
  // — nothing new had to be captured here, just forwarded.
  const n8nWebhookUrl = process.env.N8N_ORDER_CONFIRMATION_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reference: transitioned.reference,
          contactName: transitioned.contactName,
          contactEmail: transitioned.contactEmail,
          totalCents: transitioned.totalCents,
          lines: (lines ?? []).map((line) => ({
            orderLineId: line.id,
            productName: line.productName,
            categorySlug: line.categorySlug,
            colourName: line.colourName,
            quantity: line.quantity,
            sizeBreakdown: line.sizeBreakdown,
            designProjectId: line.designProjectId,
            designSnapshot: line.designSnapshot,
          })),
        }),
      });
    } catch (err) {
      console.error("[checkout] n8n order-confirmation webhook failed:", err);
    }
  }
}
