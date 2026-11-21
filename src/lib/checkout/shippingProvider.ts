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
 * COMMERCIAL RISK — LAUNCH BLOCKER (read before approving a Production deploy):
 *
 * This provider ships EVERY order free, with NO threshold, NO weight/value cap, and NO
 * destination check beyond what `ShippingAddressInput` itself requires. That is NOT the same
 * thing as "free shipping" being Maple's approved policy — the owner already confirmed a
 * specific, narrower policy on 2026-11-12 (see `chitChatsShippingProvider.ts`'s header and its
 * exported `FREE_SHIPPING_THRESHOLD_CENTS`, currently CAD $300.00): standard delivery is free
 * ONLY on eligible Canadian orders with a merchandise subtotal strictly over $300, confirmed
 * serviceable by a real carrier rate request first; orders at or under $300 are supposed to get a
 * REAL calculated rate, not a free one. **Today's live code gives every order the $300+ treatment
 * regardless of size** — a $15 order and a $15,000 order are both "Free Shipping" today. If this
 * is deployed to Production as-is, that gap is real and ongoing, not hypothetical.
 *
 * Why this hasn't simply been fixed by activating the real policy: `ChitChatsShippingProvider`
 * already implements the owner's exact policy correctly (threshold, serviceability-first, never a
 * fabricated free rate for an unconfirmed destination) and a Chit Chats API token + client ID now
 * exist in `.env.local` (confirmed working against production — see
 * docs/chit-chats-production-readiness.md). The remaining blocker is that `packagingProfiles.ts`'s
 * PACKAGING_PROFILES/PRODUCT_PACKAGING_ASSIGNMENTS are still empty — Chit Chats requires real
 * parcel dimensions on every rate request (confirmed against the live OpenAPI spec), so activating
 * `ChitChatsShippingProvider` as-is today would route EVERY order (not just small ones) to a
 * manual-quote refusal, since no product has owner-measured dimensions yet. That would be a far
 * bigger availability regression than the free-shipping gap it would fix, and is not a decision
 * this codebase makes unilaterally — see `resolveShippingProvider` below for the prepared,
 * one-line activation point once the owner decides how to proceed (measure a box first, accept
 * the manual-quote friction on small orders as an interim state, or keep blanket free shipping as
 * a deliberate, approved launch promotion instead of an oversight).
 *
 * Planned activation order (per the owner's 2026-11-12 decision to replace Canada Post with
 * Chit Chats as the primary carrier):
 *   1. ChitChatsShippingProvider (chitChatsShippingProvider.ts) — PLANNED PRIMARY, already
 *      implements the confirmed $300 threshold policy. Blocked only on real packaging dimensions
 *      (see above), not credentials.
 *   2. CanadaPostShippingProvider (canadaPostShippingProvider.ts) — kept as a documented, built,
 *      tested FALLBACK only, no longer the planned primary. Needs its own Canada Post Developer
 *      Program credentials (also absent) if ever activated instead of or alongside Chit Chats.
 */
class FreeShippingProvider implements ShippingQuoteProvider {
  async getOptions(_address: ShippingAddressInput, subtotalCents: number): Promise<ShippingOption[]> {
    // Deliberately unconditional and side-effect-only (never changes the result, never throws) —
    // a plain audit trail so Production exposure to this gap (see header above) is at least
    // observable in logs (e.g. via a Vercel log drain) rather than silent, without this codebase
    // inventing a cap, a paid rate, or refusing an order on its own authority.
    console.info(`[shipping] Free Shipping granted (no threshold active) for subtotalCents=${subtotalCents}`);
    return [{ id: "free", label: "Free Shipping", cents: 0 }];
  }
}

/**
 * The per-environment gate, mirroring `taxProvider.ts`'s `resolveTaxProvider` exactly: a plain,
 * directly-testable function (never reading `process.env` itself) so a future activation decision
 * is a one-line change to the branch below, reviewed via a real commit — never an env var or
 * Vercel dashboard setting an owner could flip by accident. Both branches return the same
 * `FreeShippingProvider` today — this function exists to PREPARE the seam, not to change behavior
 * yet. Once the owner approves (a) a real packaging profile and (b) how to handle orders at/under
 * the $300 threshold in the meantime, activating `ChitChatsShippingProvider` for Preview first
 * (to verify against the real Chit Chats account before Production ever sees it) is a one-line
 * edit to the non-Production branch below; Production stays on `FreeShippingProvider` until a
 * separate, deliberate edit to the Production branch follows, exactly like `resolveTaxProvider`'s
 * Production/non-Production split.
 */
export function resolveShippingProvider(vercelEnv: string | undefined): ShippingQuoteProvider {
  void vercelEnv; // not yet branched on — see header above for why both paths agree today
  return new FreeShippingProvider();
}

export const shippingProvider: ShippingQuoteProvider = resolveShippingProvider(process.env.VERCEL_ENV);
