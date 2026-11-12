import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryChitChatsQuoteStore, buildQuoteFingerprint, generateOwnerToken, type ChitChatsPersistedQuoteKey } from "./chitChatsQuoteStore.ts";

const keyInput: ChitChatsPersistedQuoteKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Jamie", addressLine1: "123 Main St", city: "Ottawa" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};
const fingerprint = buildQuoteFingerprint(keyInput);
const now = new Date("2026-11-13T00:00:00Z");
const quoteExpiresAt = new Date("2026-11-13T00:10:00Z");
const leaseExpiresAt = new Date("2026-11-13T00:00:30Z");

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

test("generateOwnerToken: two calls never produce the same token", () => {
  assert.notEqual(generateOwnerToken(), generateOwnerToken());
});

test("claimOrInspect(): the first caller for a fingerprint becomes the owner", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  const outcome = await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  assert.deepEqual(outcome, { kind: "owner", ownerToken: token });
});

test("claimOrInspect(): a concurrent second caller while the lease is still live gets 'wait', never 'owner'", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  const second = await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.equal(second.kind, "wait");
});

test("claimOrInspect(): once filled, a later caller gets 'ready' with the real rates -- never re-claims or re-fetches", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc123");

  const outcome = await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.equal(outcome.kind, "ready");
  if (outcome.kind === "ready") {
    assert.deepEqual(outcome.quote.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
    assert.equal(outcome.quote.chitChatsShipmentId, "ship_abc123");
  }
});

test("claimOrInspect(): a pending row whose lease has expired is reported as 'stale' with wasPending=true, not silently re-claimable", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const priorToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, priorToken, quoteExpiresAt, leaseExpiresAt);
  const afterLease = new Date(leaseExpiresAt.getTime() + 1);
  const outcome = await store.claimOrInspect(keyInput, fingerprint, afterLease, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.deepEqual(outcome, { kind: "stale", priorOwnerToken: priorToken, wasPending: true });
});

test("claimOrInspect(): a ready row whose quote freshness has expired is 'stale' with wasPending=false -- ordinary expiry, not a crash signal", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const priorToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, priorToken, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, priorToken, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const afterExpiry = new Date(quoteExpiresAt.getTime() + 1);
  const outcome = await store.claimOrInspect(keyInput, fingerprint, afterExpiry, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.deepEqual(outcome, { kind: "stale", priorOwnerToken: priorToken, wasPending: false });
});

test("takeOver(): succeeds when the row is still owned by the expected token AND still genuinely stale", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const priorToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, priorToken, quoteExpiresAt, leaseExpiresAt);
  const afterLease = new Date(leaseExpiresAt.getTime() + 1);
  const newToken = generateOwnerToken();
  const tookOver = await store.takeOver(fingerprint, priorToken, newToken, afterLease, quoteExpiresAt, new Date(afterLease.getTime() + 30_000));
  assert.equal(tookOver, true);
  assert.equal(store.peek(fingerprint)?.ownerToken, newToken);
});

test("takeOver(): fails (CAS rejected) if the token no longer matches -- someone else already took over", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const priorToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, priorToken, quoteExpiresAt, leaseExpiresAt);
  const wrongToken = generateOwnerToken();
  const tookOver = await store.takeOver(fingerprint, wrongToken, generateOwnerToken(), now, quoteExpiresAt, leaseExpiresAt);
  assert.equal(tookOver, false);
});

test("takeOver(): fails if the row is no longer actually stale (the original owner filled it in the meantime) -- never overwrites a newer result", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const priorToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, priorToken, quoteExpiresAt, leaseExpiresAt);
  // The "slow but not actually crashed" owner finishes late, but BEFORE the recovery attempt --
  // fill() keeps the same ownerToken (it's filling its OWN claim), so a naive token-only CAS
  // would wrongly let a takeover proceed and clobber this real result.
  await store.fill(fingerprint, priorToken, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_real123");

  const afterLease = new Date(leaseExpiresAt.getTime() + 1);
  const tookOver = await store.takeOver(fingerprint, priorToken, generateOwnerToken(), afterLease, quoteExpiresAt, leaseExpiresAt);
  assert.equal(tookOver, false, "a row that became ready must never be overwritten by a takeover based on a stale read");
  assert.deepEqual(store.peek(fingerprint)?.rates, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
});

