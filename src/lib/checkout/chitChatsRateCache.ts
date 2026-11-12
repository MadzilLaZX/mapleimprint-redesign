import type { ShippingAddressInput, ShippingOption } from "./shippingProvider";
import type { ChitChatsPackageInput } from "./chitChatsShippingProvider.ts";

// Why this exists: Chit Chats has no quote-only endpoint (see chitChatsShippingProvider.ts's
// header) -- every rate lookup is, today, the same operation as creating a shipment record.
// Without deduplication, a single checkout session can trigger many rate requests for the exact
// same cart/address (CheckoutClient's debounce still fires per `[province, country, postalCode]`
// change, a React double-invocation in development, a retried fetch after a flaky network) --
// each one would otherwise create a DISTINCT Chit Chats shipment record for something that never
// changed. ChitChatsShippingProvider owns one instance of this cache for its own lifetime (see
// its constructor) -- since both checkout API routes call through the same `shippingProvider`
// module-level singleton once this provider is activated, they naturally share that one cache
// for as long as the serverless instance stays warm, with no separate wiring needed here.
//
// Scope and honest limits of an in-memory cache (read before relying on this for Production):
//   - This is a plain in-process Map. It dedupes repeated requests served by the SAME warm
//     serverless instance, which covers the common within-session cases above. It does NOT
//     dedupe across separate Vercel function instances/cold starts -- two concurrent requests
//     landing on different instances can still each create a real shipment. Closing that gap
//     needs a persistent, shared store (e.g. a `ChitChatsShipmentQuote` Supabase table keyed by
//     the same cache key below, with the real `chitChatsShipmentId` and `cachedAt`) -- that is a
//     schema/migration change, which is explicitly out of scope without separate approval. This
//     module's key/entry shape is designed to map directly onto that table if/when it's approved,
//     so upgrading from in-memory to persistent is a storage swap, not a redesign.
//   - The TTL below (quote freshness window) is this application's own policy, not a Chit Chats
//     API behavior -- Chit Chats' docs don't document an unpaid-shipment expiry, so this doesn't
//     assume or depend on one.

export const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes -- app policy, not a Chit Chats fact

export interface ChitChatsRateCacheKeyInput {
  address: ShippingAddressInput;
  subtotalCents: number;
  pkg: ChitChatsPackageInput;
}

export interface ChitChatsRateCacheEntry {
  rates: ShippingOption[];
  /** The real Chit Chats shipment id this quote came from -- always null until a real rate
   *  fetcher exists (the default stub never sets it). Once real, this is what a later successful
   *  payment should reuse via PATCH /shipments/{id}/buy -- see this file's header and
   *  chitChatsShippingProvider.ts's header for the full "associate a quote with a paid order"
   *  design -- rather than creating a second shipment at payment time for a cart that was already
   *  quoted. */
  chitChatsShipmentId: string | null;
  cachedAt: number;
}

/** Deliberately explicit field-by-field, not a generic deep-stable-stringify of arbitrary
 *  objects -- the input shape here is small and known, so a generic serializer would be
 *  unnecessary complexity for no real benefit, and this version is trivially reviewable. Only the
 *  fields that could change the resulting rate are included (subtotalCents affects nothing about
 *  a Chit Chats rate itself today, but is included for forward-compatibility since the real
 *  fetcher's signature already carries it). */
export function buildChitChatsRateCacheKey({ address, subtotalCents, pkg }: ChitChatsRateCacheKeyInput): string {
  return JSON.stringify([
    address.name ?? "",
    address.addressLine1 ?? "",
    address.addressLine2 ?? "",
    address.city ?? "",
    address.province,
    address.postalCode,
    address.country,
    subtotalCents,
    pkg.weightLb,
    pkg.dimensionsIn,
  ]);
}

export class ChitChatsRateCache {
  private readonly store = new Map<string, ChitChatsRateCacheEntry>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  // `now` is injectable so a test can exercise TTL expiry deterministically, without a real
  // sleep -- the same pattern as every other injectable dependency in this checkout module.
  constructor(ttlMs: number = QUOTE_CACHE_TTL_MS, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  /** Returns a cached entry only if it exists AND hasn't expired -- an expired entry is treated
   *  identically to a miss (removed, not returned), so a caller never has to separately check
   *  staleness itself. Never returns a cached failure: see set() below, failures are never stored. */
  get(keyInput: ChitChatsRateCacheKeyInput): ChitChatsRateCacheEntry | null {
    const key = buildChitChatsRateCacheKey(keyInput);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  /** Only ever called by the caller with a SUCCESSFUL rate result -- there is no failure-caching
   *  path by construction (ChitChatsShippingProvider only calls this after its rate fetcher
   *  resolves, never from a catch block), so a transient outage or an unsupported destination is
   *  always retried on the next request instead of being remembered as a false answer. */
  set(keyInput: ChitChatsRateCacheKeyInput, rates: ShippingOption[], chitChatsShipmentId: string | null = null): void {
    this.store.set(buildChitChatsRateCacheKey(keyInput), { rates, chitChatsShipmentId, cachedAt: this.now() });
  }

  /** Explicit invalidation for a specific key -- e.g. once a cached quote's shipment is actually
   *  purchased (PATCH /shipments/{id}/buy, not implemented here -- no live credentials), the
   *  cache entry no longer represents an open quote and should stop being reused for a different
   *  order that happens to share the same address/parcel signature. */
  invalidate(keyInput: ChitChatsRateCacheKeyInput): void {
    this.store.delete(buildChitChatsRateCacheKey(keyInput));
  }

  /** Test/diagnostic only -- lets a test assert on how many distinct keys are currently cached. */
  size(): number {
    return this.store.size;
  }
}
