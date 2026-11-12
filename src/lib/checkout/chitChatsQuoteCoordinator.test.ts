import { test } from "node:test";
import assert from "node:assert/strict";
import { ChitChatsQuoteCoordinator, type ChitChatsShipmentReconciler } from "./chitChatsQuoteCoordinator.ts";
import { InMemoryChitChatsQuoteStore, generateOwnerToken, buildQuoteFingerprint, type ChitChatsPersistedQuoteKey } from "./chitChatsQuoteStore.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";
import type { ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";

const keyInput: ChitChatsPersistedQuoteKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Jamie", addressLine1: "123 Main St", city: "Ottawa" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};
const fixedNow = new Date("2026-11-13T00:00:00Z");
const instantSleep = async () => {}; // zero real delay -- deterministic, fast tests
const okResult = [{ id: "cc", label: "Chit Chats", cents: 1850 }];

function newCoordinator(store: InMemoryChitChatsQuoteStore, overrides: Partial<ConstructorParameters<typeof ChitChatsQuoteCoordinator>[1]> = {}) {
  return new ChitChatsQuoteCoordinator(store, { now: () => fixedNow, sleep: instantSleep, leaseDurationMs: 30_000, ...overrides });
}

test("a single request with no contention: claims, fetches, fills, and returns the real rates", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const coordinator = newCoordinator(store);
  const result = await coordinator.getOrCreateQuote(keyInput, fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(result, okResult);
});

test("two simultaneous requests for the IDENTICAL quote: only one ever calls the real fetcher -- the other waits and reuses its result", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  let resolveSlowFetch: (rates: typeof okResult) => void = () => {};
  const slowFetcher: ChitChatsRateFetcher = () => {
    calls++;
    return new Promise((resolve) => {
      resolveSlowFetch = resolve;
    });
  };
  const neverCalledFetcher: ChitChatsRateFetcher = async () => {
    throw new Error("this fetcher must never be invoked -- the second request should wait, not fetch independently");
  };

  const coordinatorA = newCoordinator(store);
  const coordinatorB = newCoordinator(store);

  const promiseA = coordinatorA.getOrCreateQuote(keyInput, slowFetcher);
  // Let A's claim land before B starts -- A is now the owner, mid-fetch (not yet resolved).
  await Promise.resolve();
  await Promise.resolve();

  const promiseB = coordinatorB.getOrCreateQuote(keyInput, neverCalledFetcher);

  // Simulates a slow Chit Chats response finally coming back.
  resolveSlowFetch(okResult);

  const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
  assert.equal(calls, 1, "the real fetcher must be called exactly once for two concurrent requests of the identical quote");
  assert.deepEqual(resultA, okResult);
  assert.deepEqual(resultB, okResult);
});

test("a changed cart (different parcel weight) is a completely independent fingerprint -- both requests fetch for real", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const coordinator = newCoordinator(store);
  await coordinator.getOrCreateQuote(keyInput, fetcher);
  await coordinator.getOrCreateQuote({ ...keyInput, pkg: { weightLb: 5, dimensionsIn: null } }, fetcher);
  assert.equal(calls, 2);
});

test("a changed destination address is a completely independent fingerprint -- both requests fetch for real", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const coordinator = newCoordinator(store);
  await coordinator.getOrCreateQuote(keyInput, fetcher);
  await coordinator.getOrCreateQuote({ ...keyInput, address: { ...keyInput.address, city: "Toronto", postalCode: "M5V 2T6" } }, fetcher);
  assert.equal(calls, 2);
});

test("payment retry: a second call for the identical quote within the freshness window reuses the cached result -- never re-fetches", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const coordinator = newCoordinator(store);
  const quoteResult = await coordinator.getOrCreateQuote(keyInput, fetcher);
  const payResult = await coordinator.getOrCreateQuote(keyInput, fetcher);
  const payRetryResult = await coordinator.getOrCreateQuote(keyInput, fetcher);
  assert.equal(calls, 1, "a /quote call followed by /pay and a retried /pay must only ever create one real shipment");
  assert.deepEqual(quoteResult, payResult);
  assert.deepEqual(payResult, payRetryResult);
});