test("fill(): rejected (returns false) once the lease has been taken over by someone else -- the stale worker's late result is never applied", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const staleToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, staleToken, quoteExpiresAt, leaseExpiresAt);
  const newToken = generateOwnerToken();
  await store.takeOver(fingerprint, staleToken, newToken, new Date(leaseExpiresAt.getTime() + 1), quoteExpiresAt, new Date(leaseExpiresAt.getTime() + 60_000));

  // The ORIGINAL (now-stale) worker finally finishes and tries to report its result using its
  // OLD token -- this must be rejected, not silently accepted.
  const applied = await store.fill(fingerprint, staleToken, [{ id: "cc", label: "STALE WORKER RESULT", cents: 9999 }], "ship_stale");
  assert.equal(applied, false);
  assert.notEqual(store.peek(fingerprint)?.rates?.[0]?.label, "STALE WORKER RESULT");
});

test("fill(): succeeds for the current legitimate owner", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  const applied = await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc");
  assert.equal(applied, true);
});

test("release(): succeeds for the current owner, freeing the fingerprint for a fresh claim", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  const released = await store.release(fingerprint, token);
  assert.equal(released, true);

  const next = await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.equal(next.kind, "owner", "release() must free the fingerprint for a genuine retry, not leave it permanently stuck");
});

test("release(): rejected (returns false) if the lease was already taken over -- a stale worker's failure cannot delete a newer claim", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const staleToken = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, staleToken, quoteExpiresAt, leaseExpiresAt);
  const newToken = generateOwnerToken();
  await store.takeOver(fingerprint, staleToken, newToken, new Date(leaseExpiresAt.getTime() + 1), quoteExpiresAt, new Date(leaseExpiresAt.getTime() + 60_000));

  const released = await store.release(fingerprint, staleToken);
  assert.equal(released, false);
  assert.ok(store.peek(fingerprint), "the new owner's claim must survive the stale worker's release() attempt");
});

test("release(): never removes an already-purchased row, even if (incorrectly) called with the right token", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc");
  await store.markPurchased(fingerprint, now);
  const released = await store.release(fingerprint, token);
  assert.equal(released, false);
});

test("findReady(): returns null before fill()", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), quoteExpiresAt, leaseExpiresAt);
  assert.equal(await store.findReady(fingerprint, now), null);
});

test("findReady(): returns null once past expiresAt -- an expired quote is never reused for payment", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  assert.equal(await store.findReady(fingerprint, new Date(quoteExpiresAt.getTime() + 1)), null);
});

test("deleteExpiredUnpurchased(): removes an expired, never-purchased, non-leased quote", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const removed = await store.deleteExpiredUnpurchased(new Date(quoteExpiresAt.getTime() + 1));
  assert.equal(removed, 1);
  assert.equal(store.size(), 0);
});

test("deleteExpiredUnpurchased(): NEVER removes a purchased quote, even if expired", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], "ship_abc");
  await store.markPurchased(fingerprint, now);
  const removed = await store.deleteExpiredUnpurchased(new Date(quoteExpiresAt.getTime() + 1));
  assert.equal(removed, 0);
  assert.equal(store.size(), 1);
});

test("deleteExpiredUnpurchased(): never races an ACTIVELY-leased row, even if its expiresAt has already passed", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  // A pending claim with a lease that outlives the quote's own (unusual, but the safety check
  // must not assume this can't happen) expiresAt.
  const shortQuoteExpiry = new Date(now.getTime() + 1000);
  const longerLease = new Date(now.getTime() + 60_000);
  await store.claimOrInspect(keyInput, fingerprint, now, generateOwnerToken(), shortQuoteExpiry, longerLease);
  const removed = await store.deleteExpiredUnpurchased(new Date(shortQuoteExpiry.getTime() + 1));
  assert.equal(removed, 0, "cleanup must never delete a row while its lease is still live, regardless of expiresAt");
  assert.equal(store.size(), 1);
});

test("deleteExpiredUnpurchased(): does not remove a quote that hasn't expired yet", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const token = generateOwnerToken();
  await store.claimOrInspect(keyInput, fingerprint, now, token, quoteExpiresAt, leaseExpiresAt);
  await store.fill(fingerprint, token, [{ id: "cc", label: "Chit Chats", cents: 1850 }], null);
  const removed = await store.deleteExpiredUnpurchased(new Date(quoteExpiresAt.getTime() - 1));
  assert.equal(removed, 0);
  assert.equal(store.size(), 1);
});
