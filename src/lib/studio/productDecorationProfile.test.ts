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

test("jackets-outerwear maps to its own 'jacket' family, not 'hoodie'", () => {
  // Before this fix, jackets shared "hoodie" and incorrectly inherited "Hood" and "Pocket" as
  // decoration locations -- most jackets have neither.
  assert.equal(familyFor("custom-apparel", "jackets-outerwear"), "jacket");
});

test("the jacket family offers front/back/chest/sleeve/neck locations but never Hood or Pocket", () => {
  const profile = decorationProfileFor("custom-apparel", "jackets-outerwear", true);
  const ids = profile.locations.map((l) => l.id);
  assert.ok(!ids.includes("hood"), "jackets must not offer a Hood decoration location");
  assert.ok(!ids.includes("pocket"), "jackets must not offer a Pocket decoration location");
  // Still gets the same real STANDARD locations hoodies/tees have -- this is a narrower location
  // LIST, not a downgrade in print-area quality.
  const standard = profile.locations.filter((l) => l.status === "STANDARD");
  assert.deepEqual(standard.map((l) => l.id), ["front", "back", "left-chest"]);
});

test("hoodies-sweatshirts still maps to 'hoodie' and keeps Hood/Pocket -- the split didn't remove them from the garment that actually has both", () => {
  assert.equal(familyFor("custom-apparel", "hoodies-sweatshirts"), "hoodie");
  const ids = decorationProfileFor("custom-apparel", "hoodies-sweatshirts", true).locations.map((l) => l.id);
  assert.ok(ids.includes("hood"));
  assert.ok(ids.includes("pocket"));
});
