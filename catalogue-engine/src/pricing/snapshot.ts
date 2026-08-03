// Builds the append-only PricingSnapshot payload from a calculation result. Persistence (the
// actual Prisma insert) belongs in the app layer, not here — this stays pure so tests don't need
// a database. See prisma/schema.prisma's PricingSnapshot model and its header comment: these
// rows are never updated once created, and old orders must never be recalculated with new rules.

import type { PriceBreakdown, ProductType } from './engine.js';
import type { Surcharge } from './engine.js';

export interface BuildSnapshotInput {
  supplierVariantOfferId: string;
  supplierUsed: string;
  productType: ProductType;
  quantity: number;
  printLocations: number;
  decorationMethod: string;
  surcharges: Surcharge[];
  discounts: { type: string; amount: number }[];
  breakdown: PriceBreakdown;
}

export interface PricingSnapshotPayload {
  supplierVariantOfferId: string;
  supplierUsed: string;
  wholesaleCostAtCalc: number;
  printRuleVersion: string;
  markupRuleVersion: string;
  quantityTier: string;
  printLocations: number;
  decorationMethod: string;
  surcharges: { type: string; amount: number }[];
  discounts: { type: string; amount: number }[];
  finalUnitPrice: number;
  finalTotal: number;
}

/**
 * Throws rather than returning a partial snapshot — a quote_required breakdown has no business
 * being persisted as a priced snapshot. Callers must only invoke this once calculatePrice()
 * returns status: 'priced'.
 */
export function buildPricingSnapshot(input: BuildSnapshotInput): PricingSnapshotPayload {
  const { breakdown } = input;

  if (breakdown.status !== 'priced') {
    throw new Error(
      `cannot build a pricing snapshot from a quote_required breakdown: ${breakdown.reasons.join('; ')}`,
    );
  }

  if (
    breakdown.blankCostPerUnit === null ||
    breakdown.finalUnitPrice === null ||
    breakdown.finalTotal === null ||
    breakdown.quantityTierLabel === null ||
    breakdown.markupRuleVersion === null
  ) {
    // Defensive — status === 'priced' should already guarantee this, but never persist a
    // snapshot with a silently-null field.
    throw new Error('priced breakdown is missing a required field for snapshotting');
  }

  return {
    supplierVariantOfferId: input.supplierVariantOfferId,
    supplierUsed: input.supplierUsed,
    wholesaleCostAtCalc: breakdown.blankCostPerUnit,
    printRuleVersion: breakdown.printRuleVersion,
    markupRuleVersion: breakdown.markupRuleVersion,
    quantityTier: breakdown.quantityTierLabel,
    printLocations: input.printLocations,
    decorationMethod: input.decorationMethod,
    surcharges: input.surcharges,
    discounts: input.discounts,
    finalUnitPrice: breakdown.finalUnitPrice,
    finalTotal: breakdown.finalTotal,
  };
}
