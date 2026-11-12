import { test } from "node:test";
import assert from "node:assert/strict";
import { purchasePostageForQuote, type ChitChatsPostagePurchaser } from "./chitChatsPostagePurchase.ts";
import {
  InMemoryChitChatsQuoteStore,
  buildQuoteFingerprint,
  generateOwnerToken,
  type ChitChatsPersistedQuoteKey,
} from "./chitChatsQuoteStore.ts";
import type { ShippingOption } from "./shippingProvider";

const keyInput: ChitChatsPersistedQuoteKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Jamie", addressLine1: "123 Main St", city: "Ottawa" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};
const fingerprint = buildQuoteFingerprint(keyInput);
const now = new Date("2026-11-13T00:00:00Z");
const expiresAt = new Date("2026-11-13T00:10:00Z");
const leaseExpiresAt = new Date("2026-11-13T00:00:30Z");

/** Test-only setup helper -- claims then fills a quote, mirroring what
 *  ChitChatsQuoteCoordinator.getOrCreateQuote() does for real, so these tests exercise
 *  purchasePostageForQuote() against a realistically-shaped 'ready' row. */
async function claimAndFill(store: InMemoryChitChatsQuoteStore, rates: ShippingOption[], shipmentId: string | null) {
  const ownerToken = generateOwnerToken();
  const outcome = await store.claimOrInspect(keyInput, fingerprint, now, ownerToken, expiresAt, leaseExpiresAt);
  if (outcome.kind !== "owner") throw new Error("test setup assumption violated: expected to win the claim");
  await store.fill(fingerprint, outcome.ownerToken, rates, shipmentId);
}

test("purchasePostageForQuote: throws if the quote doesn't exist (expired, never completed, or wrong fingerprint)", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await assert.rejects(() => purchasePostageForQuote(store, fingerprint, "chit_chats_select", now), /expired or was never completed/);
});

test("purchasePostageForQuote: throws if the quote has no associated Chit Chats shipment id", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await claimAndFill(store, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null); // no shipment id
  await assert.rejects(() => purchasePostageForQuote(store, fingerprint, "chit_chats_select", now), /nothing to purchase postage for/);
});

test("purchasePostageForQuote: a successful purchase calls the purchaser with the real shipment id and marks the quote purchased", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await claimAndFill(store, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");

  let receivedId: string | null = null;
  let receivedPostageType: string | null = null;
  const fakePurchaser: ChitChatsPostagePurchaser = async (id, postageType) => {
    receivedId = id;
    receivedPostageType = postageType;
  };

  await purchasePostageForQuote(store, fingerprint, "chit_chats_select", now, fakePurchaser);
  assert.equal(receivedId, "ship_abc123");
  assert.equal(receivedPostageType, "chit_chats_select");

  const quote = await store.findReady(fingerprint, now);
  assert.ok(quote?.purchasedAt, "the quote must be marked purchased after a successful buy");
});

test("purchasePostageForQuote: calling it twice is a safe no-op the second time -- never purchases postage twice", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await claimAndFill(store, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");

  let purchaseCalls = 0;
  const countingPurchaser: ChitChatsPostagePurchaser = async () => {
    purchaseCalls++;
  };

  await purchasePostageForQuote(store, fingerprint, "chit_chats_select", now, countingPurchaser);
  await purchasePostageForQuote(store, fingerprint, "chit_chats_select", now, countingPurchaser);

  assert.equal(purchaseCalls, 1, "a quote already marked purchased must never trigger a second real purchase call");
});

test("purchasePostageForQuote: the default purchaser (no real credentials) throws rather than silently succeeding", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await claimAndFill(store, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");
  await assert.rejects(() => purchasePostageForQuote(store, fingerprint, "chit_chats_select", now), /not implemented/);
});
