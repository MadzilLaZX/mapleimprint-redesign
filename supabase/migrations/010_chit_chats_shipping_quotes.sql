-- NOT APPLIED -- prepared for review/approval only, same as every other "not yet run" migration
-- convention in this repo. Do not run this against the live `maple-imprint-catalogue` Supabase
-- project without explicit approval.
--
-- Backs ChitChatsShippingProvider's persistent, cross-serverless-instance quote cache
-- (src/lib/checkout/chitChatsQuoteStore.ts). Chit Chats has no quote-only API endpoint -- getting
-- a rate IS creating a real shipment record (confirmed against their docs,
-- https://chitchats.com/docs/api/v1) -- so this table exists specifically to stop repeated
-- requests for the same cart/address/parcel from each creating a separate Chit Chats shipment,
-- across however many warm Vercel function instances happen to be serving traffic at once. An
-- in-process cache (chitChatsRateCache.ts) already covers the single-instance case; this table is
-- the shared layer underneath it.
--
-- Money/pricing fields are NOT stored here -- taxProvider.ts and the order total computation are
-- unaffected by this table's existence. This table only ever holds carrier RATE QUOTES (what Chit
-- Chats would charge), never the price the customer was actually charged.

create table if not exists "ChitChatsShippingQuote" (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 hex of the same normalized (address, subtotalCents, parcel weight/dimensions) input
  -- chitChatsRateCache.ts's in-memory key already uses -- UNIQUE so a second concurrent request
  -- for the identical quote collides on this constraint (its INSERT ... ON CONFLICT DO NOTHING
  -- affects zero rows) instead of each request creating its own Chit Chats shipment.
  "quoteFingerprint" text not null unique,
  -- 'pending' from the moment a request claims this fingerprint (before the real Chit Chats call
  -- resolves) to 'ready' once rates are filled in. A request that loses the unique-constraint race
  -- while the winner's row is still 'pending' falls through and calls Chit Chats itself rather
  -- than blocking/polling -- see chitChatsQuoteStore.ts's own header for why that's an accepted,
  -- documented tradeoff, not an oversight.
  status text not null default 'pending' check (status in ('pending', 'ready')),
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
  -- succeeds. A FAILED rate fetch never reaches this table at all (see chitChatsQuoteStore.ts) --
  -- there is no "failed" status value, by design, so a transient Chit Chats outage can never be
  -- mistaken for a cached, valid answer.
  rates jsonb null,
  -- Set only once postage is actually purchased (a future, separate, explicitly-authorized step --
  -- never implied by this table's existence). Cleanup of abandoned/expired quotes below must
  -- never delete a row with this set, matching Chit Chats' own real rule (a purchased or received
  -- shipment cannot be deleted, only refunded/voided).
  "purchasedAt" timestamptz null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Supports both the cleanup query below (range scan on expiresAt) and "is this fingerprint still
-- fresh" lookups that also filter on expiresAt.
create index if not exists "ChitChatsShippingQuote_expiresAt_idx" on "ChitChatsShippingQuote" ("expiresAt");

alter table "ChitChatsShippingQuote" enable row level security;
-- Deliberately no policies for anon/authenticated -- deny-all, the same model as
-- MapleOrder/PaymentAttempt/ProcessedWebhookEvent (002_maple_orders.sql). Every access path is
-- server-only through src/lib/server/supabaseAdmin.ts's service-role client, which bypasses RLS
-- entirely. A customer's own address/quote data in this table is never reachable via the anon key.

-- Cleanup of abandoned quotes (customer requested a quote, never completed checkout) -- NOT a live
-- cron, just the query a future scheduled job should run. `purchasedAt is null` is the hard
-- safety condition: a purchased or received Chit Chats shipment must never be deleted by cleanup,
-- mirroring Chit Chats' own API rule.
--   delete from "ChitChatsShippingQuote" where "expiresAt" < now() and "purchasedAt" is null;
