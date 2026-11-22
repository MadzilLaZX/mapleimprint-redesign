import { test } from "node:test";
import assert from "node:assert/strict";
import { projectTypeForHandoff } from "./quoteProjectType.ts";

// REGRESSION (2026-11-22): Studio's drinkware "Approve & Request a Quote" and the cart page's
// "Get a Quote" both hand a real cart/design context off to QuoteWizard via sessionStorage, but
// step 1 ("What's this project for?") previously always landed unselected regardless -- a real,
// reproducible UX gap found by actually driving the drinkware Studio -> Request a Quote flow in a
// real browser against Preview: the design WAS correctly carried through to step 2's product
// description, but step 1 gave no indication of it at all. This never skips step 1 (the customer
// still sees and can change the pre-selection) and never guesses when the category is ambiguous.

test("a single-category drinkware handoff maps to 'promo'", () => {
  assert.equal(projectTypeForHandoff([{ categorySlug: "drinkware" }]), "promo");
});

test("a single-category apparel handoff maps to 'apparel'", () => {
  assert.equal(projectTypeForHandoff([{ categorySlug: "custom-apparel" }]), "apparel");
});

test("multiple lines of the SAME category still map to that one category, not 'mixed'", () => {
  assert.equal(
    projectTypeForHandoff([{ categorySlug: "drinkware" }, { categorySlug: "drinkware" }]),
    "promo",
  );
});

test("lines spanning more than one distinct category map to 'mixed', never guessing one of them", () => {
  assert.equal(
    projectTypeForHandoff([{ categorySlug: "drinkware" }, { categorySlug: "custom-apparel" }]),
    "mixed",
  );
});

test("an unmapped/unrecognized category returns null rather than guessing", () => {
  assert.equal(projectTypeForHandoff([{ categorySlug: "packaging" }]), null);
});

test("an empty line list returns null", () => {
  assert.equal(projectTypeForHandoff([]), null);
});

test("every category covers the options actually listed in QuoteWizard's PROJECT_TYPE_OPTIONS", () => {
  const covered = ["custom-apparel", "workwear-uniforms", "business-printing", "signs-banners", "stickers-labels", "drinkware", "gifts-promo"];
  const expected = ["apparel", "uniforms", "print", "signs", "stickers", "promo", "promo"];
  covered.forEach((categorySlug, i) => {
    assert.equal(projectTypeForHandoff([{ categorySlug }]), expected[i]);
  });
});
