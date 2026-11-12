// Integration tests against the LIVE maple-imprint-catalogue Supabase project -- not mocks, and
// NOT run by `npm test` or any automatic/CI path. Same pattern and same opt-in env var as
// fulfillOrder.integration.test.ts. These INSERT/UPDATE/DELETE real rows in the
// ChitChatsShippingQuote table (supabase/migrations/010_chit_chats_shipping_quotes.sql) via the
// service-role client -- requires that migration to have been reviewed and APPLIED first (it is
// NOT applied as of this file being written), plus a deliberate, explicit opt-in:
//
//   RUN_LIVE_PAYMENT_INTEGRATION_TESTS=1 node --env-file=.env.local --test src/lib/checkout/chitChatsQuoteStore.integration.test.ts
//
// All rows here are synthetic (fingerprint prefixed with a fixed, recognizable test marker) and
// deleted in an `after` hook regardless of pass/fail. No real Chit Chats API call is made by this
// file -- it only exercises the real Postgres table/constraint/RLS/CAS behavior underneath
// SupabaseChitChatsQuoteStore, never a live shipment creation. In particular, this file is where
// the two-separate-conditional-UPDATE approach `takeOver()` uses (see that method's own comment
// on why it avoids a single nested OR/AND PostgREST filter) should be re-confirmed once this can
// actually run -- it was written against PostgREST's documented `.eq()`/`.lte()` chaining, not
// verified against a live project this round.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseChitChatsQuoteStore, generateOwnerToken } from "./chitChatsQuoteStore.ts";

const SUPABASE_URL = "https://ovqkwedpwmuusnijbxro.supabase.co";
const hasCredentials = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.RUN_LIVE_PAYMENT_INTEGRATION_TESTS === "1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdmin: SupabaseClient<any, any, any>;
const createdFingerprints: string[] = [];

before(() => {
  if (!hasCredentials) return;
  supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
});

after(async () => {
  if (!hasCredentials || createdFingerprints.length === 0) return;
  await supabaseAdmin.from("ChitChatsShippingQuote").delete().in("quoteFingerprint", createdFingerprints);
});

function syntheticFingerprint(suffix: string): string {
  const fp = `test-integration-${suffix}-${Date.now()}`;
  createdFingerprints.push(fp);
  return fp;
}

const testKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Test Synthetic", addressLine1: "123 Test St", city: "Ottawa" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};

test("claimOrInspect() + the real UNIQUE constraint: a second claim for the same fingerprint never inserts a second row", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("unique-constraint");
  const now = new Date();
  const quoteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const leaseExpiresAt = new Date(now.getTime() + 30_000);

  const first = await store.claimOrInspect(testKey, fp, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  const second = await store.claimOrInspect(testKey, fp, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);

  assert.equal(first.kind, "owner");
  assert.equal(second.kind, "wait");

  const { count } = await supabaseAdmin
    .from("ChitChatsShippingQuote")
    .select("id", { count: "exact", head: true })
    .eq("quoteFingerprint", fp);
  assert.equal(count, 1, "the real UNIQUE constraint must prevent a second row for the same fingerprint");
});

