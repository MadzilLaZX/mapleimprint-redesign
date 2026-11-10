import type { ShippingAddressInput, ShippingOption, ShippingQuoteProvider } from "./shippingProvider";
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
// NOT READY TO ACTIVATE - two remaining gaps (a third, the getOptions() interface needing the
// order subtotal, was closed 2026-11-10: ShippingQuoteProvider.getOptions() now takes subtotalCents
// on every implementation, and both call sites pass it, with zero behavior change to the live
// FreeShippingProvider -- CanadaPostShippingProvider below implements that same interface
// directly, so activating this is now a literal one-line export swap):
//
// 1. Canada Post Developer Program credentials. None exist in this codebase (grepped, no
//    CANADA_POST env var anywhere, unlike SQUARE/RESEND). Needed: a Canada Post
//    Commercial/Developer account, API key plus customer number (plus contract ID if using
//    negotiated rates), and the shipping-origin address (Maple Imprint's Ottawa facility,
//    assuming the "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9" address already shown in
//    the site footer is also the ship-from location).
//
// 2. Package weight and dimensions — PARTIALLY RESOLVED 2026-11-10. The source data exists:
//    SupplierProduct.rawPayload already carries a confirmed per-piece weight (pounds) for 671/671
//    SanMar and 1102/1102 S&S products in the live DB today — it was ingested all along, just
//    never read. S&S additionally carries confirmed case weight and (lower-confidence, unit not
//    explicitly documented — see normalizeWeight.ts) case dimensions. See
//    catalogue-engine/src/shipping/normalizeWeight.ts for the extraction + confidence labelling,
//    and catalogue-engine/.../006_supplier_product_weight.sql (prepared, not applied) for the
//    schema this would land in.
//    What's still missing: (a) that data hasn't been promoted from SupplierProduct.rawPayload
//    into MasterProduct/ProductVariant/the generated CatalogueProduct shape checkout actually
//    reads — the migration above is schema-only, population is a separate, not-yet-approved step;
//    (b) Joto drinkware and all house-produced (banner/sticker/business-card/etc.) products have
//    no supplier weight source at all and would need Maple's own measurements; (c) no product
//    anywhere carries a per-unit *dimension*, only S&S's per-case dimensions. estimateParcelWeightLb
//    below is ready for real cart data the moment any of this lands; it is not wired to checkout.

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

/** Sums per-line weight for a Canada Post parcel request. Pure and ready to use the moment cart
 *  lines carry a real unitWeightLb (see header note above) — not called from anywhere yet, since
 *  no cart line has that field today. Returns null (not 0) when any line is missing a weight,
 *  so a caller can't silently request a rate against an under-counted parcel. */
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

export class CanadaPostShippingProvider implements ShippingQuoteProvider {
  async getOptions(address: ShippingAddressInput, subtotalCents: number): Promise<ShippingOption[]> {
    // Ottawa pickup is always offered regardless of order size -- built first so it's still part
    // of `options` even if everything below it fails to produce a live rate.
    const options: ShippingOption[] = [OTTAWA_PICKUP_OPTION];

    if (subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS) {
      options.push({ id: "free", label: "Free Shipping", cents: 0 });
      return options;
    }

    // A malformed/non-Canadian address is the customer's input to fix, not something to degrade
    // around silently -- this throws and propagates to the caller (checkout API routes catch
    // ShippingRateUnavailableError specifically and return a 422 with this exact message), the
    // same "the server re-validates, never trusts the client" rule as postal code format
    // elsewhere in checkout.
    assertValidCanadianAddress(address);

    try {
      const liveRate = await fetchCanadaPostRate(address, subtotalCents);
      options.push(liveRate);
    } catch (err) {
      if (!(err instanceof ShippingRateUnavailableError)) throw err; // a genuinely unexpected failure still propagates
      // A valid address but no live rate available (not configured yet, missing parcel data, or
      // a real Canada Post outage once this is live) is not the customer's fault and must not
      // block checkout entirely -- they can still choose Ottawa pickup.
    }
    return options;
  }
}
