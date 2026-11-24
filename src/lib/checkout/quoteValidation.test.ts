import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidQuoteEmail, safeQuoteLineQuantity } from "./quoteValidation.ts";

test("isValidQuoteEmail accepts a normal address", () => {
  assert.equal(isValidQuoteEmail("customer@example.com"), true);
});

test("isValidQuoteEmail rejects a malformed address that only the old presence-only check would have accepted", () => {
  assert.equal(isValidQuoteEmail("x"), false);
  assert.equal(isValidQuoteEmail("no-at-sign.com"), false);
  assert.equal(isValidQuoteEmail("missing-domain@"), false);
});

test("safeQuoteLineQuantity accepts a real positive integer", () => {
  assert.equal(safeQuoteLineQuantity(24), 24);
});

test("safeQuoteLineQuantity rejects zero, negative, and non-integer values -- never stores a clearly-wrong quantity", () => {
  assert.equal(safeQuoteLineQuantity(0), null);
  assert.equal(safeQuoteLineQuantity(-5), null);
  assert.equal(safeQuoteLineQuantity(2.5), null);
});

test("safeQuoteLineQuantity treats \"not provided\" (undefined) the same as invalid -- null either way, matching every other optional field", () => {
  assert.equal(safeQuoteLineQuantity(undefined), null);
  assert.equal(safeQuoteLineQuantity("24"), null);
});
