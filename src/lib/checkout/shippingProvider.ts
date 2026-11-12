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
 *  module doesn't need to import checkout's full cart-line type just to read two fields. */
export interface ShippingQuoteLine {
  unitWeightLb: number | null;
  quantity: number;
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
 *      against synthetic fixtures, not activated. Needs a Chit Chats API access token + client ID
 *      (none exist in this codebase) before it can ever make a real call.
 *   2. CanadaPostShippingProvider (canadaPostShippingProvider.ts) — kept as a documented, built,
 *      tested FALLBACK only, no longer the planned primary. Needs its own Canada Post Developer
 *      Program credentials (also absent) if ever activated instead of or alongside Chit Chats.
 * Activating either is a one-line swap of the export below, once credentials exist and the owner
 * approves Production shipping activation — never silently substituted for a failed paid quote.
 */
class FreeShippingProvider implements ShippingQuoteProvider {
  async getOptions(): Promise<ShippingOption[]> {
    return [{ id: "free", label: "Free Shipping", cents: 0 }];
  }
}

export const shippingProvider: ShippingQuoteProvider = new FreeShippingProvider();
