import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoredShippingQuoteInfo {
  rates: { id: string; label: string; cents: number }[];
  chitChatsShipmentId: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * Looks up a genuine, already-persisted Chit Chats rate quote for a delivery order, for the
 * admin order detail page. Returns null -- "no stored quote" -- in two real, currently-permanent
 * situations, both honestly disclosed rather than worked around with a guess:
 *
 * 1. No quote has ever been successfully fetched for ANY order yet, because packagingProfiles.ts
 *    has zero real entries (fetchChitChatsRates' own preflight refuses before any external call
 *    when package dimensions are null -- see chitChatsShippingProvider.ts's header). This is true
 *    regardless of whether shippingProvider.ts's coordinator is wired in.
 * 2. Even once a real quote exists, there is currently NO RELIABLE WAY to find which row belongs
 *    to a given order: ChitChatsShippingQuote is keyed by a fingerprint hashed from
 *    (address, subtotalCents, parcel weight/dimensions) -- see chitChatsQuoteStore.ts's
 *    buildQuoteFingerprint() -- and recomputing that fingerprint needs the exact packaging
 *    profile resolved at checkout time, which in turn needs each line's buildProductId()
 *    (categorySlug + subcategorySlug + slug). MapleOrderLine only stores categorySlug (see
 *    002_maple_orders.sql) -- subcategorySlug and slug were never added -- so the fingerprint
 *    can't be reconstructed from a historical order today.
 *
 * Deliberately does NOT fall back to a looser match (e.g. address + subtotal alone, ignoring
 * package weight/dimensions) -- Chit Chats rates depend on weight/dimensions too, so a looser
 * match could show a real row that was actually quoted for a DIFFERENT package, which would be
 * exactly the "fabricated/placeholder rate presented as real" this feature must never do. Fixing
 * this for real needs two separate, deliberate additions: real packaging-profile data, and
 * MapleOrderLine storing subcategorySlug/slug (or the resolved packaging itself) at order-creation
 * time -- not attempted here, since inventing either would violate this round's own constraints.
 */
export async function findStoredShippingQuoteForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _supabaseAdmin: SupabaseClient<any, any, any>,
  _order: { shippingAddress: unknown; subtotalCents: number },
): Promise<StoredShippingQuoteInfo | null> {
  return null;
}
