import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyErrorMessage } from "./friendlyErrorMessage.ts";

test("a raw fetch-level network failure (TypeError) is replaced with a friendly, actionable message", () => {
  const err = new TypeError("Failed to fetch");
  assert.equal(friendlyErrorMessage(err, "fallback"), "Couldn't reach the server. Check your internet connection and try again.");
});

test("Firefox's network-failure wording is also a TypeError, caught the same way", () => {
  const err = new TypeError("NetworkError when attempting to fetch resource.");
  assert.equal(friendlyErrorMessage(err, "fallback"), "Couldn't reach the server. Check your internet connection and try again.");
});

test("a deliberate application error (plain Error, not TypeError) is shown verbatim, never swallowed", () => {
  const err = new Error("Enter a valid email address.");
  assert.equal(friendlyErrorMessage(err, "fallback"), "Enter a valid email address.");
});

test("a non-Error thrown value falls back to the caller's fallback message", () => {
  assert.equal(friendlyErrorMessage("some string", "fallback"), "fallback");
  assert.equal(friendlyErrorMessage(undefined, "fallback"), "fallback");
});
