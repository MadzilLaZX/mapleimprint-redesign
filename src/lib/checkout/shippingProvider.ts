export interface ShippingAddressInput {
  province: string;
  country: string;
  postalCode: string;
  /** Optional -- today's /api/checkout/quote only collects province/country/postalCode (a
   *  lightweight pre-address-entry preview), while /api/checkout/pay has the full delivery
   *  address by the time it runs. These extra fields exist so a richer provider (e.g.
   *  ChitChatsShippingProvider, which needs a full street address to request a real quote) can
   *  use the SAME shared interface rather than a parallel one -- it validates their presence
   *  itself and fails clearly (ShippingRateUnavailableError) when they're missing, rather than
   *  this type silently promising data that isn't always there. */
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
}

export interface ShippingOption {
  id: string;
  label: string;
  cents: number;
}

/** The minimal per-line shape a shipping quote needs -- a subset of PricedCartLine, so this
 *  module doesn't need to import checkout's full cart-line type just to read these fields. */
export interface ShippingQuoteLine {
  unitWeightLb: number | null;
  quantity: number;
  /** Stable catalogue identifier (see packagingProfiles.ts's `buildProductId()`), for looking up
   *  a real, owner-measured packaging profile. Optional -- existing callers/tests that don't
   *  supply it behave exactly as before (ChitChatsShippingProvider treats a missing id on any
   *  line the same as "packaging can't be determined for this cart," never a crash). Null for a
   *  line whose underlying catalogue product can no longer be resolved (e.g. a CUSTOM design
   *  frozen against a product since removed) -- same "unknown, don't guess" meaning as null. */
  productId?: string | null;
}

// subtotalCents is accepted (not yet used by FreeShippingProvider) so a real carrier provider can
// implement this same interface directly -- activating one becomes swapping the export below, not
// a signature change propagated through every call site. `lines` was added alongside
// unitWeightLb landing on PricedCartLine -- a real provider needs per-line weight to call
// estimateParcelWeightLb(); FreeShippingProvider ignores both.
export interface ShippingQuoteProvider {
  getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]>;
}

/**
 * There are no approved carrier rates/zones anywhere in this codebase (verified — grepped the
 * whole repo). Per the non-negotiable "do not invent shipping prices" rule, this returns a single
 * Free Shipping option rather than a fabricated rate table. This is also the live export today —
 * neither real carrier provider below is activated yet.
 *
 * Planned activation order (per the owner's 2026-11-12 decision to replace Canada Post with
 * Chit Chats as the primary carrier):
 *   1. ChitChatsShippingProvider (chitChatsShippingProvider.ts) — PLANNED PRIMARY. Built, tested
 *      against synthetic fixtures, not activated. A Chit Chats API access token + client ID now
 *      exist in `.env.local` (confirmed working against production — see
 *      docs/chit-chats-production-readiness.md), so credentials are no longer the blocker; the
 *      current blocker is that `packagingProfiles.ts`'s PACKAGING_PROFILES/
 *      PRODUCT_PACKAGING_ASSIGNMENTS are still empty — Chit Chats requires real parcel dimensions
 *      on every rate request, and no product in the catalogue has owner-measured dimensions yet.
 *   2. CanadaPostShippingProvider (canadaPostShippingProvider.ts) — kept as a documented, built,
 *      tested FALLBACK only, no longer the planned primary. Needs its own Canada Post Developer
 *      Program credentials (also absent) if ever activated instead of or alongside Chit Chats.
 * Activating either is a one-line swap of the export below, once a real packaging profile exists
 * and the owner approves Production shipping activation — never silently substituted for a failed
 * paid quote.
 */
class FreeShippingProvider implements ShippingQuoteProvider {
  async getOptions(): Promise<ShippingOption[]> {
    return [{ id: "free", label: "Free Shipping", cents: 0 }];
  }
}

export const shippingProvider: ShippingQuoteProvider = new FreeShippingProvider();
