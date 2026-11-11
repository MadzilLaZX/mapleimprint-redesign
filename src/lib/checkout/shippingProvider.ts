export interface ShippingAddressInput {
  province: string;
  country: string;
  postalCode: string;
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

// subtotalCents is accepted (not yet used by FreeShippingProvider) so CanadaPostShippingProvider
// can implement this same interface directly -- activating it becomes swapping the export below,
// not a signature change propagated through every call site. See canadaPostShippingProvider.ts.
// `lines` was added alongside unitWeightLb landing on PricedCartLine -- CanadaPostShippingProvider
// needs real per-line weight to call estimateParcelWeightLb(); FreeShippingProvider ignores it.
export interface ShippingQuoteProvider {
  getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]>;
}

/**
 * There are no approved carrier rates/zones anywhere in this codebase (verified — grepped the
 * whole repo). Per the non-negotiable "do not invent shipping prices" rule, this returns a single
 * Free Shipping option rather than a fabricated rate table. Real Canada Post/carrier rates are a
 * production-launch requirement, not implemented here — swapping them in is a change to this
 * file's implementation only, not to any caller.
 */
class FreeShippingProvider implements ShippingQuoteProvider {
  async getOptions(): Promise<ShippingOption[]> {
    return [{ id: "free", label: "Free Shipping", cents: 0 }];
  }
}

export const shippingProvider: ShippingQuoteProvider = new FreeShippingProvider();
