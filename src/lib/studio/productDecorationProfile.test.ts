import { test } from "node:test";
import assert from "node:assert/strict";
import { familyFor, decorationProfileFor } from "./productDecorationProfile.ts";

test("personalized-engraving maps to the generic 'accessory' family, not the 'tee' default fallback", () => {
  // Before this fix, this categorySlug had no explicit branch in familyFor() and silently fell
  // through to "tee" -- the same misrouting bug class already fixed once for stickers. Locking
  // this in directly so a future refactor of familyFor() can't quietly reintroduce it.
  assert.equal(familyFor("personalized-engraving", "sublimation-gifts"), "accessory");
});

test("decorationProfileFor a personalized-engraving product offers exactly one STANDARD location (front) -- the same honest generic treatment as other photo-less gift products", () => {
  const profile = decorationProfileFor("personalized-engraving", "sublimation-gifts", false);
  const standard = profile.locations.filter((l) => l.status === "STANDARD");
  assert.deepEqual(standard.map((l) => l.id), ["front"]);
});
