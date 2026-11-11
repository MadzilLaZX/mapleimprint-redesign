import { describe, it, expect } from 'vitest';
import { mergeImageManifest } from '../src/images/manifest.js';

// All URLs here are synthetic fixtures -- not real supplier or storage URLs -- per the
// instruction to test image infrastructure without touching any real/restricted media.

describe('mergeImageManifest', () => {
  it('adds new entries to an empty manifest', () => {
    const result = mergeImageManifest({}, [
      { sourceUrl: 'https://supplier.test/a.jpg', hostedUrl: 'https://storage.test/a.jpg' },
    ]);
    expect(result.manifest).toEqual({ 'https://supplier.test/a.jpg': 'https://storage.test/a.jpg' });
    expect(result.added).toEqual(['https://supplier.test/a.jpg']);
    expect(result.unchanged).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('preserves existing entries not touched by the update (e.g. unrelated SanMar entries)', () => {
    const existing = { 'https://sanmar.test/existing.jpg': 'https://storage.test/existing.jpg' };
    const result = mergeImageManifest(existing, [
      { sourceUrl: 'https://ssactivewear.test/new.jpg', hostedUrl: 'https://storage.test/new.jpg' },
    ]);
    expect(result.manifest['https://sanmar.test/existing.jpg']).toBe('https://storage.test/existing.jpg');
    expect(result.manifest['https://ssactivewear.test/new.jpg']).toBe('https://storage.test/new.jpg');
    expect(result.added).toEqual(['https://ssactivewear.test/new.jpg']);
  });

  it('treats a re-applied identical mapping as unchanged, not an error (idempotent)', () => {
    const existing = { 'https://supplier.test/a.jpg': 'https://storage.test/a.jpg' };
    const result = mergeImageManifest(existing, [
      { sourceUrl: 'https://supplier.test/a.jpg', hostedUrl: 'https://storage.test/a.jpg' },
    ]);
    expect(result.unchanged).toEqual(['https://supplier.test/a.jpg']);
    expect(result.added).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('flags a conflicting re-mapping instead of silently overwriting it', () => {
    const existing = { 'https://supplier.test/a.jpg': 'https://storage.test/old.jpg' };
    const result = mergeImageManifest(existing, [
      { sourceUrl: 'https://supplier.test/a.jpg', hostedUrl: 'https://storage.test/different.jpg' },
    ]);
    expect(result.conflicts).toEqual([
      { sourceUrl: 'https://supplier.test/a.jpg', existingHostedUrl: 'https://storage.test/old.jpg', attemptedHostedUrl: 'https://storage.test/different.jpg' },
    ]);
    // The manifest itself is NOT mutated for a conflicting entry -- old value stays authoritative.
    expect(result.manifest['https://supplier.test/a.jpg']).toBe('https://storage.test/old.jpg');
  });

  it('handles a mixed batch of add/unchanged/conflict in one call independently', () => {
    const existing = {
      'https://supplier.test/keep.jpg': 'https://storage.test/keep.jpg',
      'https://supplier.test/conflict.jpg': 'https://storage.test/original.jpg',
    };
    const result = mergeImageManifest(existing, [
      { sourceUrl: 'https://supplier.test/keep.jpg', hostedUrl: 'https://storage.test/keep.jpg' }, // unchanged
      { sourceUrl: 'https://supplier.test/conflict.jpg', hostedUrl: 'https://storage.test/changed.jpg' }, // conflict
      { sourceUrl: 'https://supplier.test/brand-new.jpg', hostedUrl: 'https://storage.test/brand-new.jpg' }, // added
    ]);
    expect(result.unchanged).toEqual(['https://supplier.test/keep.jpg']);
    expect(result.conflicts).toHaveLength(1);
    expect(result.added).toEqual(['https://supplier.test/brand-new.jpg']);
    expect(Object.keys(result.manifest)).toHaveLength(3);
  });

  it('does not mutate the input existing manifest object', () => {
    const existing = { 'https://supplier.test/a.jpg': 'https://storage.test/a.jpg' };
    const existingCopy = { ...existing };
    mergeImageManifest(existing, [
      { sourceUrl: 'https://supplier.test/b.jpg', hostedUrl: 'https://storage.test/b.jpg' },
    ]);
    expect(existing).toEqual(existingCopy);
  });
});
