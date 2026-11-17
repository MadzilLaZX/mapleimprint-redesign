import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOrderReference } from "./generateOrderReference.ts";

// Pure, synchronous, no dependencies -- no excuse for this never having had a test before now.

test("always starts with the MO- prefix", () => {
  for (let i = 0; i < 20; i++) {
    assert.match(generateOrderReference(), /^MO-/);
  }
});

test("the token portion is exactly 8 characters from the documented base32 alphabet, excluding ambiguous characters", () => {
  // No 0/O/1/I anywhere -- the whole stated point of this alphabet (support/typing confusion).
  const AMBIGUOUS = /[01OI]/;
  for (let i = 0; i < 50; i++) {
    const ref = generateOrderReference();
    const token = ref.slice("MO-".length);
    assert.equal(token.length, 8, `expected an 8-character token, got "${token}"`);
    assert.doesNotMatch(token, AMBIGUOUS, `token "${token}" contains an ambiguous character`);
    assert.match(token, /^[A-Z2-9]+$/, `token "${token}" contains an unexpected character`);
  }
});

test("is not practically guessable/sequential -- repeated calls produce distinct values", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) seen.add(generateOrderReference());
  // Not a strict proof of randomness, just a sanity floor: 100 calls into ~40 bits of entropy
  // should never collide in practice.
  assert.equal(seen.size, 100, "expected 100 distinct references from 100 calls");
});
