# Owner handoff checklist

A short, skimmable action list. Every item links to the document with the full reasoning/
procedure — this file is deliberately just the "what, in what order, and where to read more,"
not a re-explanation. Written at `checkout-square-payments` @ `add3a8b`-and-later.

## Do these in order

1. **Decide: reconnect Claude's Vercel API access, or keep it dashboard-only?**
   A real Vercel project almost certainly already exists for `mapleimprint.ca` — nothing needs
   creating. → `docs/vercel-preview-setup.md` ("Important: a Vercel project almost certainly
   already exists").
2. **Set Preview environment variables** (Supabase service role key, Square *sandbox* keys,
   admin password/session secret — everything else can stay unset). → `docs/vercel-preview-setup.md`
   ("Minimum environment variables for a working Preview").
3. **Smoke-test the Preview deployment**: homepage, a product page, `/checkout` with a Square
   sandbox test card, `/admin/login`. → `docs/production-deployment-checklist.md`'s existing
   smoke-test scope, run against Preview first.
4. **Measure one real shipping box** and add it to `packagingProfiles.ts` (file comments explain
   exactly what to enter) — nothing about real Chit Chats rates can work without this.
5. **Approve one controlled Chit Chats production test**: run
   `scripts/chit-chats-production-rate-check.mjs` in dry-run mode first (shows the exact request,
   sends nothing), review it, then re-run with `--execute` + the approval phrase for one real,
   deletable draft shipment. → `docs/chit-chats-production-readiness.md` ("Exact approval
   needed before any real shipment is created").
6. **Resolve the Chit Chats account vs. website address question** — which address is correct for
   pickup vs. ship-from/returns, and whether they're even supposed to match. A business decision,
   not something this codebase will guess.
7. **Apply migration 010** (the Chit Chats shipping-quote cache table), following the isolated-test
   procedure first. → `docs/chit-chats-supabase-validation.md` ("Migration 010 deployment
   checklist").
8. **Wire the real shipping provider live** — a deliberate, separate, small code change
   (`shippingProvider.ts`'s export) once 4-7 are done.
9. **Confirm GST/HST registration** with an accountant (separately, PST/QST per-province).
   Tax logic is already built and environment-gated; this is purely a compliance decision.
10. **Decide `OWNER_NOTIFICATION_EMAIL`** — currently left unset on purpose; set a real address
    once you want new-order/new-lead staff alerts.
11. **Production activation** — only after 1-9 are each independently confirmed, with your
    explicit separate approval. → `docs/production-deployment-checklist.md` (full deployment
    order, pre-flight checks, rollback procedure).

## Items with no action required from you right now

- **S&S Activewear image access**: still blocked on the supplier's own Cloudflare 403. A request
  has been drafted and is waiting on you to send it (see `docs/launch-checklist-final-2026-11-12.md`)
  — the website-side fallback UI (a styled "Image coming soon" placeholder instead of a broken
  image icon) was gap-filled this round on the one page that was missing it (the main product
  page's image gallery) and is confirmed present everywhere else (Shop grid, homepage, cart,
  checkout order summary).
- **Everything else in `docs/launch-readiness-report.md`'s blocker table** that isn't listed above
  — either already resolved, or genuinely has no further engineering work possible until you
  provide the input listed there.

## What changed this round (context, not actions)

- Fixed a real bug: cart lines of the *same* product across multiple variants (e.g. two colours
  of one T-shirt) were only checked against the first line's quantity when resolving a packaging
  profile — could have silently under-counted a parcel. Now sums correctly across all matching
  lines.
- Fixed a missing error-fallback on the main product page's image gallery (and the cart/checkout
  thumbnails) — a blocked supplier image now shows the same styled placeholder used elsewhere on
  the site, not a broken-image icon, on the page that matters most for a purchase decision.
- Added 35 new regression tests for previously-untested logic directly relevant to this handoff's
  scope: design-freeze/artwork persistence, order/quote reference generation, Square error-message
  mapping, lead scoring, and the packaging-variant fix above. 239/239 tests passing overall.
- Corrected stale documentation (`ZeroTaxProvider`/Canada Post references that no longer matched
  the live code) in `production-deployment-checklist.md`.
