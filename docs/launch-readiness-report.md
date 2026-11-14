# Maple Imprint launch-readiness report

Rewritten this round (`checkout-square-payments` @ `a683df7` going into this session) — the
previous version of this document was written at `2a7bbef`, before the Chit Chats/packaging work
existed, and described a Canada Post / `ZeroTaxProvider` architecture that's since been replaced.
Nothing in "Verified working" below that's unchanged from that round was re-tested live this
round (no browser/Preview access in this environment) — it's carried forward as "last confirmed
at an earlier commit," explicitly marked where that applies, not re-claimed as freshly verified.

## Verified working (automated tests + direct code reading, this round)

- **204/204 automated tests passing**, `tsc --noEmit` clean, `eslint` clean (pre-existing warnings
  only), `next build` succeeds (2040+ static pages) — all re-run this round after every change.
- Server-authoritative checkout totals: `/api/checkout/pay` recomputes subtotal/shipping/tax from
  scratch server-side on every call, never trusts a client-supplied total (confirmed by direct
  code read, unchanged this round).
- Payment idempotency: `PaymentAttempt.idempotencyKey` has a real DB unique constraint; a
  double-submit/retry reuses the existing attempt/order rather than double-charging.
- **Fixed this round**: a double-submit race that lost the `PaymentAttempt` unique-constraint race
  previously left an orphaned, never-paid `MapleOrder` behind forever (confirmed by code reading,
  fixed in an earlier commit this round, re-verified still present at `a683df7`+).
- **Fixed this round**: the analogous race in `/api/quote` (Request a Quote) — a duplicate
  `idempotencyKey` submission used to exhaust 3 retry attempts and return a confusing error
  instead of the already-created reference. Now re-fetches and returns the winner's reference.
- **Fixed this round**: `/admin`'s session-cookie validation (`src/lib/admin/session.ts`) threw
  uncaught inside `proxy.ts`'s middleware if `ADMIN_SESSION_SECRET` was unset and any
  cookie-shaped value was present — would have 500'd the entire admin section instead of
  redirecting to login. Now fails closed (treats any validation error as "invalid session").
  6 new regression tests.
- Chit Chats packaging architecture is now wired end-to-end (product id flows from checkout
  pricing through to `ChitChatsShippingProvider.getOptions()`, which resolves a real owner-measured
  box the moment one is assigned) — see `docs/chit-chats-production-readiness.md` for the full
  history. Still inactive: `shippingProvider.ts`'s live export remains `FreeShippingProvider`.
- Confirmed via direct code read: free shipping can never bypass carrier serviceability --
  `ChitChatsShippingProvider.getOptions()` always attempts a real rate fetch first; the free-
  shipping override is applied only after that fetch succeeds, never before or instead of it.
- Confirmed via Vercel's own API (not assumed): the GitHub App integration is installed for the
  `MadzilLaZX` namespace. See "Vercel project status" below — this does NOT mean no project exists.
- No server secret is reachable from any client component (`supabaseAdmin`/`squareClient` grepped
  across `src/components/` — zero imports). Only 3 `NEXT_PUBLIC_*` variables exist anywhere in the
  codebase, all intentionally public (Square's own client-side SDK IDs, not secrets).
- `npm run build` succeeds with every optional credential (Chit Chats, Resend, Google, Telegram,
  Photoroom, n8n, Supabase, Square, Admin) completely unset — confirmed directly, not assumed.

## Vercel project status — important correction

**A Vercel project almost certainly already exists** — `next.config.ts`'s own `images.unoptimized`
comment (commit `aa2e872`) documents a real Production deployment at `mapleimprint.ca` that
returned live Vercel error codes under real traffic. The standing blocker, already known before
this round (see the prior version of this document), is **"Vercel API access for Claude —
dashboard-level reconnection — currently works via manual dashboard actions only."** Two rounds
of this engagement's own Vercel API checks (listing projects by repo URL, by name, unfiltered,
across every connected team) found zero projects — that confirms Claude's current API connection
isn't authorized against whichever Vercel account/team actually owns the live project, not that
the project doesn't exist. **Do not create a new Vercel project without first confirming with the
owner whether the existing one should be reconnected instead** — see
`docs/vercel-preview-setup.md` for the full procedure and environment-variable checklist.

## Verified working (last confirmed at an earlier commit, `2a7bbef` — not re-tested live this round)

- Homepage, navigation, Shop grid, category pages, product pages.
- Custom Product Studio: drinkware 2D/3D, apparel print-zone placement, layers, pricing.
- Square payment integration: SDK loads, card fields render — no real payment ever submitted.
- Admin authentication and order management (unauthenticated → redirect; authenticated → order
  list with correct statuses) — the auth mechanism itself was hardened further this round (see
  above), but the admin UI/data display was not re-tested live.
- Customer design/artwork persistence: zero broken references, zero missing frozen snapshots,
  zero broken asset URLs, as of that commit's live database snapshot.
- Mobile responsiveness at 390×844.

## Features only mock-tested (never exercised against a real external dependency)

- **Everything Chit Chats**: rate fetching, shipment reconciliation, quote caching/concurrency,
  packaging-profile resolution — 100+ tests against mocked `fetch` and in-memory fakes, zero real
  API calls except two prior rounds' read-only probes the account owner ran directly (confirmed
  200 against production, 404 against staging). See `docs/chit-chats-production-readiness.md`.
- `SupabaseChitChatsQuoteStore`'s real Postgres/PostgREST behavior (migration 010 not applied) --
  only the in-memory fake has been exercised.
