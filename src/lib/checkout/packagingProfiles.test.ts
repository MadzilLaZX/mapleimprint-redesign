import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePackaging, validatePackagingProfile, PACKAGING_PROFILES, PRODUCT_PACKAGING_ASSIGNMENTS, type PackagingProfile } from "./packagingProfiles.ts";

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

test("a single oversized unit (quantity 1, but its own weight alone exceeds the box's weight cap) resolves to null -- never squeezed into an undersized box", () => {
  withFixtureProfile(() => {
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 1 }], 20); // 20 + 0.5 tare > 15 lb cap
    assert.equal(result, null);
  });
});

test("REGRESSION: two cart lines of the SAME product (e.g. separate colour/size variants) are summed, not just the first line's quantity", () => {
  withFixtureProfile(() => {
    // Two variants of the identical style/product -- same productId, different lines, as this
    // codebase's real checkout pipeline produces for e.g. a red AND a blue order of one T-shirt.
    // 12 + 12 = 24 total units, over the 20-unit cap -- must resolve to null. Using only the
    // first line's quantity (12) would incorrectly report "fits."
    const result = resolvePackaging(
      [
        { productId: FIXTURE_PRODUCT_ID, quantity: 12 },
        { productId: FIXTURE_PRODUCT_ID, quantity: 12 },
      ],
      20,
    );
    assert.equal(result, null);
  });
});

test("REGRESSION: two same-product variant lines whose SUMMED quantity fits the box resolve correctly", () => {
  withFixtureProfile(() => {
    // 8 + 8 = 16 total units, within the 20-unit cap. Using only the first line's quantity (8)
    // would also happen to "fit," so this test alone wouldn't catch the bug -- paired with the
    // test above (where under-counting matters) to cover both directions.
    const result = resolvePackaging(
      [
        { productId: FIXTURE_PRODUCT_ID, quantity: 8 },
        { productId: FIXTURE_PRODUCT_ID, quantity: 8 },
      ],
      10,
    );
    assert.deepEqual(result, {
      dimensionsIn: { length: 10, width: 8, height: 4 },
      weightLb: 10.5,
    });
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

// --- validatePackagingProfile(): the pre-activation safety gate ---

test("validatePackagingProfile: a real-looking, fully-measured profile passes with no errors", () => {
  const result = validatePackagingProfile(fixtureProfile);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validatePackagingProfile: a profile with every field still at a placeholder zero (e.g. the header's unmeasured template, copied verbatim) fails with one error per field", () => {
  const placeholder: PackagingProfile = {
    id: "unmeasured",
    label: "Copied from the template, never measured",
    outerDimensionsIn: { length: 0, width: 0, height: 0 },
    emptyWeightLb: 0,
    maxUnitsPerPackage: 0,
    maxWeightLbPerPackage: 0,
  };
  const result = validatePackagingProfile(placeholder);
  assert.equal(result.valid, false);
  // One error per validated field: length, width, height, emptyWeightLb, maxWeightLbPerPackage,
  // maxUnitsPerPackage.
  assert.equal(result.errors.length, 6);
});

test("validatePackagingProfile: a single still-zero dimension (the other fields real) is caught individually, not masked by the others being fine", () => {
  const almostReal: PackagingProfile = { ...fixtureProfile, outerDimensionsIn: { ...fixtureProfile.outerDimensionsIn, height: 0 } };
  const result = validatePackagingProfile(almostReal);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("outerDimensionsIn.height")));
});

test("validatePackagingProfile: a negative value is caught the same as zero -- a real measurement is never negative", () => {
  const result = validatePackagingProfile({ ...fixtureProfile, emptyWeightLb: -0.5 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("emptyWeightLb")));
});

test("validatePackagingProfile: a non-finite value (NaN/Infinity) is caught, not just non-positive ones", () => {
  assert.equal(validatePackagingProfile({ ...fixtureProfile, emptyWeightLb: NaN }).valid, false);
  assert.equal(validatePackagingProfile({ ...fixtureProfile, maxWeightLbPerPackage: Infinity }).valid, false);
});

test("validatePackagingProfile: maxUnitsPerPackage must be a whole number, not just positive -- half a unit of capacity isn't real", () => {
  const result = validatePackagingProfile({ ...fixtureProfile, maxUnitsPerPackage: 2.5 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("maxUnitsPerPackage")));
});

test("resolvePackaging(): an INVALID assigned profile (placeholder zeros) is refused exactly like a missing one -- never used to build a real rate request", () => {
  const invalidProfile: PackagingProfile = {
    id: "invalid-fixture",
    label: "TEST FIXTURE -- invalid on purpose",
    outerDimensionsIn: { length: 10, width: 8, height: 0 }, // one field still unmeasured
    emptyWeightLb: 0.5,
    maxUnitsPerPackage: 20,
    maxWeightLbPerPackage: 15,
  };
  PACKAGING_PROFILES["invalid-fixture"] = invalidProfile;
  PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID] = "invalid-fixture";
  try {
    const result = resolvePackaging([{ productId: FIXTURE_PRODUCT_ID, quantity: 1 }], 1);
    assert.equal(result, null, "an invalid profile must never resolve real dimensions, even though the lookup itself succeeded");
  } finally {
    delete PACKAGING_PROFILES["invalid-fixture"];
    delete PRODUCT_PACKAGING_ASSIGNMENTS[FIXTURE_PRODUCT_ID];
  }
});

// --- Live-data gate: runs against whatever PACKAGING_PROFILES ACTUALLY contains, every time the
// suite runs. Empty today (passes vacuously) -- the moment a real entry is added, this test starts
// checking it automatically, with no further test-writing required. This is the "automated
// validation test that will verify a future measured packaging profile before activation" this
// file exists to provide. ---

test("LIVE GATE: every profile currently in PACKAGING_PROFILES passes validatePackagingProfile() -- catches a bad real entry before it ever reaches a customer", () => {
  const failures: string[] = [];
  for (const [id, profile] of Object.entries(PACKAGING_PROFILES)) {
    const { valid, errors } = validatePackagingProfile(profile);
    if (!valid) failures.push(`${id}: ${errors.join("; ")}`);
  }
  assert.deepEqual(failures, [], "one or more PACKAGING_PROFILES entries failed validation -- see the messages above for exactly which field(s)");
});

test("LIVE GATE: every PRODUCT_PACKAGING_ASSIGNMENTS entry points at a profile that actually exists in PACKAGING_PROFILES", () => {
  const dangling = Object.entries(PRODUCT_PACKAGING_ASSIGNMENTS)
    .filter(([, profileId]) => !(profileId in PACKAGING_PROFILES))
    .map(([productId, profileId]) => `${productId} -> ${profileId}`);
  assert.deepEqual(dangling, [], "one or more product assignments point at a profile id that doesn't exist");
});
