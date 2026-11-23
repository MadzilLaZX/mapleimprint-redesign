import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShippingProvider, buildCoordinator } from "./shippingProvider.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";
import { ChitChatsQuoteCoordinator } from "./chitChatsQuoteCoordinator.ts";

const ON_FULL = { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Test Customer", addressLine1: "123 Test St", city: "Ottawa" };

// resolveShippingProvider is the pure, directly-testable gating function the live
// `shippingProvider` singleton is built from (see shippingProvider.ts), mirroring
// resolveTaxProvider's exact pattern in taxProvider.ts.
//
// ACTIVATED 2026-11-22 (owner-approved): Production stays on the unconditional FreeShippingProvider
// placeholder (see that file's header); Preview/dev now run the real ChitChatsShippingProvider,
// which already implements the confirmed $300-threshold policy (chitChatsShippingProvider.test.ts
// covers that logic in full, against a mocked fetcher) -- these tests exist to confirm the
// ACTIVATION WIRING itself, not re-derive that policy's logic.

test("resolveShippingProvider('production') still returns unconditional Free Shipping, unaffected by this round's Preview activation", async () => {
  const provider = resolveShippingProvider("production");
  const options = await provider.getOptions(ON_FULL, 999_999_00, []);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("resolveShippingProvider('production') grants Free Shipping regardless of subtotal size -- Production's documented commercial-risk gap, deliberately unchanged this round", async () => {
  const provider = resolveShippingProvider("production");
  const tiny = await provider.getOptions(ON_FULL, 1, []);
  const huge = await provider.getOptions(ON_FULL, 1_000_000_00, []);
  assert.equal(tiny[0].cents, 0);
  assert.equal(huge[0].cents, 0);
});

test("resolveShippingProvider('preview') uses the real ChitChatsShippingProvider -- never silently falls back to a fabricated Free Shipping when a real rate can't be calculated", async () => {
  const provider = resolveShippingProvider("preview");
  // No real packaging profile exists for any product yet (packagingProfiles.ts is still empty),
  // so a real rate request always fails fetchChitChatsRates' own dimensions-required preflight --
  // confirmed below to throw, NEVER to resolve with a $0/free option. This never reaches the
  // network: the preflight throws before any fetch call, so this is safe to run unmocked.
  await assert.rejects(
    () => provider.getOptions(ON_FULL, 1_000_00, []),
    ShippingRateUnavailableError,
    "expected a would-be-free ($1000, over the $300 threshold) order to still require a real rate, not an automatic free pass",
  );
});

test("resolveShippingProvider(undefined) (local dev / npm test) also uses the real ChitChatsShippingProvider, same as 'preview'", async () => {
  const provider = resolveShippingProvider(undefined);
  await assert.rejects(() => provider.getOptions(ON_FULL, 1_000_00, []), ShippingRateUnavailableError);
});

test("resolveShippingProvider('preview') never grants free shipping for a small (under-threshold) order either -- it's not just the free path that requires a real rate", async () => {
  const provider = resolveShippingProvider("preview");
  await assert.rejects(() => provider.getOptions(ON_FULL, 100, []), ShippingRateUnavailableError);
});

test("resolveShippingProvider('preview') refuses rather than fabricating when the destination can't even be minimally validated", async () => {
  const provider = resolveShippingProvider("preview");
  await assert.rejects(
    () => provider.getOptions({ province: "", country: "CA", postalCode: "" }, 1_000_00, []),
    ShippingRateUnavailableError,
  );
});

// ACTIVATED (this round): the persistent, cross-instance Chit Chats quote coordinator, now that
// migration 010's table is confirmed applied to staging. buildCoordinator() must fail SOFT, never
// hard -- this sandbox has no SUPABASE_SERVICE_ROLE_KEY configured (confirmed: every test above
// already runs resolveShippingProvider('preview'/undefined) successfully without one), so these
// tests lock in that the missing-credentials path never throws and never breaks the provider.

test("buildCoordinator() returns undefined (never throws) when Supabase admin credentials aren't available -- exactly this sandbox's real condition", () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.equal(buildCoordinator(), undefined);
  } finally {
    if (original !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = original;
  }
});

test("buildCoordinator() successfully constructs a real ChitChatsQuoteCoordinator once Supabase admin credentials ARE available -- proves the wiring itself works, not just the fallback", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Fake but well-formed values -- constructing a Supabase client and the coordinator around it
  // never makes a network call, so no real request reaches any project, fake or real.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project-for-this-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key-for-this-test";
  try {
    const coordinator = buildCoordinator();
    assert.ok(coordinator instanceof ChitChatsQuoteCoordinator);
  } finally {
    if (originalUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test("resolveShippingProvider('preview') never throws during construction regardless of credential availability -- the coordinator wiring must never break the provider itself", () => {
  assert.doesNotThrow(() => resolveShippingProvider("preview"));
});
