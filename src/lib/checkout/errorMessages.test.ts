import { test } from "node:test";
import assert from "node:assert/strict";
import { humanPaymentError } from "./errorMessages.ts";

// Pure, synchronous, no dependencies -- the one place a raw Square decline code could otherwise
// leak to a customer instead of a short, human-readable message. No test existed before now.

test("maps every known Square decline code to its own specific message, never the generic fallback", () => {
  const knownCodes = [
    "CARD_DECLINED",
    "CVV_FAILURE",
    "ADDRESS_VERIFICATION_FAILURE",
    "INSUFFICIENT_FUNDS",
    "CARD_EXPIRED",
    "INVALID_EXPIRATION",
    "GENERIC_DECLINE",
    "PAYMENT_LIMIT_EXCEEDED",
    "TRANSACTION_LIMIT",
  ];
  const fallback = humanPaymentError("totally-unknown-code-xyz");
  for (const code of knownCodes) {
    const message = humanPaymentError(code);
    assert.notEqual(message, fallback, `"${code}" unexpectedly fell through to the generic fallback message`);
    assert.ok(message.length > 0);
  }
});

test("an unknown code returns the generic fallback, never the raw code itself", () => {
  const message = humanPaymentError("SOME_FUTURE_SQUARE_CODE_NOT_YET_MAPPED");
  assert.doesNotMatch(message, /SOME_FUTURE_SQUARE_CODE_NOT_YET_MAPPED/);
  assert.match(message, /payment didn't go through|try again/i);
});

test("null/undefined/empty code all return the generic fallback rather than throwing", () => {
  const fallback = humanPaymentError(undefined);
  assert.equal(humanPaymentError(null), fallback);
  assert.equal(humanPaymentError(""), fallback);
});

test("every mapped message is customer-facing prose, never a raw SCREAMING_SNAKE_CASE code", () => {
  const codes = ["CARD_DECLINED", "CVV_FAILURE", "INSUFFICIENT_FUNDS", "CARD_EXPIRED"];
  for (const code of codes) {
    const message = humanPaymentError(code);
    assert.doesNotMatch(message, /^[A-Z_]+$/, `"${code}" mapped to a raw-looking code, not prose: "${message}"`);
  }
});
