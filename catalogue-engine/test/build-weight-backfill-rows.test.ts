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
  {
    // The real caseWidth=188 anomaly found live in S&S data (Columbia Powder Lite II jacket,
    // confirmed 2026-11-11) -- must still produce a row (its real, valid weight), but with the
    // bad dimension rejected, not the whole product skipped.
    supplierProductId: 'sp-ss-columbia-anomaly',
    supplierCode: 'ssactivewear',
    rawPayload: {
      sampleRow: { unitWeight: 1.2, caseWeight: 14.4, caseQty: 12, caseWidth: 188, caseHeight: 11.5, caseLength: 19 },
    },
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

  it('rejects the real Columbia jacket dimension anomaly while keeping its valid weight and case qty', () => {
    const rows = buildWeightBackfillRows(fixtures);
    const columbia = rows.find((r) => r.supplierProductId === 'sp-ss-columbia-anomaly')!;
    expect(columbia).toBeDefined(); // still produces a row -- a bad dimension doesn't void the whole product
    expect(columbia.unitWeightLb).toBe(1.2);
    expect(columbia.caseWeightLb).toBe(14.4);
    expect(columbia.caseQty).toBe(12);
    expect(columbia.caseLengthIn).toBeNull();
    expect(columbia.caseWidthIn).toBeNull();
    expect(columbia.caseHeightIn).toBeNull();
    expect(columbia.dimensionsConfidence).toBeNull();
  });

  it('is idempotent -- running it twice on the same input produces identical rows', () => {
    const first = buildWeightBackfillRows(fixtures);
    const second = buildWeightBackfillRows(fixtures);
    expect(second).toEqual(first);
  });

  it('never fabricates a value for a field the supplier payload did not provide -- missing stays null, not 0 or a guess', () => {
    const rows = buildWeightBackfillRows([
      { supplierProductId: 'sp-weight-only', supplierCode: 'sanmar', rawPayload: { sampleRow: { weight: 2 } } },
    ]);
    const row = rows[0];
    expect(row.caseWeightLb).toBeNull();
    expect(row.caseQty).toBeNull();
    expect(row.caseLengthIn).toBeNull();
    expect(row.caseWidthIn).toBeNull();
    expect(row.caseHeightIn).toBeNull();
    expect(row.dimensionsConfidence).toBeNull();
  });

  it('every output row touches only weight/dimension fields -- no pricing, inventory, or supplier-mapping field is ever present', () => {
    const rows = buildWeightBackfillRows(fixtures);
    const allowedKeys = new Set([
      'supplierProductId',
      'unitWeightLb',
      'caseWeightLb',
      'caseQty',
      'caseLengthIn',
      'caseWidthIn',
      'caseHeightIn',
      'weightConfidence',
      'dimensionsConfidence',
    ]);
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        expect(allowedKeys.has(key), `unexpected field "${key}" would risk touching unrelated data`).toBe(true);
      }
    }
  });
});
