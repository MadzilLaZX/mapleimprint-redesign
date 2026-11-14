import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePackaging, PACKAGING_PROFILES, PRODUCT_PACKAGING_ASSIGNMENTS, type PackagingProfile } from "./packagingProfiles.ts";

// PACKAGING_PROFILES / PRODUCT_PACKAGING_ASSIGNMENTS ship empty (see packagingProfiles.ts's
// header -- no real measured box exists yet). Tests populate them with clearly-fake fixture data
// for the duration of each test and always remove it afterward, so this file never leaves behind
// anything that could be mistaken for a real owner-entered profile.

const FIXTURE_PROFILE_ID = "test-fixture-small-box";
const FIXTURE_PRODUCT_ID = "test-fixture-product";

const fixtureProfile: PackagingProfile = {
  id: FIXTURE_PROFILE_ID,
  label: "TEST FIXTURE ONLY -- not a real box",
  outerDimensionsIn: { length: 10, width: 8, height: 4 },
  emptyWeightLb: 0.5,
  maxUnitsPerPackage: 20,
  maxWeightLbPerPackage: 15,
};

function withFixtureProfile(fn: () => void) {
  PACKAGING_PROFILES[FIXTURE_PROFILE_ID] = fixtureProfile;
  PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID] = FIXTURE_PROFILE_ID;
  try {
    fn();
  } finally {
    delete PACKAGING_PROFILES[FIXTURE_PROFILE_ID];
    delete PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID];
  }
}

test("no products have a real assigned profile today -- resolves to null, never a fabricated box", () => {
  const result = resolvePackaging([{ productId: "any-real-catalogue-product", quantity: 5 }], 2.5);
  assert.equal(result, null);
});

test("a single-product cart within the profile's capacity resolves real dimensions and weight (product + tare)", () => {
  withFixtureProfile(() => {
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 4 }], 2.0);
    assert.deepEqual(result, {
      dimensionsIn: { length: 10, width: 8, height: 4 },
      weightLb: 2.5, // 2.0 product weight + 0.5 empty box weight
    });
  });
});

test("a quantity exceeding maxUnitsPerPackage requires multiple packages -- resolves to null rather than an under-counted box", () => {
  withFixtureProfile(() => {
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 21 }], 10);
    assert.equal(result, null);
  });
});

test("a resulting weight exceeding maxWeightLbPerPackage resolves to null, even if the unit count fits", () => {
  withFixtureProfile(() => {
    // 14.8 product weight + 0.5 tare = 15.3, over the 15 lb cap, even though quantity (10) fits.
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 10 }], 14.8);
    assert.equal(result, null);
  });
});

test("a mixed-product cart (more than one distinct productId) always resolves to null -- combining boxes is not attempted", () => {
  withFixtureProfile(() => {
    PACKAGING_PROFILES["other-fixture-box"] = { ...fixtureProfile, id: "other-fixture-box" };
    PRODUCT_PACKAGING_ASSIGNMENTS["other-fixture-product"] = "other-fixture-box";
    try {
      const result = resolvePackaging(
        [
          { productId: FIXTURE_PRODUCT_ID, quantity: 2 },
          { productId: "other-fixture-product", quantity: 1 },
        ],
        3,
      );
      assert.equal(result, null);
    } finally {
      delete PACKAGING_PROFILES["other-fixture-box"];
      delete PRODUCT_PACKAGING_ASSIGNMENTS["other-fixture-product"];
    }
  });
});

test("an empty cart resolves to null", () => {
  const result = resolvePackaging([], 0);
  assert.equal(result, null);
});

test("a zero or negative quantity resolves to null rather than a nonsensical package", () => {
  withFixtureProfile(() => {
    assert.equal(resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 0 }], 0), null);
    assert.equal(resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: -1 }], 0), null);
  });
});

test("an assignment pointing at a profile id that doesn't exist resolves to null rather than crashing -- defends against a data-entry mistake", () => {
  PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID] = "profile-id-that-does-not-exist";
  try {
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 1 }], 1);
    assert.equal(result, null);
  } finally {
    delete PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID];
  }
});
