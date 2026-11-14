# Chit Chats production-readiness review

As of the latest round (following `797c862`): real production credentials now exist locally
(`.env.local`), confirmed to work against `https://chitchats.com` (a read-only `GET /shipments`
returned 200) -- `https://staging.chitchats.com` returned 404 for this account, so **production is
the only reachable environment**; see "Round 2" below for what that round changed and found,
including a confirmed real bug in the request shape the previous round shipped. No real shipment
has been created, refreshed, deleted, or had postage purchased in either round -- only code,
exercised exclusively against mocked `fetch`, plus one documentation-research pass against the
live OpenAPI spec (a public, unauthenticated page -- no credentials involved). This file
distinguishes exactly what's actually been verified from what's only been exercised against a
stand-in, to avoid either overclaiming readiness or re-litigating work already done.

## Round 2 changes (production test preparation, no real shipment created)

- **Confirmed, via the real OpenAPI spec embedded in https://chitchats.com/docs/api/v1 (not just
  its prose examples), that `size_x`/`size_y`/`size_z` are top-level-`required` fields on
  `POST /shipments`.** Round 1's `fetchChitChatsRates` assumed otherwise ("the docs don't show
  them as strictly required") and omitted them whenever `pkg.dimensionsIn` was null -- which it
  always is today (no product in the catalogue carries a per-unit dimension). **This means every
  real call Round 1's fetcher would have made was guaranteed to fail Chit Chats' own validation.**
  Fixed: `fetchChitChatsRates` now throws a clear `ShippingRateUnavailableError` ("We don't have
  package dimensions for this order yet...") before ever reaching the network when dimensions are
  missing, rather than sending a doomed request -- and, per the standing "never fabricate a
  business fact" rule, this is NOT fixed by inventing a default box size. **No real Chit Chats
  rate can succeed for any product today until real per-product (or per-shipment-class)
  dimensions exist somewhere in this codebase** -- a harder blocker than previously documented.
- **Confirmed the same spec types `weight`/`size_x`/`size_y`/`size_z` as `number`, not `string`.**
  Round 1's fetcher sent all four as `.toFixed(2)` strings. Fixed to send real JSON numbers.
  `scripts/chit-chats-staging-check.mjs` had the same issue; fixed there too for consistency.
- Updated `chitChatsRateFetcher.test.ts` to cover the new dimensions-required preflight and
  assert numeric (not string) body fields. 179/179 tests still passing; `tsc --noEmit` and
  `eslint` clean.
- **New `scripts/chit-chats-production-rate-check.mjs`** -- the production equivalent of
  `chit-chats-staging-check.mjs`, since staging is unreachable for this account. Stricter gating
  than its staging sibling: refuses outright unless `CHIT_CHATS_ENVIRONMENT=production`; always
  runs the one safe read-only `GET /shipments?limit=1` auth check; then, if destination/parcel
  fields aren't all configured, reports exactly which are missing and stops; otherwise defaults to
  a **dry run** (prints the exact request body it would send, sends nothing) unless both
  `--execute` and `CHIT_CHATS_PRODUCTION_TEST_APPROVED` (an exact required phrase) are supplied,
  in which case it runs the same create → inspect rates → look up by `order_id` → delete sequence
  as the staging script, never calling `PATCH /shipments/{id}/buy`. **Not run this round, in any
  mode, including the dry run** -- see this doc's "Exact approval needed" section for why.
  New `.env.example` placeholders: `CHIT_CHATS_TEST_WEIGHT_LB`, `_WEIGHT_UNIT`, `_SIZE_X/Y/Z`,
  `_SIZE_UNIT`, `_VALUE_CAD`, `_DESCRIPTION`, and `CHIT_CHATS_PRODUCTION_TEST_APPROVED` -- all
  unset; none invented.
- Re-confirmed (this round, against the live spec, not just prior rounds' prose-doc reading): the
  `Authorization` header is the raw token with no `Bearer ` prefix (already what
  `chitChatsClient.ts` sends); there is still no quote-only endpoint (`POST /shipments` is the only
  way to get a real rate); `DELETE /shipments/{id}` returns `204` and is blocked only by purchased
  postage or `received` status; `GET /shipments?q=` searches `id`/`to_name`/`order_id` but its
  exact-vs-fuzzy matching behavior is still not documented (unchanged from Round 1's finding).

## Exact approval needed before any real shipment is created

A single real, deletable, unpurchased draft shipment against the PRODUCTION account requires, from
the business owner, ALL of the following -- none of which this codebase will ever invent:

1. **A real parcel to test with**: its actual weight and length/width/height. There is no
   per-product dimension data anywhere in this codebase (confirmed, see Round 2 above) -- pick one
   real product (or a representative box) and measure it.
2. **A real, approved test destination**: recipient name, street address, city, province, postal
   code (country defaults to CA). Should be an address you control (e.g. the business's own, or a
   staff member's) so a stray real draft shipment is traceable and easy to clean up.
3. **A declared customs/insurance value** (CAD) and a **shipment description** for that parcel --
   both required fields on `POST /shipments`.
4. **Confirmation of the Chit Chats account's Settings > Returns origin address** -- this is
   account-level configuration no API call or script here can see or override; confirm directly in
   the Chit Chats dashboard that it's the correct ship-from address before running anything.
5. **Explicit go-ahead to run `scripts/chit-chats-production-rate-check.mjs --execute`** with
   `CHIT_CHATS_PRODUCTION_TEST_APPROVED` set to the exact phrase in that script's header, after
   setting items 1-3 as env vars and confirming item 4.

Once all five exist, the procedure is: run the script in its default dry-run mode first (shows the
exact request without sending it, using the real values from 1-3) to review, then re-run with
`--execute` and the approval phrase set to actually create, inspect, and delete the one real draft.

## Round 1 changes

- **`fetchChitChatsRates` (`chitChatsShippingProvider.ts`) is now a real implementation**, not the
  throwing stub: a real `POST /clients/<id>/shipments` call via `fetch`, using
  `src/lib/server/chitChatsClient.ts`'s URL/header helpers, `postage_type: "unknown"`, `order_id`
  set to `buildQuoteFingerprint()`'s output, and `rates[]` mapped into `ShippingOption[]` (shared
  via the new exported `mapChitChatsRateEntries()`). Still throws `ShippingRateUnavailableError`
  -- never a fabricated rate -- on missing credentials, a network failure, a non-2xx response, or
  an unparseable body. 14 new tests (`chitChatsRateFetcher.test.ts`,
  `chitChatsShipmentReconciler.test.ts`) exercise this against a mocked `global.fetch`, never a
  real network call. 179/179 tests passing (165 prior + 14 new); `tsc --noEmit` and `eslint` clean.
- **`chitChatsClient.ts` no longer `import`s `"server-only"`.** It's now actually used by a
  module (`chitChatsShippingProvider.ts`) that `node --test` imports directly; that Next.js guard
  throws under plain Node outside a Next.js build, which broke every Chit Chats test transitively.
  See that file's updated header for why this is an acceptable trade (Next.js only inlines
  `NEXT_PUBLIC_*` env vars into client bundles; this file reads no such variable).
- **A real `ChitChatsShipmentReconciler` now exists** (`chitChatsShipmentReconciler.ts`,
  `chitChatsOrderIdReconciler`) implementing `GET /shipments?q=<fingerprint>` with a client-side
  exact-match filter on `order_id`. Deliberately asymmetric: returns a genuine `"true"` (adopt,
  skip a new external call) only on exactly one exact match with usable rates; returns the
  existing conservative `"unknown"` default for everything else -- zero matches, multiple matches,
  a match with no usable rates, a non-2xx response, a network failure, or missing credentials. It
  **never returns `"false"`**, because `q`'s full-text-search reliability against a 64-character
  hex fingerprint is still unconfirmed (see "Unverified external API behavior" below) and a false
  "confirmed absent" would let the coordinator create a real duplicate shipment -- the exact
  failure mode this system exists to prevent. **Not wired as `ChitChatsQuoteCoordinator`'s default
  reconciler** (that remains `unknownReconciler`) -- exported for a caller to opt into once
  credentials exist, same pattern as `SupabaseChitChatsQuoteStore`.
- **Still NOT activated anywhere**: `shippingProvider.ts`'s live export is still
  `FreeShippingProvider`; no caller constructs a real `ChitChatsShippingProvider` with these real
  fetcher/reconciler functions. `chitChatsPostagePurchase.ts`'s `purchasePostageViaChitChats` is
  still a throwing stub (out of scope this round, per standing "no real postage purchases" rule).
  No migration applied; no real credentials used anywhere, including in tests.

## Verified functionality (tested against something real, not a fake)

- **GST/HST tax calculation** — live-browser-verified: a real $13.99 Ontario order produced $1.82
  HST and a $15.81 total through the actual checkout UI, matching 13% exactly.
- **Ottawa pickup checkout flow** — live-browser-verified end-to-end: selector → contact → Square
  card form loads → correct $0-shipping total; switching back to delivery recalculates correctly.
- **Server-side total authority** — confirmed by direct code read that `/api/checkout/pay`'s
  `totalCents` is built solely from server-recomputed subtotal + shipping + tax, with no
  client-supplied total ever reaching Square (this round didn't touch this code path, re-confirmed
  it's unchanged).
- **The free-shipping serviceability gate** — real logic, real tests (not mocked externally,
  since the gate itself is pure application logic): an unserviceable/oversized destination cannot
  receive a fabricated $0 rate, confirmed by unit tests exercising the actual `ChitChatsShippingProvider`
  class.

## Mock-tested functionality (exercised only against in-memory fakes, not a real dependency)

- **`ChitChatsShippingProvider`'s rate-fetching, caching, and free-shipping logic** — 21+ tests,
  all against an injected fake `ChitChatsRateFetcher`, never a real Chit Chats call.
- **The real `fetchChitChatsRates` implementation itself** (request shape, numeric field types,
  the dimensions-required preflight, response mapping, error handling) — 6 tests against a mocked
  `global.fetch`, and **the real `chitChatsOrderIdReconciler` implementation** (exact-match
  filtering, the "never return false" rule) — 8 more tests against a mocked `global.fetch`.
  Neither has ever been exercised against a real `fetch` to `chitchats.com` or
  `staging.chitchats.com` -- see "Unverified external API behavior".
- **`ChitChatsQuoteStore` / `ChitChatsQuoteCoordinator`'s entire concurrency model** (claim/wait/
  takeover/reconcile, CAS token rejection, lease expiration, cleanup safeguards) — 37 tests, all
  against `InMemoryChitChatsQuoteStore`, a hand-written fake of the intended Postgres semantics,
  never real Postgres/PostgREST. See `docs/chit-chats-supabase-validation.md` for exactly what
  remains to validate against the real thing.
- **The postage-purchase stub** (`chitChatsPostagePurchase.ts`) — 5 tests, all against the same
  in-memory fake; the real `PATCH /shipments/{id}/buy` call is a throwing stub, never implemented.

## Confirmed this round (via the live OpenAPI spec + the owner's own production probe)

- `Authorization` header: raw token, no `Bearer ` prefix. (Matches `chitChatsClient.ts`'s existing
  implementation -- no code change needed.)
- `staging.chitchats.com` is simply unreachable for this account (404) -- not an ambiguous
  "maybe needs separate credentials" question anymore. `chitchats.com` (production) is confirmed
  reachable with the real credentials now in `.env.local` (a read-only `GET /shipments` returned
  200).
- `size_x`/`size_y`/`size_z` are schema-`required` on `POST /shipments`, typed `number` (not
  `string`) -- see "Round 2" above. This was previously assumed optional; that was wrong.
- `weight` is also typed `number`, not `string`.
- `DELETE /shipments/{id}` returns `204`; blocked only by purchased postage or `received` status.
- There is still no quote-only endpoint -- `POST /shipments` with `postage_type: "unknown"` remains
  the only way to see a real rate.

## Still unverified (not resolved by this round's documentation research)

- Whether `order_id`-via-`q`-full-text-search reliably matches a 64-character SHA-256 fingerprint
  (the field and parameter are confirmed to exist; matching behavior against a string that
  long/high-entropy is not confirmed by the spec itself) -- only a real request against the
  production account can resolve this, which has not happened.
- The real shape/values of a `rates[]` entry for an ACTUAL parcel/destination (field names are now
  schema-confirmed; real-world values are not, since no real rate request has been made).
- `SupabaseChitChatsQuoteStore.takeOver()`'s two-separate-conditional-UPDATE approach, and the
  `.upsert(..., { ignoreDuplicates: true })` / `.delete({ count: "exact" })` calls elsewhere in
  that file -- written against documented PostgREST/Supabase-js behavior, never run against a real
  Postgres instance. Unrelated to this round's Chit Chats work.

## Business information or credentials required

- ~~Chit Chats API access token + client ID~~ -- **now exist**, configured locally in `.env.local`,
  confirmed working against production. What's still needed: see "Exact approval needed" above
  (a real parcel's weight/dimensions, an approved test destination, a declared value/description,
  and confirmation of the account's Settings > Returns origin address) before the first real rate
  request can be attempted.
- Confirmed GST/HST registration status (only the 13% Ontario rate has been confirmed; separate
  from registration, which gates Production tax activation).
- Separate BC/SK/MB PST and Quebec QST registration confirmation (gates the `pstQstEnabled` flag).
- `OWNER_NOTIFICATION_EMAIL`.
- Confirmation that Maple's general business hours (shown in `pickupLocation.ts`) are also valid
  specifically for order pickup, not just walk-in/showroom hours.

## Minimum remaining engineering work to activate Chit Chats, once staging validation succeeds

In dependency order -- each step assumes the previous ones are done:

1. **DONE** -- real Chit Chats token + client ID exist locally and are confirmed working against
   production. `docs/chit-chats-staging-validation.md`'s procedure targets
   `staging.chitchats.com`, which is confirmed UNREACHABLE for this account (404) -- use
   `scripts/chit-chats-production-rate-check.mjs` against production instead (see "Exact approval
   needed" above); that doc's step-by-step expectations (response shapes, status codes) remain
   valid, just against the other host.
2. **DONE this round** (code only, never run against a real account) -- `fetchChitChatsRates` in
   `chitChatsShippingProvider.ts` is now the real `POST /clients/<id>/shipments` call, with
   Round 2's dimensions-required/numeric-type fixes applied. What's left before this can actually
   run for real: run `scripts/chit-chats-production-rate-check.mjs` (dry run first) against real
   values to confirm the request shape is accepted as-is (built from the official spec, never
   round-tripped against a live account), and construct an actual
   `ChitChatsShippingProvider(fetchChitChatsRates, ...)` somewhere once that's confirmed (nothing
   calls it with the real fetcher today).
3. **PARTIALLY DONE this round** -- `chitChatsOrderIdReconciler` in the new
   `chitChatsShipmentReconciler.ts` implements the safe direction only (a confirmed exact match ->
   adopt it) using `GET /shipments?q=<fingerprint>` with a client-side exact-`order_id` filter; it
   never returns `"false"`, so it's safe to wire in as `ChitChatsQuoteCoordinator`'s `reconciler`
   option as-is without further validation (it can only ever make things safer than the default
   `"unknown"`, never less safe). What's still gated on a real request succeeding: deciding
   whether zero exact matches can ever safely become `"false"` instead of `"unknown"` -- that
   requires confirming `q`'s real-world miss rate against a 64-char hex string against production
   (staging is unreachable), which still hasn't happened.
4. **Implement the real postage-purchase call** (`chitChatsPostagePurchase.ts`'s
   `purchasePostageViaChitChats`, currently a throwing stub) -- `PATCH /shipments/{id}/buy`.
5. **Review and apply migration 010**, after running the procedure in
   `docs/chit-chats-supabase-validation.md` against an isolated target (local Docker stack or an
   explicitly-approved new cloud project) and confirming the unverified items in that doc's
   checklist.
6. **Wire the activated pieces together**: construct a real `SupabaseChitChatsQuoteStore` +
   `ChitChatsQuoteCoordinator` and pass it into the `ChitChatsShippingProvider` that becomes
   `shippingProvider.ts`'s live export (currently `FreeShippingProvider`) -- a one-line swap once
   everything above exists, consistent with this codebase's established activation pattern.
7. **Decide on and implement a real cleanup job** for `deleteExpiredUnpurchased()` -- today it's
   only a documented SQL query in the migration's own comment, with no scheduled job calling it.
   A Vercel Cron hitting a small API route is the natural fit, not built this round (no code
   change was in scope without evidence it's needed yet).
8. **Separate Production-activation approval** once 1-7 are done and verified -- unchanged from
   every prior round's stop condition.
