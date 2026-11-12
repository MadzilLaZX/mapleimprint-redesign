import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShippingAddressInput, ShippingOption } from "./shippingProvider";
import type { ChitChatsPackageInput } from "./chitChatsShippingProvider.ts";
import { buildChitChatsRateCacheKey } from "./chitChatsRateCache.ts";

// Cross-serverless-instance counterpart to chitChatsRateCache.ts's in-process cache -- see that
// file's header for why deduplication matters at all (Chit Chats has no quote-only endpoint, so
// every cache miss is a real shipment creation). An in-memory Map only dedupes requests served by
// the SAME warm Vercel function instance; this store, backed by a Supabase table
// (ChitChatsShippingQuote, see supabase/migrations/010_chit_chats_shipping_quotes.sql -- NOT
// applied to the live database, prepared for approval only), is what closes that gap across
// instances/cold starts.
//
// CONCURRENCY DESIGN, stated plainly rather than overclaimed: `quoteFingerprint` carries a
// database UNIQUE constraint. `claim()` below does an INSERT ... ON CONFLICT DO NOTHING; exactly
// one concurrent caller's insert ever succeeds for a given fingerprint, and that caller is the
// only one that should proceed to call the real Chit Chats rate fetcher. A caller whose claim
// loses the race checks the existing row: if it's already 'ready' (filled in by an earlier,
// already-completed request), it reuses those rates with zero new Chit Chats calls. If the
// existing row is still 'pending' (the winner's own fetch is still in flight), this store does
// NOT poll or block for it -- the loser proceeds to call the fetcher itself too. In that narrow
// window, two near-simultaneous first-time requests for the identical fingerprint could each
// create a real Chit Chats shipment. This is a deliberate, documented tradeoff: a short-lived
// polling/backoff loop would close that gap further, but adds real complexity for what Chit
// Chats' own rate limit (2,000 req/5min) and harmless-to-delete unpurchased shipments make a low-
// cost, cleanable edge case -- not worth building until real traffic shows it matters.
//
// A FAILED rate fetch is never persisted here (see ChitChatsShippingProvider's caller code) --
// there is no 'failed' status value in the schema, by design, so a transient outage can never be
// mistaken for a valid cached answer on the next request.

export const QUOTE_PERSIST_TTL_MS = 10 * 60 * 1000; // app policy, matches chitChatsRateCache.ts's default

export interface ChitChatsPersistedQuoteKey {
  address: ShippingAddressInput;
  subtotalCents: number;
  pkg: ChitChatsPackageInput;
}

export interface ChitChatsPersistedQuote {
  fingerprint: string;
  status: "pending" | "ready";
  chitChatsShipmentId: string | null;
  rates: ShippingOption[] | null;
  purchasedAt: Date | null;
  expiresAt: Date;
}

/** SHA-256 of the same normalized fields chitChatsRateCache.ts's in-memory key already uses --
 *  hashed (rather than storing the raw JSON) purely so the database column is a short, fixed-
 *  length, index-friendly value; it carries no secrecy requirement of its own (an address isn't
 *  sensitive in the way a credential is), so a cryptographic hash is used here for its
 *  collision-resistance property, not for concealment. */
export function buildQuoteFingerprint(key: ChitChatsPersistedQuoteKey): string {
  return createHash("sha256").update(buildChitChatsRateCacheKey(key)).digest("hex");
}

export interface ChitChatsQuoteStore {
  /** Returns a non-expired, 'ready' row for this fingerprint, or null (not found, still pending,
   *  or expired). Never returns an expired row -- callers must never price a payment off a quote
   *  this method wouldn't hand back as fresh. */
  findReady(fingerprint: string, now: Date): Promise<ChitChatsPersistedQuote | null>;

