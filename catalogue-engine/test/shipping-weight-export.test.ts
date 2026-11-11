import { describe, it, expect } from 'vitest';
import { cheapestOrderableOffer, resolveShippingWeightLb } from '../scripts/export-products-for-frontend.mjs';

// Fixture shape matches exactly what fetchAllPublishedProducts()'s Prisma `include` requests for
// each variant's supplierOffers -- see export-products-for-frontend.mjs.
function offer({ cost, supplierId = 'sanmar-id', unitWeightLb = null, weightConfidence = null, isOrderable = true }) {
  return {
    wholesaleCost: cost,
    currency: 'CAD',
    isOrderable,
    supplierProduct: { supplierId, unitWeightLb, weightConfidence },
  };
}

describe('cheapestOrderableOffer -- weight data carried through', () => {
  it('carries the winning (cheapest orderable) offer\'s own weight data, not an unrelated offer\'s', () => {
    const variants = [
      {
        supplierOffers: [
          offer({ cost: 12, unitWeightLb: 0.5, weightConfidence: 'confirmed' }), // cheaper, no weight below beats it
          offer({ cost: 9, unitWeightLb: null, weightConfidence: null }),
        ],
      },
    ];
    const result = cheapestOrderableOffer(variants);
    expect(result.cost).toBe(9);
    expect(result.unitWeightLb).toBeNull();
  });

  it('picks up the cheapest offer\'s confirmed weight when it has one', () => {
    const variants = [
      { supplierOffers: [offer({ cost: 9, unitWeightLb: 0.35, weightConfidence: 'confirmed' })] },
    ];
    const result = cheapestOrderableOffer(variants);
    expect(result.unitWeightLb).toBe(0.35);
    expect(result.weightConfidence).toBe('confirmed');
  });

  it('ignores non-orderable offers entirely, including their weight data', () => {
    const variants = [
      {
        supplierOffers: [
          offer({ cost: 5, unitWeightLb: 0.1, weightConfidence: 'confirmed', isOrderable: false }),
          offer({ cost: 9, unitWeightLb: 0.4, weightConfidence: 'confirmed' }),
        ],
      },
    ];
    const result = cheapestOrderableOffer(variants);
    expect(result.cost).toBe(9);
    expect(result.unitWeightLb).toBe(0.4);
  });

  it('converts Prisma Decimal-like string weights to real numbers', () => {
    // Prisma returns Decimal fields as strings in some configurations -- resolveShippingWeightLb's
    // caller (cheapestOrderableOffer) must not pass a string through where a number is expected.
    const variants = [{ supplierOffers: [offer({ cost: 9, unitWeightLb: '0.4', weightConfidence: 'confirmed' })] }];
    const result = cheapestOrderableOffer(variants);
    expect(result.unitWeightLb).toBe(0.4);
    expect(typeof result.unitWeightLb).toBe('number');
  });
});

describe('resolveShippingWeightLb -- the authoritative-only export gate', () => {
  it('returns null when there is no cheapest offer at all (quote-required product)', () => {
    expect(resolveShippingWeightLb(null)).toBeNull();
  });

  it('returns null when the winning offer has no weight data', () => {
    expect(resolveShippingWeightLb({ unitWeightLb: null, weightConfidence: null })).toBeNull();
  });

  it('returns null for an "inferred"-confidence weight -- never exported as if supplier-certain', () => {
    expect(resolveShippingWeightLb({ unitWeightLb: 0.6, weightConfidence: 'inferred' })).toBeNull();
  });

  it('returns the real number for a "confirmed"-confidence weight', () => {
    expect(resolveShippingWeightLb({ unitWeightLb: 0.42, weightConfidence: 'confirmed' })).toBe(0.42);
  });
});
