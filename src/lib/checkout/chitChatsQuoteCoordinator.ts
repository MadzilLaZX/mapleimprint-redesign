import type { ShippingOption } from "./shippingProvider";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";
import type { ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";
import {
  buildQuoteFingerprint,
  generateOwnerToken,
  DEFAULT_LEASE_DURATION_MS,
  QUOTE_PERSIST_TTL_MS,
  type ChitChatsQuoteStore,
  type ChitChatsPersistedQuoteKey,
} from "./chitChatsQuoteStore.ts";

// The distributed-coordination ALGORITHM built on top of chitChatsQuoteStore.ts's token/CAS
// primitives. Split into its own file so the data-access layer (store) and the
// wait/retry/reconciliation policy (this file) can be reasoned about and tested independently.
//
// THE CORE PROBLEM THIS EXISTS TO FIX: an earlier version of this cache let a request that lost
// the claim race against a still-pending row fall through and call Chit Chats itself anyway --
// which stopped duplicate DATABASE ROWS but not duplicate EXTERNAL SHIPMENTS, which is the actual
// requirement (Chit Chats has no quote-only endpoint -- every rate fetch is a real shipment
// creation). This coordinator instead makes a losing request WAIT (bounded) for the owner to
// finish, and only ever calls the external fetcher itself when it has genuinely won a claim or
// safely recovered one.
//
// RECONCILIATION AND ITS HONEST LIMIT (the hardest part of this problem, stated plainly rather
// than overclaimed): when a 'pending' claim's lease expires, the owning worker is PRESUMED
// crashed/hung -- but it may have actually called Chit Chats successfully and just failed to
// report back (a network blip after the real shipment was already created, a function timeout
// after the external call returned, etc.). In that case, blindly letting a recovering worker call
// Chit Chats again WOULD create a real duplicate shipment -- the exact outcome this whole system
// exists to prevent. The only correct fix is to check, before creating anything new, whether the
// presumed-crashed worker's shipment actually exists. Chit Chats' documented request fields
// include `order_id` (caller-supplied, shipment-level metadata) and `GET /shipments` is described
// as paginated/filterable -- the natural design is to set `order_id` to this quote's fingerprint
// on every real creation call, so a later lookup can search for it. **This has NOT been verified
// against a live Chit Chats account** (no credentials exist in this codebase, and their public
// docs page reviewed this engagement didn't enumerate GET /shipments's exact filter fields) -- so
// the `reconciler` parameter below defaults to a stub that honestly reports "cannot confirm"
// rather than asserting a lookup mechanism that hasn't been confirmed to work. Per the explicit
// requirement that drove this design: if duplicate prevention can't be guaranteed, this
// coordinator does NOT proceed to create a new shipment -- it surfaces a clear, retryable error
// instead. A real reconciler implementation (once credentials exist and the real filter behavior
// is confirmed) is a drop-in replacement, not a redesign.

export interface ChitChatsReconciliationResult {
  /** true: a real shipment was found for this fingerprint -- adopt it, no new external call.
   *  false: confirmed none exists -- safe to create one for real.
   *  "unknown": cannot confirm either way -- the conservative, default outcome (see header). */
  outcome: true | false | "unknown";
  rates?: ShippingOption[];
  chitChatsShipmentId?: string;
}

export type ChitChatsShipmentReconciler = (
  fingerprint: string,
  key: ChitChatsPersistedQuoteKey,
) => Promise<ChitChatsReconciliationResult>;

/** Honest default: no live Chit Chats account exists to query, so this can never confirm anything
 *  -- see this file's header. Always triggers the conservative "don't guess" path. */
const unknownReconciler: ChitChatsShipmentReconciler = async () => ({ outcome: "unknown" });

export interface ChitChatsQuoteCoordinatorOptions {
  /** How long a claim is trusted before being treated as possibly-abandoned. Short relative to the
   *  quote's own freshness window (QUOTE_PERSIST_TTL_MS) -- it represents "how long a real Chit
   *  Chats call should reasonably take," not "how long a quote stays usable." */
  leaseDurationMs?: number;
  /** Delay between polling attempts while waiting for another worker's live lease. */
  pollIntervalMs?: number;
  /** Hard cap on polling attempts before returning a controlled retryable error -- bounds total
   *  added latency to roughly maxPollAttempts * pollIntervalMs, never an unbounded wait. */
  maxPollAttempts?: number;
  /** Injectable so tests can run the bounded-wait logic without real elapsed time. */
  sleep?: (ms: number) => Promise<void>;
  reconciler?: ChitChatsShipmentReconciler;
  now?: () => Date;
}

const DEFAULTS = {
  leaseDurationMs: DEFAULT_LEASE_DURATION_MS,
  pollIntervalMs: 200,
  maxPollAttempts: 8,
};

/**
 * Coordinates a single getOrCreateQuote() call against the persistent store, implementing the
 * full claim/wait/takeover/reconcile state machine. Never holds a database transaction open while
 * waiting on anything external -- every store call here is a single fast statement, and the only
 * thing ever awaited alongside "real work" is the rate fetcher itself (never inside a DB
 * transaction) and bounded `sleep()` calls between polling attempts.
 */
export class ChitChatsQuoteCoordinator {
  private readonly store: ChitChatsQuoteStore;
  private readonly leaseDurationMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly reconciler: ChitChatsShipmentReconciler;
  private readonly now: () => Date;

  constructor(store: ChitChatsQuoteStore, options: ChitChatsQuoteCoordinatorOptions = {}) {
    this.store = store;
    this.leaseDurationMs = options.leaseDurationMs ?? DEFAULTS.leaseDurationMs;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULTS.pollIntervalMs;
    this.maxPollAttempts = options.maxPollAttempts ?? DEFAULTS.maxPollAttempts;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.reconciler = options.reconciler ?? unknownReconciler;
    this.now = options.now ?? (() => new Date());
  }

  async getOrCreateQuote(
    key: ChitChatsPersistedQuoteKey,
    fetchRates: ChitChatsRateFetcher,
  ): Promise<ShippingOption[]> {
    const fingerprint = buildQuoteFingerprint(key);

    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const now = this.now();
      const ownerToken = generateOwnerToken();
      const outcome = await this.store.claimOrInspect(
        key,
        fingerprint,
        now,
        ownerToken,
        new Date(now.getTime() + QUOTE_PERSIST_TTL_MS),
        new Date(now.getTime() + this.leaseDurationMs),
      );

      switch (outcome.kind) {
        case "ready":
          return outcome.quote.rates ?? [];

        case "owner":
          return this.fetchAndFill(fingerprint, outcome.ownerToken, key, fetchRates);

        case "wait":
          await this.sleep(this.pollIntervalMs);
          continue;

        case "stale": {
          if (!outcome.wasPending) {
            // Ordinary cache expiry (the quote was genuinely fetched and filled before, it's just
            // old now) -- no crash ambiguity, safe to take over and refetch directly.
            const tookOver = await this.store.takeOver(
              fingerprint,
              outcome.priorOwnerToken,
              ownerToken,
              now,
              new Date(now.getTime() + QUOTE_PERSIST_TTL_MS),
              new Date(now.getTime() + this.leaseDurationMs),
            );
            if (!tookOver) continue; // state changed underneath us -- re-inspect from the top
            return this.fetchAndFill(fingerprint, ownerToken, key, fetchRates);
          }

          // 'pending' with an expired lease -- a PRESUMED crash, not a confirmed one. Reconcile
          // BEFORE taking over anything, per this file's header.
          const reconciliation = await this.reconciler(fingerprint, key);
          if (reconciliation.outcome === "unknown") {
            // Requirement: do not blindly retry external creation if duplicate prevention cannot
            // be guaranteed. Surface a clear, retryable error rather than guessing.
            throw new ShippingRateUnavailableError(
              "We couldn't confirm your shipping quote right now — please try again in a moment.",
            );
          }

          const tookOver = await this.store.takeOver(
            fingerprint,
            outcome.priorOwnerToken,
            ownerToken,
            now,
            new Date(now.getTime() + QUOTE_PERSIST_TTL_MS),
            new Date(now.getTime() + this.leaseDurationMs),
          );
          if (!tookOver) continue; // original owner finished late, or someone else recovered first

          if (reconciliation.outcome === true && reconciliation.rates && reconciliation.chitChatsShipmentId) {
            // The presumed-crashed worker's shipment actually exists -- adopt it, no new external
            // call at all.
            await this.store.fill(fingerprint, ownerToken, reconciliation.rates, reconciliation.chitChatsShipmentId);
            return reconciliation.rates;
          }

          // reconciliation.outcome === false -- confirmed no shipment exists, safe to create one.
          return this.fetchAndFill(fingerprint, ownerToken, key, fetchRates);
        }
      }
    }

    throw new ShippingRateUnavailableError(
      "We're having trouble confirming a shipping quote for this address right now — please try again shortly.",
    );
  }

  private async fetchAndFill(
    fingerprint: string,
    ownerToken: string,
    key: ChitChatsPersistedQuoteKey,
    fetchRates: ChitChatsRateFetcher,
  ): Promise<ShippingOption[]> {
    let rates: ShippingOption[];
    try {
      rates = await fetchRates(key.address, key.subtotalCents, key.pkg);
    } catch (err) {
      // A non-owning caller has nothing of its own to release -- but fetchAndFill() is only ever
      // invoked by the request that currently owns ownerToken, so release() always targets this
      // call's own claim. It's still CAS-protected (own token required) so it's a no-op, not
      // harmful, even in the unlikely event the lease was already taken over by the time this
      // runs.
      await this.store.release(fingerprint, ownerToken);
      throw err;
    }
    if (rates.length === 0) {
      await this.store.release(fingerprint, ownerToken);
      throw new ShippingRateUnavailableError(
        "Chit Chats has no delivery service available for this address — request a quote and we'll confirm shipping manually.",
      );
    }

    // chitChatsShipmentId: null -- the current ChitChatsRateFetcher signature only returns
    // ShippingOption[], not the real shipment id Chit Chats would have created alongside those
    // rates. A real (non-stub) fetcher will need its own return-shape update to surface that id
    // (also needed to set the `order_id` reconciliation hook above relies on) -- deferred until
    // that real fetcher exists.
    const applied = await this.store.fill(fingerprint, ownerToken, rates, null);
    if (!applied) {
      // Lost the lease while the external call was in flight (took longer than leaseDurationMs,
      // and someone else recovered it) -- our own result is still correct and real, it just
      // couldn't be persisted for others. Returning it is correct; it is NOT re-queried from the
      // store, since doing so could return a DIFFERENT worker's (also valid) answer and silently
      // substitute it for the one actually billed/shown to this caller's flow.
      return rates;
    }
    return rates;
  }
}
