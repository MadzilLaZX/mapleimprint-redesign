-- Durably associates the EXACT genuine Chit Chats carrier quote used for a specific order, keyed
-- by a real foreign key to MapleOrder -- not a fingerprint reconstructed later from stored order
-- data. The prior admin shipping-quote lookup (chitChatsStoredQuoteLookup.ts) had to always return
-- null because MapleOrderLine never stored subcategorySlug/slug, so a historical order's quote
-- fingerprint couldn't be reliably rebuilt after the fact; that ambiguity can't exist here, since
-- this table is populated at the exact moment of order creation, inside the same request that
-- already has the real address/subtotal/package the quote was computed from.
--
-- NOT APPLIED to any live database by this commit -- prepared for review/approval only, same
-- convention as every other migration file in this directory. Intended target for approval is the
-- staging project (`mapleimprint-staging`) only; Production access remains paused this round.

create table if not exists "MapleOrderShippingQuote" (
  id uuid primary key default gen_random_uuid(),
  -- Unique, not just indexed: at most one associated quote per order, by design -- a retry of the
  -- same checkout (same orderId, reused via PaymentAttempt idempotency) must never create a second
  -- row; see chitChatsOrderQuoteAssociation.ts's own upsert-with-do-nothing call.
  "orderId" uuid not null unique references "MapleOrder"(id) on delete cascade,
  -- Literal constant, not inferred/guessed -- this table is only ever populated from a real,
  -- persisted ChitChatsShippingQuote row (see the association code), so "Chit Chats" is always
  -- accurate for every row that can ever exist here.
  carrier text not null default 'Chit Chats',
  -- The exact ShippingOption.label/id Chit Chats returned for the service actually selected --
  -- real strings from the carrier's own response (chitChatsShippingProvider.ts's
  -- mapChitChatsRateEntries), never invented.
  service text not null,
  "serviceCode" text not null,
  -- The REAL, undiscounted rate Chit Chats quoted for this service -- read from the persisted
  -- quote's own `rates` column (chitChatsQuoteStore.ts), which holds the raw pre-free-shipping-
  -- override amount. Deliberately NOT the same value as MapleOrder.shippingCents, which is what
  -- the customer was actually CHARGED (correctly $0 once the $300 free-shipping override applies)
  -- -- this column preserves what Chit Chats actually quoted, independent of that business policy.
  "originalQuotedCents" integer not null,
  -- Null if the persisted quote row never got a real chitChatsShipmentId (e.g. quoted via the
  -- rate-fetcher directly, without going through the coordinator's persisted store) -- never
  -- fabricated when absent.
  "chitChatsShipmentId" text null,
  -- Snapshot of the exact destination address the quote was computed for -- same shape as
  -- MapleOrder.shippingAddress's delivery fields, duplicated here (not just a cross-reference) so
  -- this row stays a complete, standalone record of what was quoted even if the order's own
  -- address were ever edited later (nothing in this codebase edits it today, but this table
  -- shouldn't silently become wrong if that ever changes).
  "destinationAddress" jsonb not null,
  -- When Chit Chats actually returned this quote (the persisted quote row's own createdAt) --
  -- distinct from "createdAt" below, which is when THIS association row was written (immediately
  -- after, in the same request, but not necessarily identical to the microsecond).
  "quotedAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "MapleOrderShippingQuote_orderId_idx" on "MapleOrderShippingQuote" ("orderId");

alter table "MapleOrderShippingQuote" enable row level security;
-- Deny-all, same posture as every other payment/order-adjacent table in 002_maple_orders.sql --
-- service-role only, never exposed to the anon key.
