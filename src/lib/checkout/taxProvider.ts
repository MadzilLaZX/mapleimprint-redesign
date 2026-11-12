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
 * Real GST/HST/PST calculation. Rates come from canadianTaxRates.ts, sourced from the CRA's
 * published rate table, not invented. Destination-based on the shipping province for delivery
 * orders, with an Ontario point-of-sale override for Ottawa local pickup (isPickup) — both the
 * standard CRA place-of-supply rules. Tax is computed on subtotal + shipping together, since a
 * vendor-supplied shipping charge is taxed the same way as the goods it delivers, not as a
 * separate supply.
 *
 * `pstQstEnabled` (default false): the owner has confirmed the 13% Ontario HST rate and
 * authorized GST/HST activation, but GST/HST registration covers HST (ON/NB/NL/NS/PE) and GST-only
 * provinces/territories (AB/YT/NT/NU) under ONE federal registration -- it does NOT cover BC/SK/MB's
 * provincial PST or Quebec's QST, each of which needs ITS OWN separate registration with that
 * province/Revenu Québec. Until that separate confirmation happens, a GST_PST-type province is
 * charged GST only (PST/QST withheld) rather than a tax the business has no confirmed authority to
 * collect. This is intentionally NOT the same gate as the Production/Preview one below — even in
 * an environment where GST/HST is active, PST/QST stays off until separately approved.
 */
export class CanadianSalesTaxProvider implements TaxProvider {
  private readonly pstQstEnabled: boolean;

  constructor(pstQstEnabled: boolean = false) {
    this.pstQstEnabled = pstQstEnabled;
  }

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
      if (!this.pstQstEnabled) {
        return { taxCents: gstCents, breakdown: [{ label: "GST", cents: gstCents }] };
      }
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

/**
 * Production stays on ZeroTaxProvider regardless of how this code is deployed -- confirming the
 * 13% Ontario HST *rate* is not the same as confirming the business is GST/HST-registered and
 * obligated/authorized to actually collect it, and that registration status has NOT been
 * confirmed. `vercelEnv` should always be `process.env.VERCEL_ENV` in real use (a plain parameter,
 * not read internally, specifically so this decision is unit-testable without mocking
 * process.env or re-importing the module) -- Vercel's own system variable that is "production"
 * only for the Production domain, "preview" for every other deployment, and unset for local
 * dev/`npm test`. Deliberately NOT NODE_ENV, which Next.js sets to "production" for every built
 * deployment INCLUDING Preview and would not create the needed distinction.
 *
 * PST/QST stays disabled (see CanadianSalesTaxProvider's own comment) until Maple separately
 * confirms BC/SK/MB/QC registration -- only the federal GST/HST decision has been confirmed so far.
 *
 * Flipping Production on for real requires a deliberate, separate code change once registration
 * is confirmed -- not a config/env-var toggle, so it can't be flipped by mistake via Vercel
 * project settings.
 */
export function resolveTaxProvider(vercelEnv: string | undefined): TaxProvider {
  return vercelEnv === "production" ? new ZeroTaxProvider() : new CanadianSalesTaxProvider(false);
}

export const taxProvider: TaxProvider = resolveTaxProvider(process.env.VERCEL_ENV);
