-- NOT APPLIED -- prepared for review/approval only, same as every other "not yet run" migration
-- convention in this repo. Do not run this against the live `maple-imprint-catalogue` Supabase
-- project without explicit approval.
--
-- REVISED (same round, before ever being applied): the first version of this table only had a
-- 'pending'/'ready' status with no ownership/lease concept, which meant a request that lost the
-- unique-constraint race while another request's row was still 'pending' would fall through and
-- call Chit Chats itself anyway -- preventing duplicate DATABASE ROWS, but not duplicate EXTERNAL
-- SHIPMENTS, which is the actual requirement. This revision adds claim ownership tokens and a
-- short lease so losing requests can safely WAIT for or take over a claim instead of racing the
-- external API. See src/lib/checkout/chitChatsQuoteCoordinator.ts for the full algorithm this
-- schema supports.
--
-- Backs ChitChatsShippingProvider's persistent, cross-serverless-instance quote cache. Chit Chats
-- has no quote-only API endpoint -- getting a rate IS creating a real shipment record (confirmed
-- against their docs, https://chitchats.com/docs/api/v1) -- so this table exists specifically to
-- stop concurrent requests for the same cart/address/parcel from each creating a separate Chit
-- Chats shipment, across however many warm Vercel function instances happen to be serving traffic
-- at once. An in-process cache (chitChatsRateCache.ts) already covers the single-instance case;
-- this table is the shared, cross-instance coordination layer underneath it.
--
-- Money/pricing fields are NOT stored here -- taxProvider.ts and the order total computation are
-- unaffected by this table's existence. This table only ever holds carrier RATE QUOTES (what Chit
-- Chats would charge), never the price the customer was actually charged.

create table if not exists "ChitChatsShippingQuote" (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 hex of the same normalized (address, subtotalCents, parcel weight/dimensions) input
  -- chitChatsRateCache.ts's in-memory key already uses -- UNIQUE so a second concurrent request
  -- for the identical quote collides on this constraint (its INSERT ... ON CONFLICT DO NOTHING
  -- affects zero rows) instead of each request creating its own Chit Chats shipment row. This is
  -- the one DB-level guarantee the whole coordination scheme is built on: at most one row can
  -- ever exist per fingerprint, full stop.
  "quoteFingerprint" text not null unique,
  -- 'pending' from the moment a request claims this fingerprint (before the real Chit Chats call
  -- resolves) to 'ready' once rates are filled in. There is no 'failed' value, by design -- a
  -- failed rate fetch releases (deletes) its own row instead, via a token-checked DELETE, so a
  -- transient outage can never be mistaken for a valid cached answer.
  status text not null default 'pending' check (status in ('pending', 'ready')),
  -- Identifies which in-flight request currently owns this fingerprint's 'pending' claim (or most
  -- recently owned it, once 'ready'). Every mutating operation on a 'pending' row (fill, release,
  -- lease takeover) is a conditional UPDATE/DELETE that also matches on this token -- this is the
  -- compare-and-swap that stops a stale/crashed/slow worker from overwriting a newer result once
  -- someone else has taken over the lease (see chitChatsQuoteCoordinator.ts).
  "ownerToken" text not null,
  -- Short-lived (tens of seconds, NOT the same as the full quote freshness window below) --
  -- represents "how long we expect a real Chit Chats call to reasonably take." A 'pending' row
  -- whose lease has expired is a SUSPECTED crashed/hung worker, not a confirmed one -- the owner
  -- may have actually succeeded and just failed to report back. Recovery from this state requires
  -- reconciliation before any new external call is attempted (see coordinator's own header on why
  -- this can't be done with full certainty against Chit Chats' documented API surface).
  "leaseExpiresAt" timestamptz not null,
  -- Null until a real Chit Chats shipment exists (the default rate-fetcher stub never sets this;
  -- no live credentials exist in this codebase today). This is what a later purchase step
  -- (PATCH /shipments/{id}/buy, not implemented/wired anywhere yet -- see
  -- chitChatsPostagePurchase.ts) must reuse, instead of creating a second shipment at pay time for
  -- a cart that was already quoted.
  "chitChatsShipmentId" text null,
  -- The full recipient/address and parcel inputs the quote was computed from -- needed to
  -- actually reuse/purchase the real shipment later, same data MapleOrder.shippingAddress already
  -- stores for a delivery order, under the same deny-all RLS model below.
  "destinationAddress" jsonb not null,
  "parcel" jsonb not null,
  "subtotalCents" integer not null,
  -- ShippingOption[] -- null while status = 'pending', filled in once the real rate fetch
  -- succeeds.
  rates jsonb null,
  -- Set only once postage is actually purchased (a future, separate, explicitly-authorized step --
  -- never implied by this table's existence). Cleanup of abandoned/expired quotes below must
  -- never delete a row with this set, matching Chit Chats' own real rule (a purchased or received
  -- shipment cannot be deleted, only refunded/voided).
  "purchasedAt" timestamptz null,
  -- Full quote freshness window (minutes), distinct from the much shorter leaseExpiresAt above.
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Supports the cleanup query below (range scan on expiresAt) and "is this fingerprint still
-- fresh" lookups that also filter on expiresAt.
create index if not exists "ChitChatsShippingQuote_expiresAt_idx" on "ChitChatsShippingQuote" ("expiresAt");
-- Supports the coordinator's "is the current pending claim's lease still live" check without a
-- full table scan.
create index if not exists "ChitChatsShippingQuote_leaseExpiresAt_idx" on "ChitChatsShippingQuote" ("leaseExpiresAt");

alter table "ChitChatsShippingQuote" enable row level security;
-- Deliberately no policies for anon/authenticated -- deny-all, the same model as
-- MapleOrder/PaymentAttempt/ProcessedWebhookEvent (002_maple_orders.sql). Every access path is
-- server-only through src/lib/server/supabaseAdmin.ts's service-role client, which bypasses RLS
-- entirely. A customer's own address/quote data in this table is never reachable via the anon key.

-- Cleanup of abandoned quotes (customer requested a quote, never completed checkout) -- NOT a live
-- cron, just the query a future scheduled job should run. Two safety conditions, both required:
--   - "purchasedAt" is null: a purchased or received Chit Chats shipment must never be deleted,
--     mirroring Chit Chats' own API rule.
--   - "leaseExpiresAt" < now(): never race an ACTIVELY-leased row, even if its quote-level
--     expiresAt has somehow already passed (shouldn't happen in practice since leaseExpiresAt is
--     always far shorter than expiresAt, but cheap to guard explicitly rather than assume).
--   delete from "ChitChatsShippingQuote"
--   where "expiresAt" < now() and "purchasedAt" is null and "leaseExpiresAt" < now();
