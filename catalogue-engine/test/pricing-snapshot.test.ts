import { describe, it, expect } from 'vitest';
import { calculatePrice, type MarkupRuleInput } from '../src/pricing/engine.js';
import { buildPricingSnapshot } from '../src/pricing/snapshot.js';

const markupRule: MarkupRuleInput = {
  type: 'percentage',
  value: 0.4,
  appliesTo: 'blank_plus_printing',
  version: 'test-markup-v1',
};

describe('buildPricingSnapshot', () => {
  it('builds a snapshot payload from a priced breakdown', () => {
    const breakdown = calculatePrice({
      productType: 'apparel',
      quantity: 50,
      wholesaleCostPerUnit: 6.5,
      printLocations: 2,
      markupRule,
    });

    const snapshot = buildPricingSnapshot({
      supplierVariantOfferId: 'offer-1',
      supplierUsed: 'ss_activewear',
      productType: 'apparel',
      quantity: 50,
      printLocations: 2,
      decorationMethod: 'screen_print',
      surcharges: [],
      discounts: [],
      breakdown,
    });

    expect(snapshot.wholesaleCostAtCalc).toBe(6.5);
    expect(snapshot.quantityTier).toBe('36-70');
    expect(snapshot.finalUnitPrice).toBe(breakdown.finalUnitPrice);
    expect(snapshot.finalTotal).toBe(breakdown.finalTotal);
    expect(snapshot.printRuleVersion).toBe(breakdown.printRuleVersion);
    expect(snapshot.markupRuleVersion).toBe('test-markup-v1');
  });

  it('refuses to build a snapshot from a quote_required breakdown', () => {
    const breakdown = calculatePrice({
      productType: 'apparel',
      quantity: 50,
      wholesaleCostPerUnit: null,
      printLocations: 2,
      markupRule,
    });

    expect(() =>
      buildPricingSnapshot({
        supplierVariantOfferId: 'offer-1',
        supplierUsed: 'ss_activewear',
        productType: 'apparel',
        quantity: 50,
        printLocations: 2,
        decorationMethod: 'screen_print',
        surcharges: [],
        discounts: [],
        breakdown,
      }),
    ).toThrow(/quote_required/);
  });
});
