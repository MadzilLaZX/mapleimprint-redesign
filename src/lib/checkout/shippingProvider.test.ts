import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShippingProvider } from "./shippingProvider.ts";

const ON = { province: "ON", country: "CA", postalCode: "K1V 8B9" };

// resolveShippingProvider is the pure, directly-testable gating function the live
// `shippingProvider` singleton is built from (see shippingProvider.ts), mirroring
// resolveTaxProvider's exact pattern in taxProvider.ts. Both branches currently agree
// (FreeShippingProvider, no threshold) -- see that file's header "COMMERCIAL RISK" comment for
// why, and what a future activation requires. These tests exist so that a later edit to either
// branch has an immediate, obvious regression signal.

test("resolveShippingProvider('production') returns Free Shipping with no threshold, today", async () => {
  const provider = resolveShippingProvider("production");
  const options = await provider.getOptions(ON, 999_999_00, []);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("resolveShippingProvider('preview') also returns Free Shipping with no threshold, today", async () => {
  const provider = resolveShippingProvider("preview");
  const options = await provider.getOptions(ON, 500, []);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("resolveShippingProvider(undefined) (local dev / npm test) also returns Free Shipping, today", async () => {
  const provider = resolveShippingProvider(undefined);
  const options = await provider.getOptions(ON, 500, []);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("Free Shipping is granted regardless of subtotal size -- no threshold is enforced yet (the documented commercial-risk gap)", async () => {
  const provider = resolveShippingProvider("production");
  const tiny = await provider.getOptions(ON, 1, []);
  const huge = await provider.getOptions(ON, 1_000_000_00, []);
  assert.equal(tiny[0].cents, 0);
  assert.equal(huge[0].cents, 0);
});
