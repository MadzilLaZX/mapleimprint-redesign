import { describe, it, expect } from 'vitest';
import { buildWeightBackfillRows, type SupplierProductForBackfill } from '../src/shipping/buildWeightBackfillRows.js';

// Representative fixtures: a real-shaped SanMar row, a real-shaped S&S row, a product with no
// usable weight/dimension data at all, and a malformed payload -- mirrors the actual mix found
// live in SupplierProduct (671/671 SanMar and 1102/1102 S&S products have usable data, but the
// builder must still behave correctly for the rows that don't, since this runs over the whole
// table when it's eventually approved to execute for real).
const fixtures: SupplierProductForBackfill[] = [
  {
    supplierProductId: 'sp-sanmar-1',
    supplierCode: 'sanmar',
    rawPayload: { sampleRow: { style: 'NF0A3LGX', weight: 1.776, caseSize: '16' } },
  },
  {
    supplierProductId: 'sp-ss-1',
    supplierCode: 'ssactivewear',
    rawPayload: {
      sampleRow: { sku: 'B17946104', unitWeight: 0.5417, caseWeight: 13, caseQty: 24, caseWidth: 11.03, caseHeight: 9.13, caseLength: 15.08 },
    },
  },
  {
    supplierProductId: 'sp-sanmar-no-data',
    supplierCode: 'sanmar',
    rawPayload: { sampleRow: { style: 'UNKNOWN' } }, // no weight field at all
  },
  {
    supplierProductId: 'sp-malformed',
    supplierCode: 'ssactivewear',
    rawPayload: null,
  },
];

describe('buildWeightBackfillRows', () => {
  it('produces one row per product that has usable data', () => {
    const rows = buildWeightBackfillRows(fixtures);
    const ids = rows.map((r) => r.supplierProductId);
    expect(ids).toContain('sp-sanmar-1');
    expect(ids).toContain('sp-ss-1');
  });

  it('skips products with no extractable weight or dimension data entirely', () => {
    const rows = buildWeightBackfillRows(fixtures);
    const ids = rows.map((r) => r.supplierProductId);
    expect(ids).not.toContain('sp-sanmar-no-data');
    expect(ids).not.toContain('sp-malformed');
  });

  it('correctly separates per-piece weight from case weight/dimensions per supplier', () => {
    const rows = buildWeightBackfillRows(fixtures);
    const sanmar = rows.find((r) => r.supplierProductId === 'sp-sanmar-1')!;
    expect(sanmar.unitWeightLb).toBe(1.776);
    expect(sanmar.weightConfidence).toBe('confirmed');
    expect(sanmar.caseWeightLb).toBeNull(); // SanMar's service never provides this
    expect(sanmar.caseLengthIn).toBeNull();

    const ss = rows.find((r) => r.supplierProductId === 'sp-ss-1')!;
    expect(ss.unitWeightLb).toBe(0.5417);
    expect(ss.caseWeightLb).toBe(13);
    expect(ss.caseQty).toBe(24);
    expect(ss.caseLengthIn).toBe(15.08);
    expect(ss.weightConfidence).toBe('confirmed');
    expect(ss.dimensionsConfidence).toBe('inferred'); // must stay distinguishable from weight's confidence
  });

  it('returns an empty array for an empty input, not an error', () => {
    expect(buildWeightBackfillRows([])).toEqual([]);
  });

  it('handles a large representative batch without error (671 SanMar + 1102 S&S scale)', () => {
    const big: SupplierProductForBackfill[] = [];
    for (let i = 0; i < 671; i++) {
      big.push({ supplierProductId: `sanmar-${i}`, supplierCode: 'sanmar', rawPayload: { sampleRow: { weight: 0.5 + (i % 10) } } });
    }
    for (let i = 0; i < 1102; i++) {
      big.push({
        supplierProductId: `ss-${i}`,
        supplierCode: 'ssactivewear',
        rawPayload: { sampleRow: { unitWeight: 0.4 + (i % 10), caseWeight: 10, caseWidth: 10, caseHeight: 10, caseLength: 10 } },
      });
    }
    const rows = buildWeightBackfillRows(big);
    expect(rows.length).toBe(671 + 1102);
  });
});
