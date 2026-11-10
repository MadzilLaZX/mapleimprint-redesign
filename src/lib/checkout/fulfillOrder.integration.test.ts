// Integration tests against the LIVE maple-imprint-catalogue Supabase project -- not mocks, and
// NOT run by `npm test` or any automatic/CI path. These perform real INSERT/UPDATE/DELETE writes
// (via real RPC calls with service-role credentials) against the same shared database holding
// real customer orders. Requires a deliberate, explicit opt-in:
//
//   RUN_LIVE_PAYMENT_INTEGRATION_TESTS=1 node --env-file=.env.local --test src/lib/checkout/fulfillOrder.integration.test.ts
//
// Exercises the real mark_order_paid_and_sync_attempt() Postgres function and the real
// markOrderPaidAndNotify() code path through it, via the same service-role REST/RPC access the
// app itself uses (no raw Postgres DATABASE_URL needed for this, unlike catalogue-engine's
// integration tests). All rows created here are synthetic, clearly marked (reference prefix
// MO-TEST-INTEGRATION-), and deleted in an `after` hook regardless of pass/fail.
//
// The three scenarios below (decline-then-retry, duplicate webhook, concurrent callbacks) were
// already verified live, manually, on 2026-11-10 -- all passing. This file exists so the same
// coverage is repeatable later without needing another manual pass, not because it's unverified.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { markOrderPaidAndNotify } from "./fulfillOrder.ts";

const SUPABASE_URL = "https://ovqkwedpwmuusnijbxro.supabase.co";
const hasCredentials = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.RUN_LIVE_PAYMENT_INTEGRATION_TESTS === "1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdmin: SupabaseClient<any, any, any>;
const createdOrderIds: string[] = [];

before(() => {
  if (!hasCredentials) return;
  supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
});

after(async () => {
  if (!hasCredentials || createdOrderIds.length === 0) return;
  await supabaseAdmin.from("PaymentAttempt").delete().in("orderId", createdOrderIds);
  await supabaseAdmin.from("MapleOrder").delete().in("id", createdOrderIds);
});

