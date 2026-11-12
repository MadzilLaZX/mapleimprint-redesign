// Explicit .ts extension -- required for plain `node --test` (this file's own test imports it
// directly), matching the convention already used in canadaPostShippingProvider.ts.
import { PROVINCE_TAX_RATES } from "./canadianTaxRates.ts";

export interface TaxCalculationInput {
  subtotalCents: number;
  /** The shipping charge actually billed to the customer (0 for free/pickup orders). GST/HST
   *  applies to a shipping charge the same way it applies to the goods it's delivering — a
   *  vendor-supplied delivery charge is not a separate, differently-taxed supply. */
  shippingCents: number;
  shippingAddress: { province: string; country: string; postalCode: string };
  /** True when the customer selected Ottawa local pickup rather than delivery. Pickup is a
   *  point-of-sale transaction physically completed at Maple's Ottawa facility, so Ontario HST
   *  applies regardless of the customer's own billing/shipping province or country — this is
   *  the CRA's place-of-supply override for goods picked up by the customer, not a shipped sale. */
  isPickup?: boolean;
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

/**
 * Real GST/HST/PST calculation, built and ready — NOT ACTIVATED (see `taxProvider` export below,
 * still `ZeroTaxProvider`). Rates come from canadianTaxRates.ts, sourced from the CRA's published
 * rate table, not invented. Destination-based on the shipping province for delivery orders, with
 * an Ontario point-of-sale override for Ottawa local pickup (isPickup) — both the standard CRA
 * place-of-supply rules. Tax is computed on subtotal + shipping together, since a vendor-supplied
 * shipping charge is taxed the same way as the goods it delivers, not as a separate supply.
 *
 * BEFORE enabling this (swapping the `taxProvider` export below), confirm with Maple/an
 * accountant:
 *   1. Is the business GST/HST-registered at all? A small supplier under the $30,000/year
 *      revenue threshold is NOT required to register and must NOT charge GST/HST until they do.
 *   2. Re-verify every rate in canadianTaxRates.ts against the current CRA table — provincial
 *      rates change (Nova Scotia's HST dropped 15%→14% in April 2025, as one example).
 *   3. Confirm whether Maple needs to separately register for QST (Revenu Québec) to sell to
 *      Quebec customers — a different regime from GST/HST registration.
 */
export class CanadianSalesTaxProvider implements TaxProvider {
  async calculate({ subtotalCents, shippingCents, shippingAddress, isPickup }: TaxCalculationInput): Promise<TaxCalculationResult> {
    const taxableCents = subtotalCents + shippingCents;

    // Pickup is completed in person at Maple's Ottawa facility — the sale happens in Ontario
    // regardless of whatever address the customer typed (home province, or none at all), so this
    // check runs before the country/province lookup below, not as a modifier to it.
    const province = isPickup ? "ON" : shippingAddress.province;
    const country = isPickup ? "CA" : shippingAddress.country;

    if (country !== "CA") return { taxCents: 0, breakdown: [] };
    const rate = PROVINCE_TAX_RATES[province];
    if (!rate) return { taxCents: 0, breakdown: [] };

    if (rate.type === "HST") {
      const cents = Math.round(taxableCents * (rate.hstRate as number));
      return { taxCents: cents, breakdown: [{ label: "HST", cents }] };
    }
    if (rate.type === "GST_PST") {
      const gstCents = Math.round(taxableCents * rate.gstRate);
      const pstCents = Math.round(taxableCents * (rate.pstRate as number));
      return {
        taxCents: gstCents + pstCents,
        breakdown: [
          { label: "GST", cents: gstCents },
          { label: rate.pstLabel as string, cents: pstCents },
        ],
      };
    }
    const gstCents = Math.round(taxableCents * rate.gstRate);
    return { taxCents: gstCents, breakdown: [{ label: "GST", cents: gstCents }] };
  }
}

// Exported above (for direct unit testing and the eventual one-line swap, see class comment) but
// not the live singleton below — activating it in Production needs the business confirmations
// listed on CanadianSalesTaxProvider's own comment first.
export const taxProvider: TaxProvider = new ZeroTaxProvider();
