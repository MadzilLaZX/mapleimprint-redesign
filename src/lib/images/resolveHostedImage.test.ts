import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHostedImage } from "./resolveHostedImage.ts";

// Synthetic fixtures only -- never a real supplier or storage URL.

test("resolveHostedImage falls back to the source URL when no manifest entry exists (today's real state for every image)", () => {
  assert.equal(
    resolveHostedImage("https://supplier.test/a.jpg", {}),
    "https://supplier.test/a.jpg",
  );
});

test("resolveHostedImage prefers the hosted URL once a manifest entry exists", () => {
  const manifest = { "https://supplier.test/a.jpg": "https://storage.test/a.jpg" };
  assert.equal(resolveHostedImage("https://supplier.test/a.jpg", manifest), "https://storage.test/a.jpg");
});

test("resolveHostedImage leaves an unrelated SanMar-style URL as its own source when only a different (e.g. S&S) entry is hosted", () => {
  const manifest = { "https://ssactivewear.test/new.jpg": "https://storage.test/new.jpg" };
  assert.equal(
    resolveHostedImage("https://sanmar.test/still-direct.jpg", manifest),
    "https://sanmar.test/still-direct.jpg",
  );
});

test("resolveHostedImage uses the real imported manifest when no override is passed", () => {
  // Confirms the default-parameter wiring itself works, against today's real (empty) manifest --
  // not just the injected-fixture path exercised by the tests above.
  assert.equal(resolveHostedImage("https://supplier.test/unmapped.jpg"), "https://supplier.test/unmapped.jpg");
});
