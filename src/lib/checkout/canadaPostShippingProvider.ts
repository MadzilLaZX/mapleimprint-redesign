import type { ShippingAddressInput, ShippingOption, ShippingQuoteLine, ShippingQuoteProvider } from "./shippingProvider";
// Explicit .ts extension (allowImportingTsExtensions, tsconfig.json) -- unlike this file's other,
// type-only imports above, this is a real runtime import, and this file's own test needs to run
// it directly via `node --test` (no bundler to resolve an extension-less specifier).
import { validatePostalCode } from "./validation.ts";

// Architecture for the confirmed shipping policy, NOT wired in (see shippingProvider.ts, whose
// `shippingProvider` export is still FreeShippingProvider). This file exists so the real
// implementation is a configuration/activation change, not something built from scratch under
// launch pressure later.
//
// Confirmed policy:
//   - Free shipping on orders over CAD $300 before tax.
//   - Live Canada Post rates on orders CAD $300 or less.
//   - Free Ottawa local pickup, always offered regardless of order size.
//
// NOT READY TO ACTIVATE - one remaining gap (two others closed since this file was first written:
// 2026-11-10 added subtotalCents to getOptions(); 2026-11-11 wired real per-line weight all the
// way from SupplierProduct through to this function's own `lines` parameter -- see below):
//
// 1. Canada Post Developer Program credentials. None exist in this codebase (grepped, no
//    CANADA_POST env var anywhere, unlike SQUARE/RESEND). Needed: a Canada Post
//    Commercial/Developer account, API key plus customer number (plus contract ID if using
//    negotiated rates), and the shipping-origin address (Maple Imprint's Ottawa facility,
//    assuming the "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9" address already shown in
//    the site footer is also the ship-from location).
//
// 2. Package weight — RESOLVED 2026-11-11, pending migration 008's approval/application + a
//    backfill run (both still awaiting separate approval, per standing instructions -- this file's
//    code does not depend on either having happened). The full chain now exists end to end:
//    SupplierProduct.rawPayload -> normalizeWeight.ts (extraction + confidence) -> migration 008's
//    columns (schema prepared, not applied) -> export-products-for-frontend.mjs's
//    resolveShippingWeightLb() (authoritative-only gate) -> CatalogueProduct.shippingWeightLb ->
//    priceCartItem.ts's lineShippingWeightLb() -> PricedCartLine.unitWeightLb -> the `lines`
//    parameter below -> estimateParcelWeightLb(). Every supplier product exports
//    shippingWeightLb: null today purely because migration 008 + the backfill haven't run yet --
//    not because any code in this chain is unfinished. getOptions() below already refuses to
//    request a live rate when that leaves any cart line without a weight (see the gate at the top
//    of the method), so activating Canada Post later needs no further weight-plumbing work.
//
//    Still not solved by any of this, and still a real gap once credentials exist: (a) Joto
//    drinkware and all house-produced (banner/sticker/business-card/etc.) products have no
//    supplier weight source at all and would need Maple's own physical measurements --
//    CatalogueProduct.shippingWeightLb stays undefined for these regardless of migration 008;
//    (b) no product anywhere carries a per-unit *dimension*, only S&S's per-case dimensions
//    (and those are 'inferred', not authoritative -- see hasAuthoritativeCaseDimensions()).

export const FREE_SHIPPING_THRESHOLD_CENTS = 30000; // CAD $300.00, before tax

export const OTTAWA_PICKUP_OPTION: ShippingOption = {
  id: "ottawa-pickup",
  label: "Local Pickup - Ottawa",
  cents: 0,
};

/** Distinguishable from an unexpected server error — a caller (the checkout API routes) can
 *  catch this specifically and show the customer a clear, honest reason ("enter a valid address",
 *  "request a quote instead") rather than a generic "something went wrong." Every throw site in
 *  this file uses this type, never a bare Error, specifically so that distinction is possible. */
export class ShippingRateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingRateUnavailableError";
  }
}

/** Minimal pre-flight check before ever attempting a real rate request — Maple ships within
 *  Canada only today (see ShippingQuoteProvider's own note), so a non-CA address or a
 *  malformed postal code must fail clearly and immediately, not produce a confusing downstream
 *  Canada Post API error. Reuses the same postal code pattern the checkout form itself already
 *  validates against (validation.ts) rather than a second, possibly-drifting regex. */
function assertValidCanadianAddress(address: ShippingAddressInput): void {
  if (address.country !== "CA") {
    throw new ShippingRateUnavailableError("Live shipping rates are only available for Canadian addresses right now.");
  }
  if (!address.province.trim()) {
    throw new ShippingRateUnavailableError("Select a province to see shipping rates.");
  }
  const postalCodeError = validatePostalCode(address.postalCode, address.country);
  if (postalCodeError) {
    throw new ShippingRateUnavailableError(postalCodeError);
  }
}