  /** Attempts to claim a fingerprint for a NEW quote request, inserting a 'pending' placeholder.
   *  Returns { claimed: true } if this call's insert won the race (the caller should now call the
   *  real rate fetcher and then call fill()); returns { claimed: false, existing } if another
   *  request already holds this fingerprint. `existing` is only non-null if that other request's
   *  row is already 'ready' AND still fresh as of `now` -- a still-'pending' or expired row comes
   *  back as null (never handed to a caller as if it were usable), so the loser falls through to
   *  calling the real rate fetcher itself (see this file's header "CONCURRENCY DESIGN" note). */
  claim(
    key: ChitChatsPersistedQuoteKey,
    fingerprint: string,
    now: Date,
    expiresAt: Date,
  ): Promise<{ claimed: boolean; existing: ChitChatsPersistedQuote | null }>;

  /** Fills in a previously-claimed 'pending' row with a successful rate result, transitioning it
   *  to 'ready'. Only ever called after a successful fetch -- see this file's header. */
  fill(fingerprint: string, rates: ShippingOption[], chitChatsShipmentId: string | null): Promise<void>;

  /** Removes a claimed row entirely -- called when the real rate fetch FAILS, so a transient
   *  outage doesn't leave a permanently-stuck 'pending' row blocking every future request for the
   *  same fingerprint until it naturally expires. */
  release(fingerprint: string): Promise<void>;

  /** Marks a quote's shipment as purchased -- a future, separate, explicitly-authorized step (see
   *  chitChatsPostagePurchase.ts) calls this after a real PATCH /shipments/{id}/buy succeeds, so
   *  cleanup (deleteExpiredUnpurchased) can never remove it afterward. */
  markPurchased(fingerprint: string, now: Date): Promise<void>;

  /** Deletes expired, NEVER-purchased rows -- the application-level equivalent of this file's
   *  migration-comment cleanup query. Must never delete a row with purchasedAt set, matching Chit
   *  Chats' own "a purchased/received shipment cannot be deleted" rule. Returns the count removed. */
  deleteExpiredUnpurchased(now: Date): Promise<number>;
}

/** Real implementation, backed by the ChitChatsShippingQuote table -- NOT reachable from any live
 *  code path today (no caller constructs this against a real Supabase project this round; the
 *  table it targets hasn't been created, since the migration above hasn't been applied). Exists so
 *  activating persistence is a configuration/wiring change once the migration is approved, not
 *  something built from scratch under launch pressure later -- the same "architecture ready,
 *  intentionally inactive" pattern as canadaPostShippingProvider.ts and chitChatsShippingProvider.ts. */
export class SupabaseChitChatsQuoteStore implements ChitChatsQuoteStore {
  // Not a TS parameter-property -- plain `node --test`'s strip-only mode can't parse that syntax,
  // and this file's own test needs to run under it directly (same note as every other provider in
  // this module).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly supabaseAdmin: SupabaseClient<any, any, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabaseAdmin: SupabaseClient<any, any, any>) {
    this.supabaseAdmin = supabaseAdmin;
  }

  async findReady(fingerprint: string, now: Date): Promise<ChitChatsPersistedQuote | null> {
    const { data } = await this.supabaseAdmin
      .from("ChitChatsShippingQuote")
      .select("chitChatsShipmentId, rates, purchasedAt, expiresAt, status")
      .eq("quoteFingerprint", fingerprint)
      .eq("status", "ready")
      .gt("expiresAt", now.toISOString())
      .maybeSingle();
    if (!data) return null;
    return {
      fingerprint,
      status: "ready",
      chitChatsShipmentId: data.chitChatsShipmentId,
      rates: data.rates,
      purchasedAt: data.purchasedAt ? new Date(data.purchasedAt) : null,
      expiresAt: new Date(data.expiresAt),
    };
  }

  async claim(
    key: ChitChatsPersistedQuoteKey,
    fingerprint: string,
    now: Date,
    expiresAt: Date,
  ): Promise<{ claimed: boolean; existing: ChitChatsPersistedQuote | null }> {
    const { data: inserted } = await this.supabaseAdmin
      .from("ChitChatsShippingQuote")
      .upsert(
        {
          quoteFingerprint: fingerprint,
          status: "pending",
          destinationAddress: key.address,
          parcel: key.pkg,
          subtotalCents: key.subtotalCents,
          expiresAt: expiresAt.toISOString(),
        },
        { onConflict: "quoteFingerprint", ignoreDuplicates: true },
      )
      .select("quoteFingerprint")
      .maybeSingle();

    if (inserted) return { claimed: true, existing: null };

    const existing = await this.findReady(fingerprint, now);
    return { claimed: false, existing };
  }

  async fill(fingerprint: string, rates: ShippingOption[], chitChatsShipmentId: string | null): Promise<void> {
    await this.supabaseAdmin
      .from("ChitChatsShippingQuote")
      .update({ status: "ready", rates, chitChatsShipmentId, updatedAt: new Date().toISOString() })
      .eq("quoteFingerprint", fingerprint);
  }

  async release(fingerprint: string): Promise<void> {
    await this.supabaseAdmin.from("ChitChatsShippingQuote").delete().eq("quoteFingerprint", fingerprint).is("purchasedAt", null);
  }

  async markPurchased(fingerprint: string, now: Date): Promise<void> {
    await this.supabaseAdmin
      .from("ChitChatsShippingQuote")
      .update({ purchasedAt: now.toISOString() })
      .eq("quoteFingerprint", fingerprint);
  }

  async deleteExpiredUnpurchased(now: Date): Promise<number> {
    const { count } = await this.supabaseAdmin
      .from("ChitChatsShippingQuote")
      .delete({ count: "exact" })
      .lt("expiresAt", now.toISOString())
      .is("purchasedAt", null);
    return count ?? 0;
  }
}

