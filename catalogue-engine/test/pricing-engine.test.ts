import { describe, it, expect } from 'vitest';
import { calculatePrice, roundUpTo99, type MarkupRuleInput } from '../src/pricing/engine.js';

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

  it('missing pricing rule forces quote_required even with a known cost and quantity', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 10,
      wholesaleCostPerUnit: 8,
      printLocations: 1,
    });
    expect(result.status).toBe('quote_required');
    expect(result.reasons.join(' ')).toMatch(/pricing rule/);
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

// --- 2026-09-24 pricing audit: 40% GROSS MARGIN (not markup) + .99 rounding ---
// See engine.ts's own top-of-file correction note for the full reasoning. These tests assert the
// literal formula from the client's brief: requiredRetail = cost / (1 - marginTarget).
describe('40% rule is GROSS MARGIN, not markup', () => {
  const margin40: MarkupRuleInput = { type: 'percentage', value: 0.4, appliesTo: 'blank', version: 'margin-test-v1' };

  it('$20 cost at 40% margin -> $33.34 blank retail (cost / 0.60, then .99-rounded up), NOT $28 (which would be markup)', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 1, // isolate the blank/margin math from any specific printing tier
      wholesaleCostPerUnit: 20,
      printLocations: 1,
      markupRule: margin40,
    });
    expect(result.status).toBe('priced');
    // 20 / 0.6 = 33.333... -> roundUpTo99 -> 33.99 (NOT 33.34; .99 rounding always lands on .99)
    expect(result.blankRetail).toBeCloseTo(33.99, 5);
    expect(result.blankRetail).not.toBeCloseTo(28.0, 5); // the old (wrong) markup answer
  });

  it('every margin-priced blank retail actually satisfies the 40% gross-margin floor', () => {
    for (const cost of [5, 12.34, 20, 47.5, 99.99]) {
      const result = calculatePrice({
        productType: 'apparel',
        quantity: 1,
        wholesaleCostPerUnit: cost,
        printLocations: 1,
        markupRule: margin40,
      });
      expect(result.status).toBe('priced');
      const margin = (result.blankRetail! - cost) / result.blankRetail!;
      // .99 rounding only ever pushes the price UP, so realized margin is always >= target, with
      // only trivial rounding tolerance in the other direction.
      expect(margin).toBeGreaterThanOrEqual(0.4 - 0.0001);
    }
  });

  it('printing/decoration cost is added on top of blank retail, never itself marked up or margin-adjusted', () => {
    const result = calculatePrice({
      productType: 'apparel',
      quantity: 3, // 3-10 tier: first print $18.00
      wholesaleCostPerUnit: 20,
      printLocations: 1,
      markupRule: margin40,
    });
    expect(result.status).toBe('priced');
    expect(result.printingCostPerUnit).toBeCloseTo(18.0, 5); // exact chart value, untouched
    expect(result.finalUnitPrice).toBeCloseTo(result.blankRetail! + 18.0, 5);
  });
});

describe('roundUpTo99 — Section 3 (.99 RETAIL PRICING RULE)', () => {
  const cases: [number, number][] = [
    [37.73, 37.99],
    [37.99, 37.99],
    [38.0, 38.99], // must NOT fall back to 37.99 — that would violate the margin requirement
    [12.01, 12.99],
    [12.98, 12.99],
    [12.99, 12.99],
    [13.0, 13.99],
    [0.0, 0.99],
    [100.0, 100.99],
  ];
  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      expect(roundUpTo99(input)).toBeCloseTo(expected, 5);
    });
  }

  it('never rounds DOWN below the input (the margin floor is never violated)', () => {
    for (const price of [0.01, 4.999, 19.999999, 250.001]) {
      expect(roundUpTo99(price)).toBeGreaterThanOrEqual(price - 0.0001);
    }
  });
});

describe('printing table covers all quantity/location boundaries required by the pricing audit', () => {
  const quantities = [1, 2, 3, 10, 11, 35, 36, 70, 71, 99, 100, 500];
  const locationCounts = [1, 2, 3, 4];

  for (const quantity of quantities) {
    for (const locations of locationCounts) {
      it(`apparel qty ${quantity}, ${locations} location(s) prices successfully`, () => {
        const result = calculatePrice({
          productType: 'apparel',
          quantity,
          wholesaleCostPerUnit: 10,
          printLocations: locations,
          markupRule: { type: 'percentage', value: 0.4, appliesTo: 'blank', version: 'v1' },
        });
        expect(result.status).toBe('priced');
        expect(result.printingCostPerUnit).toBeGreaterThan(0);
      });

      it(`hat qty ${quantity}, ${locations} location(s) prices successfully`, () => {
        const result = calculatePrice({
          productType: 'hat',
          quantity,
          wholesaleCostPerUnit: 5,
          printLocations: locations,
          markupRule: { type: 'percentage', value: 0.4, appliesTo: 'blank', version: 'v1' },
        });
        expect(result.status).toBe('priced');
        expect(result.printingCostPerUnit).toBeGreaterThan(0);
      });
    }
  }

  for (const quantity of quantities) {
    for (const decorationMode of ['one_side', 'wrap_around'] as const) {
      it(`mug qty ${quantity}, ${decorationMode} prices successfully`, () => {
        const result = calculatePrice({
          productType: 'mug',
          quantity,
          wholesaleCostPerUnit: 3,
          decorationMode,
          markupRule: { type: 'percentage', value: 0.4, appliesTo: 'blank', version: 'v1' },
        });
        expect(result.status).toBe('priced');
        expect(result.printingCostPerUnit).toBeGreaterThan(0);
      });
    }
  }
});