- The new `/api/admin/chit-chats-quotes/cleanup` route — logic reviewed, never actually run (the
  table it targets doesn't exist yet).

## Outstanding technical blockers

| Blocker | What's needed | Owner |
|---|---|---|
| Claude's Vercel API access | Reconnection to whichever account/team owns the existing `mapleimprint.ca` project (or a deliberate decision to start a separate one) | You / Vercel |
| No real Chit Chats packaging profile | Measure at least one real shipping box; add one entry to `packagingProfiles.ts` | You |
| `order_id`/`q` search reliability | A real request against the production Chit Chats account — not yet attempted | You (approval) + Claude |
| Chit Chats account vs. website address discrepancy | A business decision on which address is correct for what purpose | You |
| Migration 010 not applied | Review + apply, ideally after the isolated-integration-test procedure in `docs/chit-chats-supabase-validation.md` | You |
| S&S Activewear image access (last confirmed blocking, not re-checked this round) | Supplier response on Cloudflare 403 | S&S Activewear |
| GST/HST and PST/QST registration confirmation | Accountant confirmation | You / accountant |
| `OWNER_NOTIFICATION_EMAIL` | Standing decision from a prior round: left unset deliberately | You |

## Required business-owner information

- A real parcel's weight + dimensions (at least one product) for the first packaging profile.
- Confirmation of which address is correct: the website's published Ottawa address
  (`src/lib/constants.ts`) vs. the Chit Chats account's on-file address — and whether they're even
  supposed to be the same address (pickup vs. ship-from/returns may legitimately differ).
- GST/HST registration status; separate BC/SK/MB/QC PST/QST registration status.
- Confirmation of Maple's pickup-specific hours (vs. general business hours currently shown).
- `OWNER_NOTIFICATION_EMAIL` real value, if/when you want new-order/new-lead staff alerts enabled.

## Required external account configuration

- Vercel: reconnect Claude's API access, or confirm manual-dashboard-only is acceptable going
  forward; either way, see `docs/vercel-preview-setup.md` for the environment-variable checklist
  before any Preview is meaningfully testable (Supabase service role key, Square sandbox keys,
  admin password/session secret).
- Chit Chats: a measured packaging profile (above) before any real rate request can succeed.
- Supabase: migration 010 review + application (see `docs/chit-chats-supabase-validation.md`'s
  new deployment checklist).

## Exact safe order for the remaining activation steps

1. **Vercel Preview** — reconnect/confirm the project (see "Vercel project status" above), set the
   Preview-scoped environment variables per `docs/vercel-preview-setup.md`, confirm the Preview
   deployment smoke-tests cleanly (homepage, product page, `/checkout` with a Square sandbox card,
   `/admin/login`).
2. **Chit Chats validation** — provide one real packaging profile + an approved test destination,
   then run `scripts/chit-chats-production-rate-check.mjs` in dry-run mode first, review the exact
   request it would send, then re-run with `--execute` and the approval phrase for one real,
   deletable draft shipment. This is the only step in this entire list that touches a real
   external carrier account.
3. **Database migration** — once Chit Chats validation confirms the request/response shapes this
   codebase assumes, run the isolated integration-test procedure in
   `docs/chit-chats-supabase-validation.md`, then apply migration 010 to the live project following
   that doc's new deployment checklist.
4. **Wire the live shipping provider** — construct a real `SupabaseChitChatsQuoteStore` +
   `ChitChatsQuoteCoordinator`, swap `shippingProvider.ts`'s export from `FreeShippingProvider` to
   the real `ChitChatsShippingProvider` — a deliberate, separate, approved code change.
5. **Payment testing** — Square sandbox end-to-end (card entry → order creation → webhook →
   confirmation email) on the Preview deployment from step 1, still no real card.
6. **Production activation** — only after 1-5 are each independently confirmed, and only with your
   explicit, separate approval; follow `docs/production-deployment-checklist.md`'s existing
   deployment order and pre-flight checks (which predate this round and should be re-read in full,
   not skimmed, since they cover Square webhook config and the owner-notification-email decision).

## Rollback and failure-response considerations

- **Vercel**: every previous Production deployment stays available — "Promote to Production" on
  the last-known-good one is the fastest rollback, no git revert needed (see
  `production-deployment-checklist.md`).
- **Migration 010**: purely additive (one new table, two indexes, RLS) — `drop table if exists
  "ChitChatsShippingQuote";` cleanly reverses it, but only before `shippingProvider.ts`'s export is
  switched to a real Chit Chats provider (step 4 above); if that's already live, revert the code
  first, then the schema — see `docs/chit-chats-supabase-validation.md`'s new rollback section.
- **A real Chit Chats shipment created during step 2's test**: deletable via `DELETE
  /shipments/{id}` as long as postage was never purchased (confirmed against the live API spec) --
  the test script itself handles this automatically in a `finally` block, reporting loudly if
  deletion doesn't confirm.
- **Admin session secret rotation**: changing `ADMIN_SESSION_SECRET` invalidates every existing
  staff session immediately (by design) without affecting `ADMIN_PASSWORD` — safe to rotate at any
  time if a session token is ever suspected compromised.

## Recommendation

Do not claim Production readiness from automated tests alone — none of this round's test suite
exercises a real Chit Chats account, a real Postgres instance, a real Square payment, or a real
Vercel deployment. The checkout/payment/tax/pickup pipeline is well-tested at the code level and
several real bugs were found and fixed this round precisely by reading the code rather than
trusting it; that's a different, narrower claim than "verified in production." The single most
valuable next step is resolving the Vercel API access question, since every other remaining step
(Preview testing, Chit Chats validation, migration application) depends on having a real
deployment to test against.
