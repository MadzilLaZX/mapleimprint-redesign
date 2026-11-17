import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowImageFallback } from "./productImageFallback.ts";

test("a missing URL (null) shows the fallback", () => {
  assert.equal(shouldShowImageFallback(null, false), true);
});

test("a missing URL (undefined) shows the fallback", () => {
  assert.equal(shouldShowImageFallback(undefined, false), true);
});

test("an empty-string URL shows the fallback, not a broken src=\"\"", () => {
  assert.equal(shouldShowImageFallback("", false), true);
});

test("a real URL that hasn't failed to load shows the real image, not the fallback", () => {
  assert.equal(shouldShowImageFallback("https://media.sanmarcanada.com/a.jpg", false), false);
});

test("a real URL that HAS failed to load (onError already fired) shows the fallback", () => {
  assert.equal(shouldShowImageFallback("https://cdn.ssactivewear.com/a.jpg", true), true);
});

test("a missing URL AND a failed flag together still correctly show the fallback (not an XOR)", () => {
  assert.equal(shouldShowImageFallback(null, true), true);
});
