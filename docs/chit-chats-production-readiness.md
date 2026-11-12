# Chit Chats production-readiness review

As of commit `87c1922` + this round's documentation-only follow-up. No code changes required this
round (see `docs/chit-chats-staging-validation.md` and `docs/chit-chats-supabase-validation.md`
for the procedures that would need real credentials/a real database to run). This file distinguishes
exactly what's actually been verified from what's only been exercised against a stand-in, to avoid
either overclaiming readiness or re-litigating work already done.

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

1. **Obtain credentials** (Chit Chats token + client ID) and run
   `docs/chit-chats-staging-validation.md` against them.
2. **Implement the real `ChitChatsRateFetcher`** (currently `fetchChitChatsRates`, a throwing
   stub in `chitChatsShippingProvider.ts`) -- the actual `POST /clients/<id>/shipments` call,
   mapping the response `rates[]` into `ShippingOption[]`, setting `order_id` to
   `buildQuoteFingerprint()`'s output (or a validated prefix of it, depending on step 1's findings).
3. **If reconciliation via `order_id`/`q` is confirmed reliable**: implement a real
   `ChitChatsShipmentReconciler` (currently always returns `"unknown"`) using
   `GET /shipments?q=<fingerprint>`. If not reliable, no code change is needed -- the existing
   conservative default is also the permanent fallback (see the staging doc's last section).
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
