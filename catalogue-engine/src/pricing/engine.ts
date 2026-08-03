// Pure pricing calculator. No DB dependency — takes rule data as input (defaults to the seed
// data in ./rules/seed-data.ts) so it's fully unit-testable and so a future admin-managed
// PricingRule table can be swapped in without touching this function's logic.
//
// Deliberately does NOT assume a price is always calculable: missing wholesale cost, missing
// print rules for a product type, or an unconfigured markup all resolve to `quote_required`
// rather than a fabricated number. See architecture doc §"Current Pricing Disclaimer" —
// the system must never claim a price is final when required inputs are missing.

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
  value: number; // percentage as 0-1 (e.g. 0.4 = 40%), or a flat dollar amount if type === 'fixed'
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
  blankCostPerUnit: number | null;
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
): number | null {
  if (!rule) {
    reasons.push('no markup rule configured — cannot determine a final customer price');
    return null;
  }

  const base =
    rule.appliesTo === 'blank'
      ? blankCost
      : rule.appliesTo === 'blank_plus_printing'
        ? blankCost + printingCost
        : blankCost + printingCost; // 'subtotal' resolved after surcharges by the caller

  if (rule.type === 'percentage') return base * rule.value;
  return rule.value; // fixed
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
  if (blankCostPerUnit !== null && printingCostPerUnit !== null) {
    markupAmountPerUnit = applyMarkup(blankCostPerUnit, printingCostPerUnit, input.markupRule, reasons);
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
      markupAmountPerUnit,
      surchargeTotalPerUnit,
      finalUnitPrice: null,
      finalTotal: null,
      printRuleVersion: PRINT_RULE_VERSION,
      markupRuleVersion: input.markupRule?.version ?? null,
    };
  }

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
    markupAmountPerUnit,
    surchargeTotalPerUnit,
    finalUnitPrice,
    finalTotal,
    printRuleVersion: PRINT_RULE_VERSION,
    markupRuleVersion: input.markupRule?.version ?? null,
  };
}
