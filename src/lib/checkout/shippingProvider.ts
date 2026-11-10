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

// subtotalCents is accepted (not yet used by FreeShippingProvider) so CanadaPostShippingProvider
// can implement this same interface directly -- activating it becomes swapping the export below,
// not a signature change propagated through every call site. See canadaPostShippingProvider.ts.
export interface ShippingQuoteProvider {
  getOptions(address: ShippingAddressInput, subtotalCents: number): Promise<ShippingOption[]>;
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
