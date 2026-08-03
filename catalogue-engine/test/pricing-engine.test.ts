import { describe, it, expect } from 'vitest';
import { calculatePrice, type MarkupRuleInput } from '../src/pricing/engine.js';

const flatMarkup: MarkupRuleInput = {
  type: 'percentage',
  value: 0.4,
  appliesTo: 'blank_plus_printing',
  version: 'test-markup-v1',
};

describe('apparel pricing — quantity tier boundaries', () => {
  // Boundary pairs explicitly required by the architecture doc's test plan.
  const cases: [number, number, number][] = [
    [2, 20.0, 5.0], // top of 1-2 tier
    [3, 18.0, 4.5], // bottom of 3-10 tier
    [10, 18.0, 4.5], // top of 3-10
    [11, 15.0, 4.0], // bottom of 11-35
    [35, 15.0, 4.0], // top of 11-35
    [36, 12.0, 3.5], // bottom of 36-70
    [70, 12.0, 3.5], // top of 36-70
    [71, 9.0, 3.25], // bottom of 71-99
    [99, 9.0, 3.25], // top of 71-99
    [100, 7.0, 3.0], // start of 100+
  ];

  for (const [quantity, expectedFirst, expectedAdditional] of cases) {
    it(`quantity ${quantity} uses first=${expectedFirst}, additional=${expectedAdditional}`, () => {
      const result = calculatePrice({
        productType: 'apparel',
        quantity,
        wholesaleCostPerUnit: 10,
        printLocations: 2,
        markupRule: flatMarkup,
      });
      expect(result.status).toBe('priced');
      expect(result.printingCostPerUnit).toBeCloseTo(expectedFirst + expectedAdditional, 5);
    });
  }

  it('50 hoodies, front+back print matches the worked example in the brief ($15.50 printing/unit)', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 50,
      wholesaleCostPerUnit: 0, // isolate printing cost only
      printLocations: 2,
      markupRule: { type: 'fixed', value: 0, appliesTo: 'blank', version: 'zero' },
    });
    expect(result.status).toBe('priced');
    expect(result.printingCostPerUnit).toBeCloseTo(15.5, 5);
  });

  it('single print location only charges the first-print cost, no additional-location cost', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 5,
      wholesaleCostPerUnit: 10,
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.printingCostPerUnit).toBeCloseTo(18.0, 5);
  });
});

describe('hat pricing — quantity tier boundaries', () => {
  const cases: [number, number, number][] = [
    [2, 12.0, 3.0],
    [3, 10.0, 2.5],
    [35, 8.0, 2.0],
    [36, 7.0, 1.75],
    [99, 6.5, 1.5],
    [100, 5.99, 1.0],
  ];

  for (const [quantity, first, second] of cases) {
    it(`quantity ${quantity} uses first=${first}, second=${second}`, () => {
      const result = calculatePrice({
        productType: 'hat',
        quantity,
        wholesaleCostPerUnit: 5,
        printLocations: 2,
        markupRule: flatMarkup,
      });
      expect(result.printingCostPerUnit).toBeCloseTo(first + second, 5);
    });
  }
});

describe('mug pricing — one-side vs wrap-around are independent options, not location count', () => {
  it('one-side at qty 5 uses the 3-10 tier one-side cost', () => {
    const result = calculatePrice({
      productType: 'mug',
      quantity: 5,
      wholesaleCostPerUnit: 3,
      decorationMode: 'one_side',
      markupRule: flatMarkup,
    });
    expect(result.printingCostPerUnit).toBeCloseTo(8.0, 5);
  });

  it('wrap-around at qty 5 uses the 3-10 tier wrap-around cost, not one-side', () => {
    const result = calculatePrice({
      productType: 'mug',
      quantity: 5,
      wholesaleCostPerUnit: 3,
      decorationMode: 'wrap_around',
      markupRule: flatMarkup,
    });
    expect(result.printingCostPerUnit).toBeCloseTo(12.0, 5);
  });

  it('missing decorationMode forces quote_required rather than guessing', () => {
    const result = calculatePrice({
      productType: 'mug',
      quantity: 5,
      wholesaleCostPerUnit: 3,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('quote_required');
    expect(result.reasons.join(' ')).toMatch(/decorationMode/);
  });
});

describe('quote_required states — never fabricate a price', () => {
  it('missing wholesale cost forces quote_required', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: null,
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('quote_required');
    expect(result.finalUnitPrice).toBeNull();
    expect(result.reasons.join(' ')).toMatch(/wholesale cost/);
  });

  it('missing markup rule forces quote_required even with a known cost and quantity', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      printLocations: 1,
    });
    expect(result.status).toBe('quote_required');
    expect(result.reasons.join(' ')).toMatch(/markup rule/);
  });

  it('quantity 0 is invalid and does not resolve to any tier', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 0,
      wholesaleCostPerUnit: 8,
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('quote_required');
  });
});

describe('currency mismatch — refuse to guess an FX rate', () => {
  it('a USD wholesale cost against CAD pricing (the default expected currency) forces quote_required', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      wholesaleCostCurrency: 'USD',
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('quote_required');
    expect(result.reasons.join(' ')).toMatch(/USD but pricing expects CAD/);
  });

  it('an explicit CAD cost against CAD pricing prices normally (no mismatch)', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      wholesaleCostCurrency: 'CAD',
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('priced');
  });

  it('omitting wholesaleCostCurrency defaults to CAD, matching existing behavior', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('priced');
  });

  it('an explicit USD expectedCurrency accepts a matching USD cost without forcing a quote', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      wholesaleCostCurrency: 'USD',
      expectedCurrency: 'USD',
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('priced');
  });

  it('does not flag a currency mismatch when wholesale cost is null (that reason already covers it)', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: null,
      wholesaleCostCurrency: 'USD',
      printLocations: 1,
      markupRule: flatMarkup,
    });
    expect(result.status).toBe('quote_required');
    expect(result.reasons.join(' ')).not.toMatch(/USD but pricing expects/);
  });
});

describe('final price composition', () => {
  it('sums blank cost + printing + markup + surcharges, times quantity', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10, // 3-10 tier: first 18.00, no second location
      wholesaleCostPerUnit: 10,
      printLocations: 1,
      markupRule: { type: 'fixed', value: 2, appliesTo: 'blank', version: 'v1' },
      surcharges: [{ type: 'rush', amount: 1.5 }],
    });
    // blank 10 + printing 18 + markup 2 (fixed) + surcharge 1.5 = 31.5/unit
    expect(result.status).toBe('priced');
    expect(result.finalUnitPrice).toBeCloseTo(31.5, 5);
    expect(result.finalTotal).toBeCloseTo(315.0, 5);
  });
});
