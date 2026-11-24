import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoredShippingQuoteInfo {
  carrier: string;
  service: string;
  originalQuotedCents: number;
  chitChatsShipmentId: string | null;
  quotedAt: string;
}

/**
 * Looks up the genuine Chit Chats quote durably associated with this exact order, for the admin
 * order detail page -- a direct, exact lookup by MapleOrderShippingQuote.orderId (migration 015),
 * not a fingerprint reconstructed from stored order data. That reconstruction approach was
 * considered and rejected: MapleOrderLine doesn't store subcategorySlug/slug, so a historical
 * order's quote key couldn't be rebuilt reliably after the fact, and a looser address+subtotal-only
 * match risked showing a real row quoted for a DIFFERENT package as if it were this order's.
 * chitChatsOrderQuoteAssociation.ts closes that gap at the moment of order creation instead, using
 * the real live request data the quote was actually computed from in that same request.
 *
 * Returns null -- an honest "no stored quote" -- whenever no row exists: a pickup order (never
 * calls the real shipping provider), an order placed before this table existed, or one where no
 * persisted Chit Chats quote existed to associate in the first place (e.g. the coordinator wasn't
 * wired, or packagingProfiles.ts had no real entry yet, so the request never produced a quote
 * worth persisting). Never fabricated.
 */
export async function findStoredShippingQuoteForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  order: { id: string },
): Promise<StoredShippingQuoteInfo | null> {
  const { data } = await supabaseAdmin
    .from("MapleOrderShippingQuote")
    .select("carrier, service, originalQuotedCents, chitChatsShipmentId, quotedAt")
    .eq("orderId", order.id)
    .maybeSingle();
  return data ?? null;
}
