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
// 2. Package weight and dimensions. Verified (grepped src/lib/generated/products.json and the
//    whole houseProducts catalogue) - no product anywhere carries a weight or dimension field.
//    Canada Post's rating API requires per-package weight and dimensions; without this, no real
//    quote can be requested regardless of credentials. This needs sourcing from S&S/SanMar/Joto
//    supplier data, or Maple Imprint's own measurements for house-decorated items, before
//    fetchCanadaPostRate() below can do anything but throw.

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
