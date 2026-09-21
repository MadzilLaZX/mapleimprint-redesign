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

export interface ShippingQuoteProvider {
  getOptions(address: ShippingAddressInput): Promise<ShippingOption[]>;
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