/** In-memory fake implementing the exact same narrow interface -- NOT a mock of Supabase's wire
 *  protocol (this codebase's established pattern for DB-dependent logic, see
 *  fulfillOrder.integration.test.ts, is a real Supabase integration test gated behind an explicit
 *  opt-in env var, not a fake client). This fake exists so ChitChatsShippingProvider's business
 *  logic -- claim/fill/release/expiry/purchased-protection -- is fully unit-testable, fast and
 *  deterministic, without a live database, while chitChatsQuoteStore.integration.test.ts covers
 *  the real SQL/constraint behavior separately (skipped by default, same as that file). */
export class InMemoryChitChatsQuoteStore implements ChitChatsQuoteStore {
  private readonly rows = new Map<string, ChitChatsPersistedQuote>();

  async findReady(fingerprint: string, now: Date): Promise<ChitChatsPersistedQuote | null> {
    const row = this.rows.get(fingerprint);
    if (!row || row.status !== "ready") return null;
    if (row.expiresAt.getTime() <= now.getTime()) return null;
    return row;
  }

  async claim(
    _key: ChitChatsPersistedQuoteKey,
    fingerprint: string,
    now: Date,
    expiresAt: Date,
  ): Promise<{ claimed: boolean; existing: ChitChatsPersistedQuote | null }> {
    if (this.rows.has(fingerprint)) {
      return { claimed: false, existing: await this.findReady(fingerprint, now) };
    }
    this.rows.set(fingerprint, { fingerprint, status: "pending", chitChatsShipmentId: null, rates: null, purchasedAt: null, expiresAt });
    return { claimed: true, existing: null };
  }

  async fill(fingerprint: string, rates: ShippingOption[], chitChatsShipmentId: string | null): Promise<void> {
    const row = this.rows.get(fingerprint);
    if (!row) return;
    this.rows.set(fingerprint, { ...row, status: "ready", rates, chitChatsShipmentId });
  }

  async release(fingerprint: string): Promise<void> {
    const row = this.rows.get(fingerprint);
    if (row?.purchasedAt) return; // never remove a purchased row, even via release()
    this.rows.delete(fingerprint);
  }

  async markPurchased(fingerprint: string, now: Date): Promise<void> {
    const row = this.rows.get(fingerprint);
    if (!row) return;
    this.rows.set(fingerprint, { ...row, purchasedAt: now });
  }

  async deleteExpiredUnpurchased(now: Date): Promise<number> {
    let removed = 0;
    for (const [fingerprint, row] of this.rows) {
      if (row.purchasedAt) continue;
      if (row.expiresAt.getTime() < now.getTime()) {
        this.rows.delete(fingerprint);
        removed++;
      }
    }
    return removed;
  }

  // Test/diagnostic only.
  size(): number {
    return this.rows.size;
  }
}
