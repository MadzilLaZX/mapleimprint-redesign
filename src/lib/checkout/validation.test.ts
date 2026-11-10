import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail, validatePhone, validatePostalCode, formatCanadianPostalCode } from "./validation.ts";

test("validateEmail rejects empty and malformed addresses, accepts a real one", () => {
  assert.equal(validateEmail(""), "Enter your email address.");
  assert.equal(validateEmail("not-an-email"), "Enter a valid email address.");
  assert.equal(validateEmail("person@example.com"), null);
});

test("validatePhone requires at least 10 digits, ignoring formatting characters", () => {
  assert.equal(validatePhone(""), "Enter your phone number.");
  assert.equal(validatePhone("555-123"), "Enter a valid phone number.");
  assert.equal(validatePhone("(613) 981-4329"), null);
});

test("validatePostalCode enforces the real Canada Post format for CA addresses", () => {
  assert.equal(validatePostalCode("", "CA"), "Enter your postal code.");
  assert.equal(validatePostalCode("12345", "CA"), "Enter a valid Canadian postal code.");
  assert.equal(validatePostalCode("K1V 8B9", "CA"), null);
  assert.equal(validatePostalCode("k1v8b9", "CA"), null, "lowercase, no space must still pass");
});

test("validatePostalCode does not apply the Canadian regex to non-CA addresses", () => {
  // Only a non-empty check applies outside Canada today -- the site ships Canada-only (see this
  // function's own comment), so this just confirms it doesn't wrongly reject a non-CA value.
  assert.equal(validatePostalCode("90210", "US"), null);
});

test("formatCanadianPostalCode normalizes case and spacing", () => {
  assert.equal(formatCanadianPostalCode("k1v8b9"), "K1V 8B9");
  assert.equal(formatCanadianPostalCode("k1v 8b9"), "K1V 8B9");
  assert.equal(formatCanadianPostalCode("k1"), "K1");
});
