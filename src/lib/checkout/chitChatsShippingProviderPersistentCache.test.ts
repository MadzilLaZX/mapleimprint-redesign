import { test } from "node:test";
import assert from "node:assert/strict";
import { ChitChatsShippingProvider, type ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";
import { InMemoryChitChatsQuoteStore, buildQuoteFingerprint } from "./chitChatsQuoteStore.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";

// Simulates "multiple serverless instances" by constructing SEPARATE ChitChatsShippingProvider
// instances (each with its own independent, empty tier-1 in-memory cache -- see
// chitChatsShippingProvider.ts's own note that every default-constructed instance gets an
// isolated cache) that all share the SAME ChitChatsQuoteStore -- the persistent, cross-instance
// tier. This is the realistic shape of the real deployment: each warm Vercel function instance
// constructs its own `shippingProvider` singleton with an empty in-memory cache, but all of them
// talk to the same Supabase-backed quote store.

const fullAddress = {
  province: "ON",
  country: "CA",
  postalCode: "K1V 8B9",
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city: "Ottawa",
};
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];
const fixedNow = () => new Date("2026-11-13T00:00:00Z");

test("two 'instances' (separate providers) sharing a quote store: the second never calls the real fetcher for the identical request", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  const instanceA = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const instanceB = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);

  const resultA = await instanceA.getOptions(fullAddress, 1000, weighedLines);
  const resultB = await instanceB.getOptions(fullAddress, 1000, weighedLines);

  assert.equal(callCount, 1, "the second instance must reuse the first instance's persisted quote, not create a second Chit Chats shipment");
  assert.deepEqual(resultA, resultB);
});

test("without a shared quote store, two separate instances EACH call the real fetcher -- demonstrates what the store actually fixes", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const instanceA = new ChitChatsShippingProvider(fetcher);
  const instanceB = new ChitChatsShippingProvider(fetcher);

  await instanceA.getOptions(fullAddress, 1000, weighedLines);
  await instanceB.getOptions(fullAddress, 1000, weighedLines);

  assert.equal(callCount, 2, "without the persistent store, each instance's own empty in-memory cache can't see the other's quote");
});

test("a changed cart/address still busts the persistent cache across instances", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  const instanceA = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const instanceB = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);

  await instanceA.getOptions(fullAddress, 1000, weighedLines);
  await instanceB.getOptions({ ...fullAddress, city: "Toronto", postalCode: "M5V 2T6" }, 1000, weighedLines);

  assert.equal(callCount, 2, "a genuinely different destination must never reuse another destination's persisted quote");
});

test("a failed rate fetch releases the claimed row -- the next request (even on a different instance) retries for real, never reuses a cached failure", async () => {
  let callCount = 0;
  const flakyFetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    throw new Error("ECONNRESET");
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  const instanceA = new ChitChatsShippingProvider(flakyFetcher, undefined, sharedStore, fixedNow);
  const instanceB = new ChitChatsShippingProvider(flakyFetcher, undefined, sharedStore, fixedNow);

  await assert.rejects(() => instanceA.getOptions(fullAddress, 1000, weighedLines));
  await assert.rejects(() => instanceB.getOptions(fullAddress, 1000, weighedLines));

  assert.equal(callCount, 2, "a failure must release its claim so a retry (from any instance) genuinely re-attempts the fetch");
  assert.equal(sharedStore.size(), 0, "no stuck 'pending' row should remain after two failed attempts");
});

test("an expired persisted quote is never reused -- a fresh request after expiry calls the real fetcher again", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  let currentTime = new Date("2026-11-13T00:00:00Z");
  const clock = () => currentTime;
  const instanceA = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, clock);
  const instanceB = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, clock);

  await instanceA.getOptions(fullAddress, 1000, weighedLines);
  currentTime = new Date(currentTime.getTime() + 11 * 60 * 1000); // past the 10-minute persisted TTL
  await instanceB.getOptions(fullAddress, 1000, weighedLines);

  assert.equal(callCount, 2, "an expired persisted quote must never be charged against -- it has to be re-fetched");
});

test("payment-retry idempotency: calling getOptions twice for the identical fingerprint (simulating a /pay retry after /quote already cached it) never creates a second shipment", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  // Simulates /api/checkout/quote's provider instance, then a separate /api/checkout/pay
  // instance (and a retried /pay after a lost response) all reusing the same persisted quote.
  const quoteStepProvider = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const payStepProvider = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const payRetryProvider = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);

  const quoteResult = await quoteStepProvider.getOptions(fullAddress, 1000, weighedLines);
  const payResult = await payStepProvider.getOptions(fullAddress, 1000, weighedLines);
  const payRetryResult = await payRetryProvider.getOptions(fullAddress, 1000, weighedLines);

  assert.equal(callCount, 1);
  assert.deepEqual(quoteResult, payResult);
  assert.deepEqual(payResult, payRetryResult);
});

test("free shipping over $300 still applies correctly through the persistent-store path", async () => {
  const fetcher: ChitChatsRateFetcher = async () => [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  const sharedStore = new InMemoryChitChatsQuoteStore();
  const provider = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const options = await provider.getOptions(fullAddress, 30001, weighedLines);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("a destination Chit Chats can't service still fails safely (never a fabricated free rate) through the persistent-store path", async () => {
  const unsupportedFetcher: ChitChatsRateFetcher = async () => {
    throw new ShippingRateUnavailableError("Chit Chats does not support this destination.");
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  const provider = new ChitChatsShippingProvider(unsupportedFetcher, undefined, sharedStore, fixedNow);
  await assert.rejects(() => provider.getOptions(fullAddress, 30001, weighedLines), /does not support/);
});

test("a concurrent request that loses the claim race but finds the winner's row still 'pending' falls through and calls the fetcher itself (documented tradeoff, not a hang)", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const sharedStore = new InMemoryChitChatsQuoteStore();
  // Pre-claim the fingerprint directly (simulating another instance's in-flight, not-yet-filled request).
  const provider = new ChitChatsShippingProvider(fetcher, undefined, sharedStore, fixedNow);
  const fingerprintKey = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  const fp = buildQuoteFingerprint(fingerprintKey);
  await sharedStore.claim(fingerprintKey, fp, fixedNow(), new Date(fixedNow().getTime() + 60_000));

  const result = await provider.getOptions(fullAddress, 1000, weighedLines);
  assert.equal(callCount, 1, "a request that can't reuse a still-pending row must proceed to fetch rather than hang or error");
  assert.deepEqual(result, [{ id: "cc", label: "Chit Chats", cents: 1850 }]);
});
