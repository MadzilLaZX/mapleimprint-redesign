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
// file -- it only exercises the real Postgres table/constraint/RLS behavior underneath
// SupabaseChitChatsQuoteStore, never a live shipment creation.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseChitChatsQuoteStore } from "./chitChatsQuoteStore.ts";

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

test("claim() + the real UNIQUE constraint: a second claim for the same fingerprint never inserts a second row", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("unique-constraint");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);

  const first = await store.claim(testKey, fp, now, expiresAt);
  const second = await store.claim(testKey, fp, now, expiresAt);

  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false);

  const { count } = await supabaseAdmin
    .from("ChitChatsShippingQuote")
    .select("id", { count: "exact", head: true })
    .eq("quoteFingerprint", fp);
  assert.equal(count, 1, "the real UNIQUE constraint must prevent a second row for the same fingerprint");
});

test("fill() transitions a real row from pending to ready, and findReady() then returns it", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const fp = syntheticFingerprint("fill-ready");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);

  await store.claim(testKey, fp, now, expiresAt);
  assert.equal(await store.findReady(fp, now), null, "must not be ready before fill()");

  await store.fill(fp, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_test123");
  const ready = await store.findReady(fp, now);
  assert.deepEqual(ready?.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
  assert.equal(ready?.chitChatsShipmentId, "ship_test123");
});

test("real RLS: the anon key cannot read ChitChatsShippingQuote rows at all", { skip: !hasCredentials }, async () => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) return; // no anon key configured locally -- not this test's job to require one
  const anonClient = createClient(SUPABASE_URL, anonKey);
  const fp = syntheticFingerprint("rls-deny-all");
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  await store.claim(testKey, fp, new Date(), new Date(Date.now() + 60_000));

  const { data, error } = await anonClient.from("ChitChatsShippingQuote").select("*").eq("quoteFingerprint", fp);
  assert.ok((data ?? []).length === 0 || error, "deny-all RLS must block the anon key from reading quote rows");
});

test("deleteExpiredUnpurchased() against the real table removes an expired row but never a purchased one", { skip: !hasCredentials }, async () => {
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);
  const now = new Date();

  const expiredFp = syntheticFingerprint("cleanup-expired");
  await store.claim(testKey, expiredFp, now, new Date(now.getTime() - 1000)); // already expired
  await store.fill(expiredFp, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);

  const purchasedFp = syntheticFingerprint("cleanup-purchased");
  await store.claim(testKey, purchasedFp, now, new Date(now.getTime() - 1000)); // also expired
  await store.fill(purchasedFp, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_test456");
  await store.markPurchased(purchasedFp, now);

  await store.deleteExpiredUnpurchased(new Date(now.getTime() + 5000));

  const { data: expiredRow } = await supabaseAdmin.from("ChitChatsShippingQuote").select("id").eq("quoteFingerprint", expiredFp).maybeSingle();
  const { data: purchasedRow } = await supabaseAdmin.from("ChitChatsShippingQuote").select("id").eq("quoteFingerprint", purchasedFp).maybeSingle();
  assert.equal(expiredRow, null, "an expired, never-purchased row must be removed");
  assert.ok(purchasedRow, "a purchased row must survive cleanup even if expired");
});
