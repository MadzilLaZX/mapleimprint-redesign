import type { ShippingAddressInput, ShippingOption, ShippingQuoteProvider } from "./shippingProvider";

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

// Throws deliberately rather than returning a guessed/flat rate - inventing a shipping fee here
// would violate the same "never fabricate a charge" rule as taxProvider.ts. Replace this body
// with a real call to Canada Post's Rating API once prerequisites 1 and 2 above are resolved.
async function fetchCanadaPostRate(
  _address: ShippingAddressInput,
  _subtotalCents: number,
): Promise<ShippingOption> {
  throw new Error(
    "Canada Post live rating is not configured yet - missing API credentials and/or package weight/dimension data. See canadaPostShippingProvider.ts header.",
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
    const options: ShippingOption[] = [OTTAWA_PICKUP_OPTION];

    if (subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS) {
      options.push({ id: "free", label: "Free Shipping", cents: 0 });
      return options;
    }

    const liveRate = await fetchCanadaPostRate(address, subtotalCents);
    options.push(liveRate);
    return options;
  }
}
