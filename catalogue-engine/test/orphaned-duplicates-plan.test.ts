import { describe, it, expect } from 'vitest';
import { planUnpublish, ORPHAN_MASTER_PRODUCT_IDS, UNPUBLISH_TARGET_STATUS } from '../scripts/orphanedDuplicatesPlan.mjs';

describe('planUnpublish', () => {
  it('targets exactly the 13 investigated orphan ids, no more and no fewer', () => {
    const plan = planUnpublish();
    expect(plan.count).toBe(13);
    expect(plan.ids).toHaveLength(13);
  });

  it('never targets discontinued or blocked -- only the reversible hidden state', () => {
    expect(UNPUBLISH_TARGET_STATUS).toBe('hidden');
    expect(planUnpublish().targetStatus).toBe('hidden');
  });

  it('contains no duplicate ids (de-duplicated defensively even though the source has none)', () => {
    const plan = planUnpublish();
    expect(new Set(plan.ids).size).toBe(plan.ids.length);
  });

  it('is a pure, side-effect-free computation -- calling it twice returns equal plans', () => {
    expect(planUnpublish()).toEqual(planUnpublish());
  });

  it('the exported id list is frozen (cannot be mutated by an importer)', () => {
    expect(Object.isFrozen(ORPHAN_MASTER_PRODUCT_IDS)).toBe(true);
    expect(() => {
      ORPHAN_MASTER_PRODUCT_IDS.push('not-a-real-id');
    }).toThrow();
  });
});
