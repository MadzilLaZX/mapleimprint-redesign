// Pure pricing calculator. No DB dependency — takes rule data as input (defaults to the seed
// data in ./rules/seed-data.ts) so it's fully unit-testable and so a future admin-managed
// PricingRule table can be swapped in without touching this function's logic.
//
// Deliberately does NOT assume a price is always calculable: missing wholesale cost, missing
// print rules for a product type, or an unconfigured markup all resolve to `quote_required`
// rather than a fabricated number. See architecture doc §"Current Pricing Disclaimer" —
// the system must never claim a price is final when required inputs are missing.
//
// --- 2026-09-24 CORRECTION: "40%" is a MARGIN target, not a MARKUP multiplier ---
// `type: 'percentage'` previously computed retail = cost * (1 + value) — a MARKUP. A 0.4 rule
// turned a $20 cost into $28, which is only a 28.6% gross margin ((28-20)/28), not the 40% margin
// the client's pricing brief explicitly specifies with a worked example
// (requiredRetail = cost / (1 - 0.40) = cost / 0.60). The only prior "evidence" this file had for
// markup was its OWN earlier comment paraphrasing a previous, less precise brief as "wholesale x
// markup" — not a preserved client quote — so per the new brief's own instruction ("unless there
// is evidence the client meant markup, implement the literal instruction: 40% gross margin"),
// this is corrected here to true gross margin. `MarkupRuleInput`/the DB's `MarkupRule` model keep
// their existing names (renaming a live column needs a real migration this session has no access
// to run) — but `type: 'percentage'` now means "target gross margin fraction" everywhere it's
// read. The already-seeded value (0.4) needs NO data change: 0.4 meant "40%" before and still
// means "40%" now, only the formula applied to it changed. Phase 3's ".99 rounding" rule is
// applied here too (roundUpTo99), scoped to the public BLANK retail component only — printing/
// decoration costs are never touched by either the margin or the .99 rule.

import {
  APPAREL_PRINT_TIERS,
  HAT_PRINT_TIERS,
  MUG_PRINT_TIERS,
  findTier,
  PRINT_RULE_VERSION,
} from './rules/seed-data.js';

export type ProductType = 'apparel' | 'hat' | 'mug';
export type MarkupType = 'percentage' | 'fixed';
export type MarkupAppliesTo = 'blank' | 'blank_plus_printing' | 'subtotal';

export interface MarkupRuleInput {
  type: MarkupType;
  /** For type 'percentage': the TARGET GROSS MARGIN as a 0-1 fraction (e.g. 0.4 = 40% margin —
   *  requiredRetail = cost / (1 - value), NOT cost * (1 + value); see this file's 2026-09-24
   *  correction note above). For type 'fixed': a flat dollar amount added on top of `appliesTo`'s
   *  base. */
  value: number;
  appliesTo: MarkupAppliesTo;
  version: string;
}

export interface Surcharge {
  type: string; // 'rush' | 'complexity' | 'extra_colours' | 'oversized' | 'setup' | ...
  amount: number; // per-unit dollar amount
}

export interface PriceCalculationInput {
  productType: ProductType;
  quantity: number;
  /** null/undefined => cost not yet known, forces quote_required. Never assume $0. */
  wholesaleCostPerUnit: number | null | undefined;
  /**
   * Currency the wholesale cost was quoted in. Defaults to 'CAD' if omitted — suppliers may
   * quote in USD (architecture doc §10: "Currency handling... you need an explicit FX-conversion
   * policy... before the pricing engine can be trusted"). No FX policy exists yet, so rather than
   * silently treating a USD cost as CAD (a real fabrication risk — it would understate the true
   * cost whenever USD > CAD), a mismatch against `expectedCurrency` forces quote_required. Once
   * a real FX policy exists, pass a pre-converted wholesaleCostPerUnit and matching currency
   * instead of changing this refusal behavior.
   */
  wholesaleCostCurrency?: 'CAD' | 'USD';
  /** The business's home currency for pricing. Defaults to 'CAD'. */
  expectedCurrency?: 'CAD' | 'USD';
  supplierUsed?: string;
  /** Apparel/hat only. Must be >= 1. Mugs ignore this — see decorationMode. */
  printLocations?: number;
  /** Mugs only. */
  decorationMode?: 'one_side' | 'wrap_around';
  markupRule?: MarkupRuleInput;
  surcharges?: Surcharge[];
}