test("quote expiration: after the freshness window passes, a fresh request takes over directly (no reconciliation needed -- ordinary expiry, not a crash)", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  let now = fixedNow;
  const coordinator = new ChitChatsQuoteCoordinator(store, { now: () => now, sleep: instantSleep, leaseDurationMs: 30_000 });

  await coordinator.getOrCreateQuote(keyInput, fetcher);
  now = new Date(fixedNow.getTime() + 11 * 60 * 1000); // past the 10-minute quote TTL
  await coordinator.getOrCreateQuote(keyInput, fetcher);

  assert.equal(calls, 2, "an expired quote must be re-fetched, never reused past its freshness window");
});

test("failed API request: release()s its claim, so the very next request genuinely retries rather than reusing a cached failure", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const flakyFetcher: ChitChatsRateFetcher = async () => {
    calls++;
    throw new Error("ECONNRESET");
  };
  const coordinator = newCoordinator(store);
  await assert.rejects(() => coordinator.getOrCreateQuote(keyInput, flakyFetcher), /ECONNRESET/);
  await assert.rejects(() => coordinator.getOrCreateQuote(keyInput, flakyFetcher), /ECONNRESET/);
  assert.equal(calls, 2, "a failure must never be cached -- the next request has to attempt a real fetch again");
  assert.equal(store.size(), 0, "no stuck row should remain after a failed, released claim");
});

test("worker crash + reconciliation says 'false' (confirmed no shipment exists): safely recovers and creates a real one", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  // Simulate a crashed worker: claimed, never filled, never released.
  await store.claimOrInspect(keyInput, buildQuoteFingerprint(keyInput), fixedNow, generateOwnerToken(), new Date(fixedNow.getTime() + 10 * 60 * 1000), new Date(fixedNow.getTime() + 30_000));

  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const confirmedAbsent: ChitChatsShipmentReconciler = async () => ({ outcome: false });
  const afterLeaseExpiry = new Date(fixedNow.getTime() + 31_000);
  const coordinator = new ChitChatsQuoteCoordinator(store, {
    now: () => afterLeaseExpiry,
    sleep: instantSleep,
    leaseDurationMs: 30_000,
    reconciler: confirmedAbsent,
  });

  const result = await coordinator.getOrCreateQuote(keyInput, fetcher);
  assert.equal(calls, 1, "reconciliation confirmed nothing exists -- exactly one real shipment should now be created");
  assert.deepEqual(result, okResult);
});

test("worker crash + reconciliation says 'true' (the crashed worker's shipment actually exists): adopts it, creates NOTHING new", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claimOrInspect(keyInput, buildQuoteFingerprint(keyInput), fixedNow, generateOwnerToken(), new Date(fixedNow.getTime() + 10 * 60 * 1000), new Date(fixedNow.getTime() + 30_000));

  const neverCalledFetcher: ChitChatsRateFetcher = async () => {
    throw new Error("must never be called -- the crashed worker's shipment was confirmed to already exist");
  };
  const foundExisting: ChitChatsShipmentReconciler = async () => ({
    outcome: true,
    rates: [{ id: "cc", label: "Recovered", cents: 2200 }],
    chitChatsShipmentId: "ship_recovered",
  });
  const afterLeaseExpiry = new Date(fixedNow.getTime() + 31_000);
  const coordinator = new ChitChatsQuoteCoordinator(store, {
    now: () => afterLeaseExpiry,
    sleep: instantSleep,
    leaseDurationMs: 30_000,
    reconciler: foundExisting,
  });

  const result = await coordinator.getOrCreateQuote(keyInput, neverCalledFetcher);
  assert.deepEqual(result, [{ id: "cc", label: "Recovered", cents: 2200 }]);
});

test("worker crash + reconciliation CANNOT confirm either way ('unknown'): refuses to guess, throws a controlled retryable error, creates nothing", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  await store.claimOrInspect(keyInput, buildQuoteFingerprint(keyInput), fixedNow, generateOwnerToken(), new Date(fixedNow.getTime() + 10 * 60 * 1000), new Date(fixedNow.getTime() + 30_000));

  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const afterLeaseExpiry = new Date(fixedNow.getTime() + 31_000);
  // Default reconciler always reports "unknown" -- the honest default given no live Chit Chats
  // account exists to query (see chitChatsQuoteCoordinator.ts's own header).
  const coordinator = new ChitChatsQuoteCoordinator(store, { now: () => afterLeaseExpiry, sleep: instantSleep, leaseDurationMs: 30_000 });

  await assert.rejects(() => coordinator.getOrCreateQuote(keyInput, fetcher), ShippingRateUnavailableError);
  assert.equal(calls, 0, "duplicate prevention cannot be guaranteed -- must never blindly create a new shipment");
});