async function makeSyntheticOrder(reference: string, cents = 1000) {
  const { data: order, error } = await supabaseAdmin
    .from("MapleOrder")
    .insert({
      reference,
      status: "PENDING_PAYMENT",
      contactName: "Test Synthetic",
      contactEmail: "test-synthetic@example.invalid",
      contactPhone: "+16135550100",
      shippingAddress: { province: "ON", country: "CA" },
      subtotalCents: cents,
      taxCents: 0,
      shippingCents: 0,
      totalCents: cents,
      currency: "CAD",
      squareLocationId: "L_TEST",
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(`failed to create synthetic order: ${error?.message}`);
  createdOrderIds.push(order.id);
  return order.id as string;
}

async function makeAttempt(orderId: string, idempotencyKey: string, status: "CREATED" | "FAILED", failureReason?: string) {
  await supabaseAdmin
    .from("PaymentAttempt")
    .insert({ orderId, idempotencyKey, status, sourceType: "CARD", failureReason: failureReason ?? null });
}

test("decline followed by a successful retry: both tables end up consistent", { skip: !hasCredentials }, async () => {
  const orderId = await makeSyntheticOrder(`MO-TEST-INTEGRATION-DECLINE-${Date.now()}`);
  await makeAttempt(orderId, "test-idem-decline", "FAILED", "Card declined (synthetic)");

  await markOrderPaidAndNotify(supabaseAdmin, {
    orderId,
    squareOrderId: "sq-order-itest-1",
    squarePaymentId: "sq-payment-itest-1",
    rawResponse: { test: "retry success" },
  });

  const { data: order } = await supabaseAdmin.from("MapleOrder").select("status").eq("id", orderId).single();
  const { data: attempt } = await supabaseAdmin
    .from("PaymentAttempt")
    .select("status, failureReason")
    .eq("orderId", orderId)
    .single();

  assert.equal(order?.status, "PAID");
  assert.equal(attempt?.status, "SUCCEEDED");
  assert.equal(attempt?.failureReason, null, "a stale decline reason must not survive onto a succeeded attempt");
});

test("duplicate webhook delivery for an already-PAID order is a safe no-op", { skip: !hasCredentials }, async () => {
  const orderId = await makeSyntheticOrder(`MO-TEST-INTEGRATION-DUPWEBHOOK-${Date.now()}`);
  await makeAttempt(orderId, "test-idem-dup", "CREATED");

  await markOrderPaidAndNotify(supabaseAdmin, {
    orderId,
    squareOrderId: "sq-order-itest-2",
    squarePaymentId: "sq-payment-itest-2",
  });
  const { data: afterFirst } = await supabaseAdmin.from("MapleOrder").select("updatedAt").eq("id", orderId).single();

  // Simulates a second webhook delivery for the same payment (e.g. payment.created then
  // payment.updated, or a genuine retry) arriving after the order is already PAID.
  await markOrderPaidAndNotify(supabaseAdmin, {
    orderId,
    squareOrderId: "sq-order-itest-2",
    squarePaymentId: "sq-payment-itest-2",
  });
  const { data: afterSecond } = await supabaseAdmin
    .from("MapleOrder")
    .select("status, updatedAt")
    .eq("id", orderId)
    .single();

  assert.equal(afterSecond?.status, "PAID");
  // The second call must not have touched the row again -- its UPDATE's WHERE clause
  // (status != 'PAID') should match zero rows, leaving updatedAt exactly as the first call left it.
  assert.equal(afterSecond?.updatedAt, afterFirst?.updatedAt);
});

test("two concurrent callbacks for the same order never both win the transition", { skip: !hasCredentials }, async () => {
  const orderId = await makeSyntheticOrder(`MO-TEST-INTEGRATION-CONCURRENT-${Date.now()}`);
  await makeAttempt(orderId, "test-idem-concurrent", "CREATED");

  // Simulates the synchronous /pay response path and the webhook path both learning about the
  // same successful payment at nearly the same time -- fired as genuinely parallel requests, not
  // sequential awaits.
  const [a, b] = await Promise.all([
    supabaseAdmin.rpc("mark_order_paid_and_sync_attempt", {
      p_order_id: orderId,
      p_square_order_id: "sq-order-itest-3",
      p_square_payment_id: "sq-payment-itest-3",
      p_raw_response: { source: "sync_pay_response" },
    }),
    supabaseAdmin.rpc("mark_order_paid_and_sync_attempt", {
      p_order_id: orderId,
      p_square_order_id: "sq-order-itest-3",
      p_square_payment_id: "sq-payment-itest-3",
      p_raw_response: { source: "webhook" },
    }),
  ]);

  const winners = [a.data?.[0]?.newly_paid, b.data?.[0]?.newly_paid].filter(Boolean);
  assert.equal(winners.length, 1, "exactly one of the two concurrent callbacks must win the PAID transition");

  const { data: order } = await supabaseAdmin.from("MapleOrder").select("status").eq("id", orderId).single();
  const { data: attempt } = await supabaseAdmin.from("PaymentAttempt").select("status").eq("orderId", orderId).single();
  assert.equal(order?.status, "PAID");
  assert.equal(attempt?.status, "SUCCEEDED");
});

test("an order that never existed returns newly_paid=false rather than erroring", { skip: !hasCredentials }, async () => {
  const { data } = await supabaseAdmin.rpc("mark_order_paid_and_sync_attempt", {
    p_order_id: "00000000-0000-0000-0000-000000000000",
    p_square_order_id: "sq-order-nonexistent",
    p_square_payment_id: "sq-payment-nonexistent",
  });
  assert.equal(data?.[0]?.newly_paid, false);
});
