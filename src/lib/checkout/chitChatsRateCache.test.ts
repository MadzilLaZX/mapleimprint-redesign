import { test } from "node:test";
import assert from "node:assert/strict";
import { ChitChatsRateCache, buildChitChatsRateCacheKey } from "./chitChatsRateCache.ts";
import { ChitChatsShippingProvider, type ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";

const fullAddress = {
  province: "ON",
  country: "CA",
  postalCode: "K1V 8B9",
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city: "Ottawa",
};
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];

test("ChitChatsRateCache: a miss followed by set() is returned by a subsequent get() with the same key", () => {
  const cache = new ChitChatsRateCache();
  const keyInput = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  assert.equal(cache.get(keyInput), null);
  cache.set(keyInput, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  const hit = cache.get(keyInput);
  assert.deepEqual(hit?.rates, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
});

test("ChitChatsRateCache: a different address produces a different key -- no false cache hit across destinations", () => {
  const cache = new ChitChatsRateCache();
  const keyA = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  const keyB = { address: { ...fullAddress, postalCode: "M5V 2T6", city: "Toronto" }, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  cache.set(keyA, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  assert.equal(cache.get(keyB), null);
});

test("ChitChatsRateCache: a changed parcel weight (different cart) produces a different key", () => {
  const cache = new ChitChatsRateCache();
  const keyA = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  const keyB = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 2.5, dimensionsIn: null } };
  cache.set(keyA, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  assert.equal(cache.get(keyB), null);
});

test("ChitChatsRateCache: an entry older than the TTL is treated as a miss and removed", () => {
  let now = 1_000_000;
  const cache = new ChitChatsRateCache(1000, () => now);
  const keyInput = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  cache.set(keyInput, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  assert.equal(cache.size(), 1);
  now += 1001; // just past the 1000ms TTL
  assert.equal(cache.get(keyInput), null);
  assert.equal(cache.size(), 0, "an expired entry is removed, not just ignored");
});

test("ChitChatsRateCache: an entry within the TTL is still a hit", () => {
  let now = 1_000_000;
  const cache = new ChitChatsRateCache(1000, () => now);
  const keyInput = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  cache.set(keyInput, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  now += 999;
  assert.ok(cache.get(keyInput) !== null);
});

test("ChitChatsRateCache: invalidate() removes a specific entry without affecting others", () => {
  const cache = new ChitChatsRateCache();
  const keyA = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  const keyB = { address: fullAddress, subtotalCents: 2000, pkg: { weightLb: 1, dimensionsIn: null } };
  cache.set(keyA, [{ id: "cc", label: "Chit Chats", cents: 1200 }]);
  cache.set(keyB, [{ id: "cc", label: "Chit Chats", cents: 1500 }]);
  cache.invalidate(keyA);
  assert.equal(cache.get(keyA), null);
  assert.ok(cache.get(keyB) !== null);
});

test("buildChitChatsRateCacheKey: identical inputs produce an identical key (order/shape-stable)", () => {
  const keyInput = { address: fullAddress, subtotalCents: 1000, pkg: { weightLb: 1, dimensionsIn: null } };
  assert.equal(buildChitChatsRateCacheKey(keyInput), buildChitChatsRateCacheKey({ ...keyInput }));
});

// --- Integration: ChitChatsShippingProvider actually uses the cache to avoid duplicate "shipment creation" ---

test("ChitChatsShippingProvider: repeated identical requests call the rate fetcher exactly once (dedup)", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const provider = new ChitChatsShippingProvider(fetcher);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  assert.equal(callCount, 1, "three identical requests on the same provider instance must only create one real quote");
});

test("ChitChatsShippingProvider: a changed destination address busts the cache and fetches a fresh rate", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const provider = new ChitChatsShippingProvider(fetcher);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  await provider.getOptions({ ...fullAddress, city: "Toronto", postalCode: "M5V 2T6" }, 1000, weighedLines);
  assert.equal(callCount, 2, "a genuinely different destination must never reuse another address's cached quote");
});

test("ChitChatsShippingProvider: a changed cart (different parcel weight) busts the cache and fetches a fresh rate", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const provider = new ChitChatsShippingProvider(fetcher);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  await provider.getOptions(fullAddress, 1000, [{ unitWeightLb: 5, quantity: 2 }]);
  assert.equal(callCount, 2, "a changed cart must never be quoted from a stale, now-inaccurate cached rate");
});

test("ChitChatsShippingProvider: a failed rate fetch is never cached -- the very next identical request retries for real", async () => {
  let callCount = 0;
  const flakyFetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    throw new Error("ECONNRESET");
  };
  const provider = new ChitChatsShippingProvider(flakyFetcher);
  await assert.rejects(() => provider.getOptions(fullAddress, 1000, weighedLines));
  await assert.rejects(() => provider.getOptions(fullAddress, 1000, weighedLines));
  assert.equal(callCount, 2, "a failure must never be remembered as if it were a valid (empty/zero) answer");
});

test("ChitChatsShippingProvider: an unserviceable-destination rejection (thrown by the fetcher) is retried, not cached, on the next identical request", async () => {
  let callCount = 0;
  const unsupportedFetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    throw new ShippingRateUnavailableError("Chit Chats does not support this destination.");
  };
  const provider = new ChitChatsShippingProvider(unsupportedFetcher);
  await assert.rejects(() => provider.getOptions(fullAddress, 1000, weighedLines));
  await assert.rejects(() => provider.getOptions(fullAddress, 1000, weighedLines));
  assert.equal(callCount, 2);
});

test("ChitChatsShippingProvider: a stale cached rate past the TTL is never reused -- a fresh request is made instead", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  let now = 1_000_000;
  const shortTtlCache = new ChitChatsRateCache(500, () => now);
  const provider = new ChitChatsShippingProvider(fetcher, shortTtlCache);
  await provider.getOptions(fullAddress, 1000, weighedLines);
  now += 501;
  await provider.getOptions(fullAddress, 1000, weighedLines);
  assert.equal(callCount, 2, "an expired quote must never be charged against -- it has to be re-fetched");
});

test("ChitChatsShippingProvider: two separate provider instances (e.g. two tests, two unrelated requests) never share a cache", async () => {
  let callCount = 0;
  const fetcher: ChitChatsRateFetcher = async () => {
    callCount++;
    return [{ id: "cc", label: "Chit Chats", cents: 1850 }];
  };
  const providerA = new ChitChatsShippingProvider(fetcher);
  const providerB = new ChitChatsShippingProvider(fetcher);
  await providerA.getOptions(fullAddress, 1000, weighedLines);
  await providerB.getOptions(fullAddress, 1000, weighedLines);
  assert.equal(callCount, 2, "each default-constructed provider owns its own isolated cache, not a shared global one");
});

test("ChitChatsShippingProvider: caching does not change the free-shipping outcome -- a cached rate still only zeroes the cheapest option when eligible", async () => {
  const fetcher: ChitChatsRateFetcher = async () => [
    { id: "cc-expedited", label: "Chit Chats Expedited", cents: 4200 },
    { id: "cc-standard", label: "Chit Chats Standard", cents: 1850 },
  ];
  const provider = new ChitChatsShippingProvider(fetcher);
  const FREE_SHIPPING_THRESHOLD_CENTS = 30000;
  const first = await provider.getOptions(fullAddress, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
  const second = await provider.getOptions(fullAddress, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
  assert.deepEqual(first, second);
  assert.ok(first.some((o) => o.id === "free" && o.cents === 0));
  assert.ok(first.some((o) => o.id === "cc-expedited" && o.cents === 4200));
});