test("fill() with the correct ownerToken transitions a real row from pending to ready, and findReady() then returns it", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("fill-ready");
  const now = new Date();
  const quoteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const leaseExpiresAt = new Date(now.getTime() + 30_000);

  const outcome = await store.claimOrInspect(testKey, fp, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  if (outcome.kind !== "owner") throw new Error("test setup assumption violated: expected to win the claim");
  assert.equal(await store.findReady(fp, now), null, "must not be ready before fill()");

  const applied = await store.fill(fp, outcome.ownerToken, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_test123");
  assert.equal(applied, true);
  const ready = await store.findReady(fp, now);
  assert.deepEqual(ready?.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
  assert.equal(ready?.chitChatsShipmentId, "ship_test123");
});

test("fill() with the WRONG ownerToken is rejected by the real CAS UPDATE -- the row is left untouched", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("fill-wrong-token");
  const now = new Date();
  const quoteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const leaseExpiresAt = new Date(now.getTime() + 30_000);

  await store.claimOrInspect(testKey, fp, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  const applied = await store.fill(fp, generateOwnerToken(), [{ id: "cc", label: "WRONG", cents: 9999 }], "ship_wrong");
  assert.equal(applied, false);
  assert.equal(await store.findReady(fp, now), null, "a fill() from the wrong owner must never apply");
});

test("takeOver() against a real, genuinely-stale pending row succeeds and resets it for a new owner", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("takeover-stale-pending");
  const claimedAt = new Date(Date.now() - 60_000); // in the past
  const expiredLease = new Date(claimedAt.getTime() + 1000); // already expired by "now"
  const outcome = await store.claimOrInspect(testKey, fp, claimedAt, generateOwnerToken(), new Date(claimedAt.getTime() + 10 * 60 * 1000), expiredLease);
  if (outcome.kind !== "owner") throw new Error("test setup assumption violated");

  const now = new Date();
  const newToken = generateOwnerToken();
  const tookOver = await store.takeOver(fp, outcome.ownerToken, newToken, now, new Date(now.getTime() + 10 * 60 * 1000), new Date(now.getTime() + 30_000));
  assert.equal(tookOver, true, "a real stale pending row (lease expired, real UPDATE ... WHERE ... <= now()) must be take-over-able");

  const applied = await store.fill(fp, newToken, [{ id: "cc", label: "Recovered", cents: 2000 }], "ship_recovered");
  assert.equal(applied, true);
});

test("real RLS: the anon key cannot read ChitChatsShippingQuote rows at all", { skip: !hasCredentials }, async () => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) return; // no anon key configured locally -- not this test's job to require one
  const anonClient = createClient(SUPABASE_URL, anonKey);
  const fp = syntheticFingerprint("rls-deny-all");
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const now = new Date();
  await store.claimOrInspect(testKey, fp, now, generateOwnerToken(), new Date(now.getTime() + 10 * 60 * 1000), new Date(now.getTime() + 30_000));

  const { data, error } = await anonClient.from("ChitChatsShippingQuote").select("*").eq("quoteFingerprint", fp);
  assert.ok((data ?? []).length === 0 || error, "deny-all RLS must block the anon key from reading quote rows");
});

test("deleteExpiredUnpurchased() against the real table removes an expired, non-leased row but never a purchased one", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const past = new Date(Date.now() - 60_000);

  const expiredFp = syntheticFingerprint("cleanup-expired");
  const expiredOutcome = await store.claimOrInspect(testKey, expiredFp, past, generateOwnerToken(), new Date(past.getTime() - 1000), new Date(past.getTime() - 1000));
  if (expiredOutcome.kind === "owner") {
    await store.fill(expiredFp, expiredOutcome.ownerToken, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  }

  const purchasedFp = syntheticFingerprint("cleanup-purchased");
  const purchasedOutcome = await store.claimOrInspect(testKey, purchasedFp, past, generateOwnerToken(), new Date(past.getTime() - 1000), new Date(past.getTime() - 1000));
  if (purchasedOutcome.kind === "owner") {
    await store.fill(purchasedFp, purchasedOutcome.ownerToken, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_test456");
  }
  await store.markPurchased(purchasedFp, new Date());

  await store.deleteExpiredUnpurchased(new Date());

  const { data: expiredRow } = await supabaseAdmin.from("ChitChatsShippingQuote").select("id").eq("quoteFingerprint", expiredFp).maybeSingle();
  const { data: purchasedRow } = await supabaseAdmin.from("ChitChatsShippingQuote").select("id").eq("quoteFingerprint", purchasedFp).maybeSingle();
  assert.equal(expiredRow, null, "an expired, never-purchased, non-leased row must be removed");
  assert.ok(purchasedRow, "a purchased row must survive cleanup even if expired");
});
