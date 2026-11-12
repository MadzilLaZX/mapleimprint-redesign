import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryChitChatsQuoteStore, buildQuoteFingerprint, type ChitChatsPersistedQuoteKey } from "./chitChatsQuoteStore.ts";

const keyInput: ChitChatsPersistedQuoteKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Jamie", addressLine1: "123 Main St", city: "Ottawa" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};
const fingerprint = buildQuoteFingerprint(keyInput);
const now = new Date("2026-11-13T00:00:00Z");
const expiresAt = new Date("2026-11-13T00:10:00Z");

test("buildQuoteFingerprint: identical inputs produce an identical fingerprint", () => {
  assert.equal(buildQuoteFingerprint(keyInput), buildQuoteFingerprint({ ...keyInput }));
});

test("buildQuoteFingerprint: a different address produces a different fingerprint", () => {
  const other = { ...keyInput, address: { ...keyInput.address, city: "Toronto", postalCode: "M5V 2T6" } };
  assert.notEqual(buildQuoteFingerprint(keyInput), buildQuoteFingerprint(other));
});

test("buildQuoteFingerprint: a SHA-256 hex digest, not the raw JSON -- fixed length, no raw address leakage in the value itself", () => {
  assert.match(buildQuoteFingerprint(keyInput), /^[0-9a-f]{64}$/);
});

test("claim(): the first caller for a fingerprint wins the claim", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const result = await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(result.claimed, true);
  assert.equal(result.existing, null);
});

test("claim(): a concurrent second caller for the SAME fingerprint loses the race (this IS the duplicate-shipment prevention)", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const first = await store.claim(keyInput, fingerprint, now, expiresAt);
  const second = await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false);
});

test("claim(): a loser sees the winner's quote as 'existing' once it's been filled in (ready), reusing it rather than calling Chit Chats again", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");
  const loser = await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(loser.claimed, false);
  assert.deepEqual(loser.existing?.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
  assert.equal(loser.existing?.chitChatsShipmentId, "ship_abc123");
});

test("claim(): a loser sees 'existing: null' while the winner's row is still pending -- falls through to fetch itself rather than blocking", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  // Deliberately never fill()ed -- simulates the winner's real Chit Chats call still in flight.
  const loser = await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(loser.claimed, false);
  assert.equal(loser.existing, null, "a still-pending row must never be handed back as a usable quote");
});

test("findReady(): returns null before fill() -- a pending claim is never mistaken for a usable quote", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(await store.findReady(fingerprint, now), null);
});

test("findReady(): returns the quote after fill()", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const found = await store.findReady(fingerprint, now);
  assert.deepEqual(found?.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
});

test("findReady(): returns null once past expiresAt -- an expired quote is never reused for payment", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const afterExpiry = new Date(expiresAt.getTime() + 1);
  assert.equal(await store.findReady(fingerprint, afterExpiry), null);
});

test("release(): removes a pending claim, allowing the NEXT request to claim it fresh instead of being stuck forever", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.release(fingerprint); // simulates the real rate fetch failing
  const next = await store.claim(keyInput, fingerprint, now, expiresAt);
  assert.equal(next.claimed, true, "release() must free the fingerprint for a genuine retry, not leave it permanently stuck");
});

test("release(): never removes a row that has already been purchased, even if called", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");
  await store.markPurchased(fingerprint, now);
  await store.release(fingerprint);
  assert.ok(await store.findReady(fingerprint, now), "a purchased quote must survive release() -- it backs a real paid shipment");
});

test("deleteExpiredUnpurchased(): removes an expired, never-purchased quote", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const removed = await store.deleteExpiredUnpurchased(new Date(expiresAt.getTime() + 1));
  assert.equal(removed, 1);
  assert.equal(store.size(), 0);
});

test("deleteExpiredUnpurchased(): NEVER removes a purchased quote, even if expired -- mirrors Chit Chats' own 'cannot delete a purchased shipment' rule", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");
  await store.markPurchased(fingerprint, now);
  const removed = await store.deleteExpiredUnpurchased(new Date(expiresAt.getTime() + 1));
  assert.equal(removed, 0);
  assert.equal(store.size(), 1);
});

test("deleteExpiredUnpurchased(): does not remove a quote that hasn't expired yet", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claim(keyInput, fingerprint, now, expiresAt);
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const removed = await store.deleteExpiredUnpurchased(new Date(expiresAt.getTime() - 1));
  assert.equal(removed, 0);
  assert.equal(store.size(), 1);
});

test("deleteExpiredUnpurchased(): cleans up multiple expired quotes at once, leaving fresh and purchased ones alone", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const keyB = { ...keyInput, address: { ...keyInput.address, city: "Toronto", postalCode: "M5V 2T6" } };
  const fpB = buildQuoteFingerprint(keyB);
  const keyC = { ...keyInput, address: { ...keyInput.address, city: "Montreal", postalCode: "H2Y 1C6" } };
  const fpC = buildQuoteFingerprint(keyC);

  await store.claim(keyInput, fingerprint, now, expiresAt); // will expire, never purchased -> removed
  await store.fill(fingerprint, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);

  await store.claim(keyB, fpB, now, new Date(now.getTime() + 60 * 60 * 1000)); // far future -> kept
  await store.fill(fpB, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);

  await store.claim(keyC, fpC, now, expiresAt); // expires, but purchased -> kept
  await store.fill(fpC, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_c");
  await store.markPurchased(fpC, now);

  const removed = await store.deleteExpiredUnpurchased(new Date(expiresAt.getTime() + 1));
  assert.equal(removed, 1);
  assert.equal(store.size(), 2);
  assert.ok(await store.findReady(fpB, new Date(expiresAt.getTime() + 1)));
});
