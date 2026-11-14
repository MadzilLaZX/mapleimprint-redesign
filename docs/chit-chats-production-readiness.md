# Chit Chats production-readiness review

As of this round (following `c4c388c`): the real (non-stub) `ChitChatsRateFetcher` and a real,
deliberately conservative `ChitChatsShipmentReconciler` were implemented and mocked-tested -- see
"This round's changes" below. No real Chit Chats account, staging credentials, Supabase migration
application, or postage purchase happened -- only code, exercised exclusively against mocked
`fetch`. This file distinguishes exactly what's actually been verified from what's only been
exercised against a stand-in, to avoid either overclaiming readiness or re-litigating work already
done.

## This round's changes

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
- **The real `fetchChitChatsRates` implementation itself** (request shape, response mapping,
  error handling) — 7 tests against a mocked `global.fetch`, and **the real
  `chitChatsOrderIdReconciler` implementation** (exact-match filtering, the "never return false"
  rule) — 7 more tests against a mocked `global.fetch`. Neither has ever been exercised against
  `staging.chitchats.com` or production -- see "Unverified external API behavior".
- **`ChitChatsQuoteStore` / `ChitChatsQuoteCoordinator`'s entire concurrency model** (claim/wait/
  takeover/reconcile, CAS token rejection, lease expiration, cleanup safeguards) — 37 tests, all
  against `InMemoryChitChatsQuoteStore`, a hand-written fake of the intended Postgres semantics,
  never real Postgres/PostgREST. See `docs/chit-chats-supabase-validation.md` for exactly what
  remains to validate against the real thing.
- **The postage-purchase stub** (`chitChatsPostagePurchase.ts`) — 5 tests, all against the same
  in-memory fake; the real `PATCH /shipments/{id}/buy` call is a throwing stub, never implemented.

## Unverified external API behavior (documented, but not exercised against a live account)

- Exact `Authorization` header format (bearer prefix vs. raw token) — docs show an example without
  stating the rule explicitly.
- Whether staging (`staging.chitchats.com`) uses the same credentials as production, or its own.
- Whether `order_id`-via-`q`-full-text-search reliably matches a 64-character SHA-256 fingerprint
  (the field and parameter are confirmed to exist in the docs; matching behavior against a string
  that long/high-entropy is not confirmed) -- see the staging validation doc's step 4.
- The real shape of a `rates[]` entry in practice (field names are documented; real-world values
  for a specific parcel/destination are not).
- `DELETE /shipments/{id}`'s exact success-path documentation is thin (only failure preconditions
  are spelled out) -- the 204 response itself is standard but worth confirming empirically.
- `SupabaseChitChatsQuoteStore.takeOver()`'s two-separate-conditional-UPDATE approach, and the
  `.upsert(..., { ignoreDuplicates: true })` / `.delete({ count: "exact" })` calls elsewhere in
  that file -- written against documented PostgREST/Supabase-js behavior, never run against a real
  Postgres instance.

## Business information or credentials required (unchanged from prior rounds, not re-litigated)

- Chit Chats API access token + client ID (no account exists).
- Confirmed GST/HST registration status (only the 13% Ontario rate has been confirmed; separate
  from registration, which gates Production tax activation).
- Separate BC/SK/MB PST and Quebec QST registration confirmation (gates the `pstQstEnabled` flag).
- `OWNER_NOTIFICATION_EMAIL`.
- Ship-from address confirmation for whichever carrier is activated.
- Confirmation that Maple's general business hours (shown in `pickupLocation.ts`) are also valid
  specifically for order pickup, not just walk-in/showroom hours.

## Minimum remaining engineering work to activate Chit Chats, once staging validation succeeds

In dependency order -- each step assumes the previous ones are done:

1. **Obtain credentials** (Chit Chats token + client ID), set `CHIT_CHATS_ENVIRONMENT`,
   `CHIT_CHATS_API_ACCESS_TOKEN`, `CHIT_CHATS_CLIENT_ID` (placeholders already in `.env.example`),
   and run `docs/chit-chats-staging-validation.md` against them.
2. **DONE this round** (code only, never run against a real account) -- `fetchChitChatsRates` in
   `chitChatsShippingProvider.ts` is now the real `POST /clients/<id>/shipments` call. What's left
   before this can actually run for real: run `docs/chit-chats-staging-validation.md` step 1-3
   against real credentials to confirm the request shape this implementation sends is accepted
   as-is (field names/formats were built from docs, never round-tripped against a live account),
   and construct an actual `ChitChatsShippingProvider(fetchChitChatsRates, ...)` somewhere once
   step 1's credentials exist (nothing calls it with the real fetcher today).
3. **PARTIALLY DONE this round** -- `chitChatsOrderIdReconciler` in the new
   `chitChatsShipmentReconciler.ts` implements the safe direction only (a confirmed exact match ->
   adopt it) using `GET /shipments?q=<fingerprint>` with a client-side exact-`order_id` filter; it
   never returns `"false"`, so it's safe to wire in as `ChitChatsQuoteCoordinator`'s `reconciler`
   option as-is without staging validation (it can only ever make things safer than the default
   `"unknown"`, never less safe). What's still gated on step 1 + the staging doc's step 4: deciding
   whether zero exact matches can ever safely become `"false"` instead of `"unknown"` -- that
   requires confirming `q`'s real-world miss rate against a 64-char hex string, which still hasn't
   happened (no staging credentials exist; a prior read-only probe against
   `staging.chitchats.com` returned 404).
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
