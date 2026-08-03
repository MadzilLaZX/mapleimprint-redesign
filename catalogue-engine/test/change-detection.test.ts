import { describe, it, expect } from 'vitest';
import { diffRecords, evaluateSafetyStop, DEFAULT_SAFETY_THRESHOLDS } from '../src/sync/change-detection.js';

describe('diffRecords', () => {
  it('classifies new, updated, and missing records correctly', () => {
    const existing = [
      { key: 'A', price: 10, inventoryQty: 5 },
      { key: 'B', price: 20, inventoryQty: 0 },
      { key: 'C', price: 5, inventoryQty: 12 },
    ];
    const incoming = [
      { key: 'A', price: 10, inventoryQty: 5 }, // unchanged
      { key: 'B', price: 25, inventoryQty: 0 }, // price increase
      // C missing entirely
      { key: 'D', price: 3, inventoryQty: 40 }, // new
    ];

    const summary = diffRecords(existing, incoming);
    expect(summary.newKeys).toEqual(['D']);
    expect(summary.missingKeys).toEqual(['C']);
    expect(summary.updatedCount).toBe(1);
    expect(summary.priceIncreases).toHaveLength(1);
    expect(summary.priceIncreases[0]).toMatchObject({ key: 'B', from: 20, to: 25 });
  });

  it('flags prices dropping to zero separately from ordinary price drops', () => {
    const existing = [{ key: 'A', price: 10 }];
    const incoming = [{ key: 'A', price: 0 }];
    const summary = diffRecords(existing, incoming);
    expect(summary.zeroedPrices).toEqual([{ key: 'A', from: 10 }]);
    expect(summary.priceDrops).toHaveLength(0);
  });

  it('flags inventory dropping to zero', () => {
    const existing = [{ key: 'A', inventoryQty: 20 }];
    const incoming = [{ key: 'A', inventoryQty: 0 }];
    const summary = diffRecords(existing, incoming);
    expect(summary.zeroedInventory).toEqual([{ key: 'A', from: 20 }]);
  });
});

describe('evaluateSafetyStop', () => {
  it('does not abort on a normal, small diff', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ key: `sku-${i}`, price: 10 }));
    const incoming = existing.map((e, i) => (i < 5 ? { ...e, price: 11 } : e));
    const summary = diffRecords(existing, incoming);
    const result = evaluateSafetyStop(summary, existing.length);
    expect(result.shouldAbort).toBe(false);
  });

  it('aborts when more than 30% of records go missing from the feed', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ key: `sku-${i}`, price: 10 }));
    const incoming = existing.slice(0, 60); // 40% missing
    const summary = diffRecords(existing, incoming);
    const result = evaluateSafetyStop(summary, existing.length);
    expect(result.shouldAbort).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/missing from feed/);
  });

  it('aborts when more than 20% of prices zero out', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ key: `sku-${i}`, price: 10 }));
    const incoming = existing.map((e, i) => (i < 25 ? { ...e, price: 0 } : e)); // 25% zeroed
    const summary = diffRecords(existing, incoming);
    const result = evaluateSafetyStop(summary, existing.length);
    expect(result.shouldAbort).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/zeroed out/);
  });

  it('flags (but does not abort for) a single large price increase', () => {
    const existing = [{ key: 'A', price: 10 }];
    const incoming = [{ key: 'A', price: 40 }]; // 4x, at/above 3x review threshold
    const summary = diffRecords(existing, incoming);
    const result = evaluateSafetyStop(summary, existing.length, DEFAULT_SAFETY_THRESHOLDS);
    expect(result.shouldAbort).toBe(false);
    expect(result.flaggedForReview).toEqual(['A']);
  });

  it('does not abort on the very first sync (existingCount 0)', () => {
    const incoming = [{ key: 'A', price: 10 }];
    const summary = diffRecords([], incoming);
    const result = evaluateSafetyStop(summary, 0);
    expect(result.shouldAbort).toBe(false);
  });
});
