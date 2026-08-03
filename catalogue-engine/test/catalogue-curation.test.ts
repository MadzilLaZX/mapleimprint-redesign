import { describe, it, expect } from 'vitest';
import { isValidTransition, PRODUCT_STATUS_TRANSITIONS } from '../src/catalogue/curation.js';

describe('isValidTransition — pure state machine rules', () => {
  it('allows the normal happy path: imported -> needs_review -> approved -> published', () => {
    expect(isValidTransition('imported', 'needs_review')).toBe(true);
    expect(isValidTransition('needs_review', 'approved')).toBe(true);
    expect(isValidTransition('approved', 'published')).toBe(true);
  });

  it('never allows a same-status "transition"', () => {
    for (const status of Object.keys(PRODUCT_STATUS_TRANSITIONS) as (keyof typeof PRODUCT_STATUS_TRANSITIONS)[]) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it('forbids skipping review entirely: imported straight to published', () => {
    expect(isValidTransition('imported', 'published')).toBe(false);
  });

  it('requires re-review after unblocking: blocked can only go to needs_review, never straight to published', () => {
    expect(isValidTransition('blocked', 'needs_review')).toBe(true);
    expect(isValidTransition('blocked', 'published')).toBe(false);
    expect(isValidTransition('blocked', 'approved')).toBe(false);
  });

  it('treats discontinued as terminal except for blocked', () => {
    expect(isValidTransition('discontinued', 'blocked')).toBe(true);
    expect(isValidTransition('discontinued', 'published')).toBe(false);
    expect(isValidTransition('discontinued', 'approved')).toBe(false);
    expect(isValidTransition('discontinued', 'imported')).toBe(false);
  });

  it('allows published <-> hidden toggling, both directions', () => {
    expect(isValidTransition('published', 'hidden')).toBe(true);
    expect(isValidTransition('hidden', 'published')).toBe(true);
  });

  it('every status can reach blocked (an admin override should always be possible)', () => {
    for (const status of Object.keys(PRODUCT_STATUS_TRANSITIONS) as (keyof typeof PRODUCT_STATUS_TRANSITIONS)[]) {
      if (status === 'blocked') continue;
      expect(PRODUCT_STATUS_TRANSITIONS[status]).toContain('blocked');
    }
  });
});
