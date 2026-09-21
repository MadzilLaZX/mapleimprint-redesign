export interface TaxCalculationInput {
  subtotalCents: number;
  shippingAddress: { province: string; country: string; postalCode: string };
}

export interface TaxCalculationResult {
  taxCents: number;
  breakdown: { label: string; cents: number }[];
}

export interface TaxProvider {
  calculate(input: TaxCalculationInput): Promise<TaxCalculationResult>;
}

/**
 * PRODUCTION LAUNCH BLOCKER: this always returns $0 tax. There is no tax-rate lookup anywhere in
 * this codebase (verified — no HST/GST/PST logic exists) and inventing one (e.g. hardcoding
 * Ontario's 13% HST) without Maple's/an accountant's sign-off risks under- or over-charging
 * customers and misreporting remittance. Do not launch real payments against this provider.
 *
 * Swapping in a real implementation later is a one-line change to the exported singleton below —
 * no caller (checkout quote endpoint, /api/checkout/pay) needs to change.
 */
class ZeroTaxProvider implements TaxProvider {
  async calculate(): Promise<TaxCalculationResult> {
    return { taxCents: 0, breakdown: [] };
  }
}

export const taxProvider: TaxProvider = new ZeroTaxProvider();
