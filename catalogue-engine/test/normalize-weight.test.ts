import { describe, it, expect } from 'vitest';
import {
  normalizeSanMarWeight,
  normalizeSSActivewearWeight,
  hasAuthoritativeUnitWeight,
  hasAuthoritativeCaseDimensions,
} from '../src/shipping/normalizeWeight.js';

// Fixtures below are REAL rawPayload rows read live from the maple-imprint-catalogue DB
// (SupplierProduct.rawPayload) on 2026-11-10 — not invented shapes.

describe('normalizeSanMarWeight', () => {
  it('extracts a confirmed per-piece weight in pounds, no case data', () => {
    const rawPayload = {
      sampleRow: {
        size: 'S',
        brand: 'The North Face®',
        style: 'NF0A3LGX',
        weight: 1.776,
        caseSize: '16',
        productId: '30867-2',
      },
    };
    const result = normalizeSanMarWeight(rawPayload);
    expect(result.supplierCode).toBe('sanmar');
    expect(result.unitWeightLb).toBe(1.776);
    expect(result.unitWeightConfidence).toBe('confirmed');
    expect(result.caseQty).toBe(16);
    expect(result.caseWeightLb).toBeNull();
    expect(result.caseDimensionsIn).toBeNull();
  });

  it('returns nulls rather than fabricating a value when weight is missing', () => {
    const result = normalizeSanMarWeight({ sampleRow: { style: 'X' } });
    expect(result.unitWeightLb).toBeNull();
    expect(result.unitWeightConfidence).toBeNull();
  });

  it('returns nulls for a malformed/empty payload rather than throwing', () => {
    expect(() => normalizeSanMarWeight(null)).not.toThrow();
    expect(normalizeSanMarWeight(null).unitWeightLb).toBeNull();
    expect(normalizeSanMarWeight(undefined).unitWeightLb).toBeNull();
  });
});

describe('normalizeSSActivewearWeight', () => {
  it('extracts confirmed unit/case weight and inferred case dimensions', () => {
    const rawPayload = {
      style: { title: "Women's Fusion Polo", styleID: 13876 },
      sampleRow: {
        sku: 'B17946104',
        unitWeight: 0.5417,
        caseWeight: 13,
        caseQty: 24,
        caseWidth: 11.03,
        caseHeight: 9.13,
        caseLength: 15.08,
      },
    };
    const result = normalizeSSActivewearWeight(rawPayload);
    expect(result.supplierCode).toBe('ssactivewear');
    expect(result.unitWeightLb).toBe(0.5417);
    expect(result.unitWeightConfidence).toBe('confirmed');
    expect(result.caseWeightLb).toBe(13);
    expect(result.caseQty).toBe(24);
    expect(result.caseDimensionsIn).toEqual({ length: 15.08, width: 11.03, height: 9.13 });
    // Dimensions are lower-confidence than weight -- unit isn't explicitly documented by S&S,
    // only inferred from physical plausibility. Callers must not treat these as equally certain.
    expect(result.caseDimensionsConfidence).toBe('inferred');
    expect(result.unitWeightConfidence).toBe('confirmed');
  });

  it('only returns dimensions when all three of length/width/height are present', () => {
    const result = normalizeSSActivewearWeight({
      sampleRow: { unitWeight: 0.5, caseWidth: 11, caseHeight: 9 /* caseLength missing */ },
    });
    expect(result.caseDimensionsIn).toBeNull();
    expect(result.caseDimensionsConfidence).toBeNull();
    expect(result.unitWeightLb).toBe(0.5); // weight extraction is independent of dimensions
  });

  it('never returns a zero or negative weight as if it were real', () => {
    const result = normalizeSSActivewearWeight({ sampleRow: { unitWeight: 0, caseWeight: -1 } });
    expect(result.unitWeightLb).toBeNull();
    expect(result.caseWeightLb).toBeNull();
  });

  it('rejects an implausible unit weight rather than trusting it blindly (e.g. a unit mixup)', () => {
    // A single garment reported at 90 lb is not a real piece weight -- this is the exact class of
    // bug (grams misread as pounds, a decoding error, a corrupt row) the sanity bound exists to
    // catch before it reaches a shipping quote.
    const result = normalizeSSActivewearWeight({ sampleRow: { unitWeight: 90 } });
    expect(result.unitWeightLb).toBeNull();
    expect(result.unitWeightConfidence).toBeNull();
  });

  it('rejects an implausible case dimension the same way', () => {
    const result = normalizeSSActivewearWeight({
      sampleRow: { caseWidth: 11, caseHeight: 9, caseLength: 9999 },
    });
    expect(result.caseDimensionsIn).toBeNull();
  });
});

describe('hasAuthoritativeUnitWeight / hasAuthoritativeCaseDimensions', () => {
  it('treats a confirmed SanMar weight as authoritative for a real shipping quote', () => {
    const result = normalizeSanMarWeight({ sampleRow: { weight: 1.5 } });
    expect(hasAuthoritativeUnitWeight(result)).toBe(true);
  });

  it('treats S&S case dimensions as NOT authoritative, even when present, because the unit is inferred', () => {
    const result = normalizeSSActivewearWeight({
      sampleRow: { unitWeight: 0.5, caseWidth: 11, caseHeight: 9, caseLength: 15 },
    });
    expect(result.caseDimensionsIn).not.toBeNull(); // the data exists...
    expect(hasAuthoritativeCaseDimensions(result)).toBe(false); // ...but must not be treated as certain
    expect(hasAuthoritativeUnitWeight(result)).toBe(true); // weight on the same product IS authoritative
  });

  it('returns false when there is nothing to be authoritative about', () => {
    const empty = normalizeSanMarWeight(null);
    expect(hasAuthoritativeUnitWeight(empty)).toBe(false);
    expect(hasAuthoritativeCaseDimensions(empty)).toBe(false);
  });
});