test("stale claim owner: a crashed worker that actually finishes LATE (after someone else recovered) has its result rejected -- never overwrites the recovery", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  const staleToken = generateOwnerToken();
  const leaseExpiresAt = new Date(fixedNow.getTime() + 30_000);
  await store.claimOrInspect(keyInput, "stale-owner-fp", fixedNow, staleToken, new Date(fixedNow.getTime() + 10 * 60 * 1000), leaseExpiresAt);

  // Someone else recovers first.
  const afterLeaseExpiry = new Date(leaseExpiresAt.getTime() + 1);
  const newToken = generateOwnerToken();
  await store.takeOver(
    "stale-owner-fp",
    staleToken,
    newToken,
    afterLeaseExpiry,
    new Date(afterLeaseExpiry.getTime() + 10 * 60 * 1000),
    new Date(afterLeaseExpiry.getTime() + 30_000),
  );
  await store.fill("stale-owner-fp", newToken, [{ id: "cc", label: "Recovered", cents: 2200 }], "ship_new");

  // The ORIGINAL worker, unaware it's been recovered, finally tries to fill with its stale token.
  const applied = await store.fill("stale-owner-fp", staleToken, [{ id: "cc", label: "STALE", cents: 9999 }], "ship_stale");
  assert.equal(applied, false);

  const current = await store.findReady("stale-owner-fp", afterLeaseExpiry);
  assert.deepEqual(current?.rates, [{ id: "cc", label: "Recovered", cents: 2200 }]);
});

test("bounded polling: a request that waits past maxPollAttempts without the owner ever finishing throws a controlled retryable error, never hangs", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  // Claim and never fill/release -- the "owner" simulated here never finishes within the test.
  await store.claimOrInspect(keyInput, buildQuoteFingerprint(keyInput), fixedNow, generateOwnerToken(), new Date(fixedNow.getTime() + 10 * 60 * 1000), new Date(fixedNow.getTime() + 60 * 60 * 1000)); // lease far in the future -- never goes stale during this test

  const neverCalledFetcher: ChitChatsRateFetcher = async () => {
    throw new Error("must never be called -- this request should give up via bounded polling, not fetch");
  };
  const coordinator = new ChitChatsQuoteCoordinator(store, { now: () => fixedNow, sleep: instantSleep, maxPollAttempts: 3 });

  await assert.rejects(() => coordinator.getOrCreateQuote(keyInput, neverCalledFetcher), ShippingRateUnavailableError);
});

test("cleanup race: deleting expired rows while a different fingerprint's claim is actively in flight does not disturb the active claim", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let calls = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    calls++;
    return okResult;
  };
  const coordinator = newCoordinator(store);

  // An unrelated, genuinely expired-and-abandoned quote sitting in the same store.
  await store.claimOrInspect(
    { ...keyInput, address: { ...keyInput.address, city: "Expired City", postalCode: "E1E 1E1" } },
    "abandoned-fp",
    fixedNow,
    generateOwnerToken(),
    new Date(fixedNow.getTime() - 1000), // already expired
    new Date(fixedNow.getTime() - 1000), // lease already expired too -- safe to clean up
  );

  const cleanedUp = await store.deleteExpiredUnpurchased(fixedNow);
  assert.equal(cleanedUp, 1);

  // The coordinator's own (unrelated) quote request must succeed normally, unaffected by cleanup.
  const result = await coordinator.getOrCreateQuote(keyInput, fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(result, okResult);
});

test("cleanup race: cleanup must never remove the row a coordinator is actively claiming (same fingerprint, live lease)", async () => {
  const store = new InMemoryChitChatsQuoteStore();
  let resolveSlowFetch: (rates: typeof okResult) => void = () => {};
  const slowFetcher: ChitChatsRateFetcher = () =>
    new Promise((resolve) => {
      resolveSlowFetch = resolve;
    });
  const coordinator = newCoordinator(store);

  const promise = coordinator.getOrCreateQuote(keyInput, slowFetcher);
  await Promise.resolve();
  await Promise.resolve();

  // Cleanup runs while the claim is still live (lease not expired) -- must be a no-op for this row.
  const cleanedUp = await store.deleteExpiredUnpurchased(fixedNow);
  assert.equal(cleanedUp, 0, "cleanup must never race an actively-leased claim, even if asked to");

  resolveSlowFetch(okResult);
  const result = await promise;
  assert.deepEqual(result, okResult);
});