export interface PriceBreakdown {
  status: 'priced' | 'quote_required';
  reasons: string[];
  quantityTierLabel: string | null;
  printingCostPerUnit: number | null;
  /** Raw wholesale cost — INTERNAL ONLY, never expose this to a customer-facing surface. */
  blankCostPerUnit: number | null;
  /** The public-facing blank merchandise retail price: cost run through the margin target and
   *  Section 3's roundUpTo99() — only populated when the matched rule's `appliesTo` is 'blank'
   *  (the only mode any real caller uses today; see applyMarkup's doc comment for the other two
   *  modes' current limitation). Null for a 'fixed'-type rule with a non-'blank' appliesTo too. */
  blankRetail: number | null;
  /** Despite the name (kept to avoid a wider breaking rename across snapshot.ts/index.ts for a
   *  field whose ADDITIVE ROLE in finalUnitPrice is unchanged), this is now a MARGIN amount for
   *  percentage rules — see this file's 2026-09-24 correction note. */
  markupAmountPerUnit: number | null;
  surchargeTotalPerUnit: number;
  finalUnitPrice: number | null;
  finalTotal: number | null;
  printRuleVersion: string;
  markupRuleVersion: string | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Section 3's ".99 RETAIL PRICING RULE": raises `price` to the next price ending in .99 that
 *  never falls below it — i.e. if `price` is already <= that dollar's own .99, use that dollar's
 *  .99; otherwise move up to the NEXT dollar's .99. Integer-cents arithmetic throughout (no
 *  floating-point money math) so e.g. 38.00 reliably lands on 38.99, never drifts to 37.99 or
 *  38.98/39.00 from a stray floating-point rounding error. Examples: 37.73 -> 37.99, 37.99 ->
 *  37.99, 38.00 -> 38.99 (NOT 37.99 — that would violate the margin requirement). */
export function roundUpTo99(price: number): number {
  const cents = Math.round(price * 100);
  const dollars = Math.floor(cents / 100);
  const sameDollar99Cents = dollars * 100 + 99;
  const resultCents = cents <= sameDollar99Cents ? sameDollar99Cents : sameDollar99Cents + 100;
  return resultCents / 100;
}

function tierLabel(min: number, max: number | null): string {
  return max === null ? `${min}+` : `${min}-${max}`;
}

function calculatePrintingCost(input: PriceCalculationInput, reasons: string[]): {
  cost: number | null;
  label: string | null;
} {
  const { productType, quantity } = input;

  if (quantity < 1) {
    reasons.push('quantity must be at least 1');
    return { cost: null, label: null };
  }

  if (productType === 'apparel' || productType === 'hat') {
    const locations = input.printLocations ?? 1;
    if (locations < 1) {
      reasons.push('printLocations must be at least 1');
      return { cost: null, label: null };
    }

    if (productType === 'apparel') {
      const tier = findTier(APPAREL_PRINT_TIERS, quantity);
      if (!tier) {
        reasons.push(`no pricing tier defined for quantity ${quantity} (apparel)`);
        return { cost: null, label: null };
      }
      const cost = tier.firstPrintCost + tier.additionalLocationCost * (locations - 1);
      return { cost, label: tierLabel(tier.quantityMin, tier.quantityMax) };
    }

    const tier = findTier(HAT_PRINT_TIERS, quantity);
    if (!tier) {
      reasons.push(`no pricing tier defined for quantity ${quantity} (hat)`);
      return { cost: null, label: null };
    }
    const cost = tier.firstPrintCost + tier.secondPrintCost * (locations - 1);
    return { cost, label: tierLabel(tier.quantityMin, tier.quantityMax) };
  }

  if (productType === 'mug') {
    const tier = findTier(MUG_PRINT_TIERS, quantity);
    if (!tier) {
      reasons.push(`no pricing tier defined for quantity ${quantity} (mug)`);
      return { cost: null, label: null };
    }
    if (!input.decorationMode) {
      reasons.push('mug pricing requires decorationMode: one_side | wrap_around');
      return { cost: null, label: tierLabel(tier.quantityMin, tier.quantityMax) };
    }
    const cost = input.decorationMode === 'one_side' ? tier.oneSideCost : tier.wrapAroundCost;
    return { cost, label: tierLabel(tier.quantityMin, tier.quantityMax) };
  }

  reasons.push(`unknown productType: ${productType satisfies never}`);
  return { cost: null, label: null };
}

