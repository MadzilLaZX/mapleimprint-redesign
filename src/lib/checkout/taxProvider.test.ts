import { test } from "node:test";
import assert from "node:assert/strict";

// CanadianSalesTaxProvider is exported for direct testing. resolveTaxProvider is the pure,
// directly-testable gating function the live `taxProvider` singleton is built from (see
// taxProvider.ts) -- Production always gets ZeroTaxProvider regardless of this file's own
// deployment environment; development/Preview get the real calculation with PST/QST withheld.
import { CanadianSalesTaxProvider, resolveTaxProvider } from "./taxProvider.ts";

const ON = { province: "ON", country: "CA", postalCode: "K1V 8B9" };
const BC = { province: "BC", country: "CA", postalCode: "V6B 1A1" };
const QC = { province: "QC", country: "CA", postalCode: "H2Y 1C6" };
const AB = { province: "AB", country: "CA", postalCode: "T2P 1J9" };
const US = { province: "NY", country: "US", postalCode: "10001" };

test("Ontario: 13% HST on merchandise + shipping combined", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300);
  assert.deepEqual(result.breakdown, [{ label: "HST", cents: 1300 }]);
});

test("Ontario $100 order scenario from the launch spec: $13 HST on taxable merchandise", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300);
});

test("Ontario $350 order scenario: $45.50 HST on taxable merchandise with free shipping (0 shipping cents)", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 35000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 4550);
});

test("Ontario: HST also applies to a non-zero shipping charge, combined with merchandise", async () => {
  const provider = new CanadianSalesTaxProvider();
  // $100 merchandise + $10 shipping = $110 taxable -> 13% = $14.30
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 1000, shippingAddress: ON });
  assert.equal(result.taxCents, 1430);
});

test("BC with PST explicitly enabled (requires separate BC registration, not activated by default): 5% GST + 7% PST, itemized separately", async () => {
  const provider = new CanadianSalesTaxProvider(true);
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: BC });
  assert.equal(result.taxCents, 1200);
  assert.deepEqual(result.breakdown, [
    { label: "GST", cents: 500 },
    { label: "BC PST", cents: 700 },
  ]);
});

test("Quebec with QST explicitly enabled (requires separate Revenu Québec registration, not activated by default): 5% GST + 9.975% QST, itemized separately", async () => {
  const provider = new CanadianSalesTaxProvider(true);
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: QC });
  assert.equal(result.taxCents, 500 + Math.round(10000 * 0.09975));
  assert.deepEqual(result.breakdown, [
    { label: "GST", cents: 500 },
    { label: "QST", cents: Math.round(10000 * 0.09975) },
  ]);
});

test("BC by default (PST not yet confirmed): charges GST only, withholding PST until separately registered", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: BC });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("Quebec by default (QST not yet confirmed): charges GST only, withholding QST until separately registered", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: QC });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("Manitoba by default (RST not yet confirmed): charges GST only, same policy as BC/QC", async () => {
  const provider = new CanadianSalesTaxProvider();
  const MB = { province: "MB", country: "CA", postalCode: "R3C 0V8" };
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: MB });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("Saskatchewan by default (PST not yet confirmed): charges GST only, same policy as BC/QC", async () => {
  const provider = new CanadianSalesTaxProvider();
  const SK = { province: "SK", country: "CA", postalCode: "S7K 0J5" };
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: SK });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("Alberta: GST only, no provincial sales tax", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: AB });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("international address: zero-rated, no tax charged", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 2000, shippingAddress: US });
  assert.equal(result.taxCents, 0);
  assert.deepEqual(result.breakdown, []);
});

test("Ottawa pickup: Ontario HST applies via point-of-sale override even when the customer's own address is a different province", async () => {
  const provider = new CanadianSalesTaxProvider();
  const albertaCustomerPickingUpInOttawa = { ...AB };
  const result = await provider.calculate({
    subtotalCents: 10000,
    shippingCents: 0,
    shippingAddress: albertaCustomerPickingUpInOttawa,
    isPickup: true,
  });
  assert.equal(result.taxCents, 1300);
  assert.deepEqual(result.breakdown, [{ label: "HST", cents: 1300 }]);
});

test("Ottawa pickup: override applies even when the customer's address is international", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({
    subtotalCents: 10000,
    shippingCents: 0,
    shippingAddress: US,
    isPickup: true,
  });
  assert.equal(result.taxCents, 1300);
});

test("Ottawa pickup never carries a shipping charge to tax, but would still combine one if ever passed", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 500, shippingAddress: ON, isPickup: true });
  assert.equal(result.taxCents, Math.round(10500 * 0.13));
});

test("rounding: HST rounds to the nearest cent rather than truncating", async () => {
  const provider = new CanadianSalesTaxProvider();
  // 333 cents * 0.13 = 43.29 -> rounds to 43
  const result = await provider.calculate({ subtotalCents: 333, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 43);
});

test("rounding: GST+PST round independently, not as a single combined rate", async () => {
  const provider = new CanadianSalesTaxProvider(true);
  // 101 cents: GST 5% = 5.05 -> 5, PST 7% = 7.07 -> 7
  const result = await provider.calculate({ subtotalCents: 101, shippingCents: 0, shippingAddress: BC });
  assert.deepEqual(result.breakdown, [
    { label: "GST", cents: 5 },
    { label: "BC PST", cents: 7 },
  ]);
});

test("an unrecognized province code returns zero tax rather than guessing a rate", async () => {
  const provider = new CanadianSalesTaxProvider();
  const result = await provider.calculate({
    subtotalCents: 10000,
    shippingCents: 0,
    shippingAddress: { province: "XX", country: "CA", postalCode: "A1A 1A1" },
  });
  assert.equal(result.taxCents, 0);
});

// --- resolveTaxProvider: the Production-safety gate itself ---

test("resolveTaxProvider('production') always charges $0 tax, regardless of province -- the Production safety gate", async () => {
  const provider = resolveTaxProvider("production");
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 0);
  assert.deepEqual(result.breakdown, []);
});

test("resolveTaxProvider('preview') charges real Ontario HST", async () => {
  const provider = resolveTaxProvider("preview");
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300);
});

test("resolveTaxProvider(undefined) (local dev / npm test, no VERCEL_ENV set) charges real Ontario HST", async () => {
  const provider = resolveTaxProvider(undefined);
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300);
});

test("resolveTaxProvider('development') (vercel dev) charges real Ontario HST, not just 'preview' specifically", async () => {
  const provider = resolveTaxProvider("development");
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300);
});

test("resolveTaxProvider's non-Production providers withhold PST/QST by default, matching the live taxProvider export's policy", async () => {
  const provider = resolveTaxProvider("preview");
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: BC });
  assert.equal(result.taxCents, 500);
  assert.deepEqual(result.breakdown, [{ label: "GST", cents: 500 }]);
});

test("a string that merely contains 'production' but isn't exactly it does not trigger the Production gate (no loose matching)", async () => {
  const provider = resolveTaxProvider("pre-production");
  const result = await provider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: ON });
  assert.equal(result.taxCents, 1300, "only an exact 'production' string should ever zero out tax");
});