// Throws deliberately rather than returning a guessed/flat rate - inventing a shipping fee here
// would violate the same "never fabricate a charge" rule as taxProvider.ts. Replace this body
// with a real call to Canada Post's Rating API once prerequisites 1 and 2 above are resolved.
async function fetchCanadaPostRate(
  _address: ShippingAddressInput,
  _subtotalCents: number,
): Promise<ShippingOption> {
  throw new ShippingRateUnavailableError(
    "Live shipping rates aren't available yet for this order — request a quote and we'll confirm shipping manually.",
  );
}

/** Sums per-line weight for a Canada Post parcel request. Called from getOptions() below with
 *  the real cart lines a checkout request carries (PricedCartLine.unitWeightLb, via
 *  priceCartItem.ts's lineShippingWeightLb()). Returns null (not 0) when any line is missing a
 *  weight, so a caller can't silently request a rate against an under-counted parcel -- every
 *  line exports null today since migration 008 + its backfill haven't run yet, so in practice
 *  this always returns null right now; it is correct and ready the moment real data lands. */
export function estimateParcelWeightLb(
  lines: { unitWeightLb: number | null; quantity: number }[],
): number | null {
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    if (line.unitWeightLb === null || line.quantity < 1) return null;
    total += line.unitWeightLb * line.quantity;
  }
  return total;
}

/**
 * Quotes DELIVERY only -- free shipping above the threshold, or a live Canada Post rate at/below
 * it. Deliberately does NOT bundle Ottawa pickup into this result (an earlier version of this
 * file did, catching a delivery-quote failure and silently degrading to a pickup-only list --
 * that conflated "a choice the customer can always separately make" with "the resolved outcome
 * of their delivery request," which is exactly backwards: a customer who typed a real shipping
 * address and wants it delivered must see a clear failure, never a quiet substitution of a
 * fulfillment method they didn't ask for).
 *
 * getOptions() ALWAYS either returns a real delivery option or throws ShippingRateUnavailableError
 * -- it never returns an empty/degraded array. The caller (checkout API routes) catches that error
 * and surfaces its message as a 422, which is what "prevent delivery checkout from proceeding"
 * means in practice: the delivery path is blocked with a clear reason, not silently rerouted.
 *
 * Ottawa pickup is a separate, always-available, explicitly-selected fulfillment method with no
 * documented eligibility requirement beyond "the customer chooses it" (the only pickup policy on
 * record, in this file's own header, is "always offered regardless of order size" -- no minimum/
 * maximum order size, item restriction, or notice period is documented anywhere in this codebase,
 * and none is invented here). It must be offered by the CALLER as its own independent selection
 * -- e.g. a "Ship to me" / "Pick up in Ottawa" choice the customer makes BEFORE any delivery rate
 * is even requested -- never as a value returned by this function.
 */
export class CanadaPostShippingProvider implements ShippingQuoteProvider {
  async getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]> {
    if (subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS) {
      return [{ id: "free", label: "Free Shipping", cents: 0 }];
    }

    // A malformed/non-Canadian address is the customer's input to fix -- this throws and
    // propagates to the caller (checkout API routes catch ShippingRateUnavailableError
    // specifically and return a 422 with this exact message), the same "the server re-validates,
    // never trusts the client" rule as postal code format elsewhere in checkout.
    assertValidCanadianAddress(address);

    // Checked before ever attempting a live rate call, same reasoning as the address check above:
    // a cart containing any item without an authoritative weight (today, that's every item --
    // migration 008 + its backfill haven't run) cannot be weighed accurately, so requesting a
    // real Canada Post rate for it would either fail against the API or, worse, under-quote a
    // real parcel. estimateParcelWeightLb() already returns null for exactly this case; this is
    // the one place that null gets turned into an honest, specific customer-facing message rather
    // than a generic failure.
    const parcelWeightLb = estimateParcelWeightLb(lines);
    if (parcelWeightLb === null) {
      throw new ShippingRateUnavailableError(
        "We don't have a shipping weight for everything in your cart yet — request a quote and we'll confirm shipping manually.",
      );
    }

    // Any failure here -- not configured yet, or a real Canada Post outage once this is live --
    // propagates as-is. It is NOT caught and degraded: the customer asked for delivery, delivery
    // could not be quoted, and that must block checkout with a clear reason, not quietly become a
    // pickup order they never chose.
    const liveRate = await fetchCanadaPostRate(address, subtotalCents);
    return [liveRate];
  }
}
