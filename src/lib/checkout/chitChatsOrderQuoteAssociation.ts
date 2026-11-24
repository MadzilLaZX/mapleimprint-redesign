import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShippingAddressInput, ShippingOption, ShippingQuoteLine } from "./shippingProvider";
import { buildChitChatsQuoteKey } from "./chitChatsShippingProvider.ts";
import { buildQuoteFingerprint, SupabaseChitChatsQuoteStore } from "./chitChatsQuoteStore.ts";

/** Finds which RAW (pre-free-shipping-override) rate entry corresponds to the option checkout
 *  actually selected. When free shipping applied, `selected.id` is literally "free" (the override
 *  replaces the real id/label entirely -- see ChitChatsShippingProvider.getOptions()'s own
 *  cheapestIndex logic), so the real entry is recovered by re-finding the cheapest raw rate, the
 *  exact same rule getOptions() itself used to decide which one to zero out. Otherwise `selected`
 *  IS one of the raw entries unchanged, matched by id. Returns null (never a guess) if neither
 *  rule finds a match -- e.g. the persisted quote's rates don't actually contain the selected
 *  service, which would mean the two are from different requests and must not be conflated. */
function findOriginalRateEntry(rawRates: ShippingOption[], selected: ShippingOption): ShippingOption | null {
  if (rawRates.length === 0) return null;
  if (selected.id === "free") {
    return rawRates.reduce((min, r) => (r.cents < min.cents ? r : min), rawRates[0]);
  }
  return rawRates.find((r) => r.id === selected.id) ?? null;
}

/**
 * Durably associates the exact, genuine Chit Chats quote used for `orderId` with that order --
 * see migration 015's own header for why this is a real foreign key, not a fingerprint
 * reconstructed from stored order data later (that path is ambiguous today: MapleOrderLine
 * doesn't store subcategorySlug/slug, so the key can't be rebuilt reliably after the fact).
 *
 * Called from /api/checkout/pay immediately after a real shippingOption has been selected for a
 * delivery order, using the SAME live (address, subtotalCents, lines) this exact request already
 * passed to shippingProvider.getOptions() -- never reconstructed, never ambiguous.
 *
 * Best-effort and silent on any "nothing to associate" outcome -- never throws, same isolation
 * fulfillOrder.ts already uses for the n8n webhook/admin-email calls. A missing persisted quote
 * (coordinator not wired, or this request only ever hit the in-memory tier) means there is
 * genuinely nothing real to record; this never fabricates a quote to fill that gap. Idempotent:
 * `orderId` is unique, so a checkout retry that reaches this a second time for the same order is a
 * harmless no-op (ON CONFLICT DO NOTHING) -- the ORIGINAL association, from whichever attempt
 * first succeeded, is preserved rather than overwritten by a later retry's lookup.
 */
export async function associateShippingQuoteWithOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  orderId: string,
  address: ShippingAddressInput,
  subtotalCents: number,
  lines: ShippingQuoteLine[],
  selectedOption: ShippingOption,
): Promise<void> {
  try {
    const key = buildChitChatsQuoteKey(address, subtotalCents, lines);
    if (!key) return;

    const fingerprint = buildQuoteFingerprint(key);
    const quote = await new SupabaseChitChatsQuoteStore(supabaseAdmin).findReady(fingerprint, new Date());
    if (!quote) return;

    const original = findOriginalRateEntry(quote.rates ?? [], selectedOption);
    if (!original) return;

    const { error } = await supabaseAdmin.from("MapleOrderShippingQuote").upsert(
      {
        orderId,
        service: original.label,
        serviceCode: original.id,
        originalQuotedCents: original.cents,
        chitChatsShipmentId: quote.chitChatsShipmentId,
        destinationAddress: address,
        quotedAt: quote.createdAt.toISOString(),
      },
      { onConflict: "orderId", ignoreDuplicates: true },
    );
    if (error) console.error("[checkout] shipping quote association failed:", error);
  } catch (err) {
    console.error("[checkout] shipping quote association threw:", err);
  }
}