function applyMarkup(
  blankCost: number,
  printingCost: number,
  rule: MarkupRuleInput | undefined,
  reasons: string[],
): { adjustmentAmountPerUnit: number; blankRetail: number | null } | null {
  if (!rule) {
    reasons.push('no pricing rule configured — cannot determine a final customer price');
    return null;
  }

  if (rule.type === 'fixed') {
    // Flat-dollar override — unaffected by the margin/markup correction (it was never a
    // percentage). Not additionally .99-rounded: a fixed rule is already a deliberately chosen
    // exact number, and Section 3's .99 rule only governs the margin-DERIVED blank retail price.
    const blankRetail = rule.appliesTo === 'blank' ? round2(blankCost + rule.value) : null;
    return { adjustmentAmountPerUnit: rule.value, blankRetail };
  }

  // type === 'percentage': target GROSS MARGIN (see this file's 2026-09-24 correction note).
  if (rule.value < 0 || rule.value >= 1) {
    reasons.push(`margin target ${rule.value} must be between 0 and 1 (exclusive) — a value >= 1 is impossible to satisfy`);
    return null;
  }
  const base =
    rule.appliesTo === 'blank'
      ? blankCost
      : blankCost + printingCost; // 'blank_plus_printing' and 'subtotal' — no real caller uses these today; see PriceBreakdown.blankRetail's doc comment
  const rawRetail = base / (1 - rule.value);

  if (rule.appliesTo === 'blank') {
    const blankRetail = roundUpTo99(rawRetail);
    return { adjustmentAmountPerUnit: round2(blankRetail - blankCost), blankRetail };
  }
  return { adjustmentAmountPerUnit: round2(rawRetail - base), blankRetail: null };
}

/**
 * Calculates a per-unit and total price, or explains why a quote is required instead.
 * Never returns a fabricated number when a required input is missing.
 */
export function calculatePrice(input: PriceCalculationInput): PriceBreakdown {
  const reasons: string[] = [];

  const { cost: printingCostPerUnit, label: quantityTierLabel } = calculatePrintingCost(
    input,
    reasons,
  );

  const blankCostPerUnit = input.wholesaleCostPerUnit ?? null;
  if (blankCostPerUnit === null) {
    reasons.push('wholesale cost not yet known for this variant/supplier');
  }

  const costCurrency = input.wholesaleCostCurrency ?? 'CAD';
  const expectedCurrency = input.expectedCurrency ?? 'CAD';
  if (blankCostPerUnit !== null && costCurrency !== expectedCurrency) {
    reasons.push(
      `wholesale cost is in ${costCurrency} but pricing expects ${expectedCurrency} — no FX conversion policy configured, refusing to guess a rate`,
    );
  }

  const surchargeTotalPerUnit = round2(
    (input.surcharges ?? []).reduce((sum, s) => sum + s.amount, 0),
  );

  let markupAmountPerUnit: number | null = null;
  let blankRetail: number | null = null;
  if (blankCostPerUnit !== null && printingCostPerUnit !== null) {
    const adjustment = applyMarkup(blankCostPerUnit, printingCostPerUnit, input.markupRule, reasons);
    if (adjustment) {
      markupAmountPerUnit = adjustment.adjustmentAmountPerUnit;
      blankRetail = adjustment.blankRetail;
    }
  }

  const canPrice =
    blankCostPerUnit !== null &&
    printingCostPerUnit !== null &&
    markupAmountPerUnit !== null &&
    reasons.length === 0;

  if (!canPrice) {
    return {
      status: 'quote_required',
      reasons,
      quantityTierLabel,
      printingCostPerUnit,
      blankCostPerUnit,
      blankRetail,
      markupAmountPerUnit,
      surchargeTotalPerUnit,
      finalUnitPrice: null,
      finalTotal: null,
      printRuleVersion: PRINT_RULE_VERSION,
      markupRuleVersion: input.markupRule?.version ?? null,
    };
  }

  // blankCost + adjustmentAmountPerUnit already equals blankRetail (when appliesTo === 'blank') —
  // this additive assembly is unchanged by the margin correction, since applyMarkup() returns
  // exactly the amount that makes it so. Printing/surcharges are added on top, never marked up or
  // .99-rounded themselves (Section "IMPORTANT": "Printing-table prices stay EXACTLY as provided").
  const finalUnitPrice = round2(
    blankCostPerUnit! + printingCostPerUnit! + markupAmountPerUnit! + surchargeTotalPerUnit,
  );
  const finalTotal = round2(finalUnitPrice * input.quantity);

  return {
    status: 'priced',
    reasons: [],
    quantityTierLabel,
    printingCostPerUnit,
    blankCostPerUnit,
    blankRetail,
    markupAmountPerUnit,
    surchargeTotalPerUnit,
    finalUnitPrice,
    finalTotal,
    printRuleVersion: PRINT_RULE_VERSION,
    markupRuleVersion: input.markupRule?.version ?? null,
  };
}
