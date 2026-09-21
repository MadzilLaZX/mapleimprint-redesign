import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/automation/email/resend";
import { orderConfirmationEmail } from "@/lib/automation/email/templates";

/**
 * The single place an order is marked PAID and notified — called from BOTH the synchronous
 * /api/checkout/pay response path and the /api/webhooks/square reconciliation path, since either
 * can be the one that first learns a payment succeeded. The conditional update (`neq status PAID`)
 * is what makes calling this twice for the same order safe: whichever call arrives first wins,
 * the other becomes a no-op that skips the email.
 */
export async function markOrderPaidAndNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  { orderId, squareOrderId, squarePaymentId }: { orderId: string; squareOrderId: string; squarePaymentId: string },
): Promise<void> {
  const { data: transitioned, error: updateError } = await supabaseAdmin
    .from("MapleOrder")
    .update({ status: "PAID", squareOrderId, squarePaymentId, updatedAt: new Date().toISOString() })
    .eq("id", orderId)
    .neq("status", "PAID")
    .select("reference, contactName, contactEmail, totalCents, emailSentAt")
    .maybeSingle();

  if (updateError) {
    console.error("[checkout] failed to mark order paid:", updateError);
    return;
  }
  // No row returned means either the order didn't exist, or (far more likely) it was already
  // PAID — the other convergent path (sync response vs. webhook) got there first. Either way,
  // there's nothing further to do here.
  if (!transitioned || transitioned.emailSentAt) return;

  const { data: lines } = await supabaseAdmin
    .from("MapleOrderLine")
    .select("productName, quantity, colourName")
    .eq("orderId", orderId);

  const { subject, html, text } = orderConfirmationEmail({
    reference: transitioned.reference,
    contactName: transitioned.contactName,
    contactEmail: transitioned.contactEmail,
    totalCents: transitioned.totalCents,
    lines: lines ?? [],
  });

  await sendEmail({ to: transitioned.contactEmail, subject, html, text });
  await supabaseAdmin.from("MapleOrder").update({ emailSentAt: new Date().toISOString() }).eq("id", orderId);
}
