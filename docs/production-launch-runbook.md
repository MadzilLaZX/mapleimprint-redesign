# Production launch runbook

Written 2026-11-24 at `checkout-square-payments`, against the real, currently-configured state of
Vercel project `mapleimprint-redesign`, Supabase, Square, and Chit Chats — not assumptions. Where a
fact couldn't be confirmed without exposing a secret value or without a business decision only the
owner can make, that's stated explicitly rather than guessed.

This is a reference document, not a script — nothing in it has been executed against Production.
No Production env var, Supabase setting, branch, or payment was touched to produce it.

---

## 1. Pre-launch checks

### Vercel
- Project `mapleimprint-redesign`, this branch deploys to Preview only. Production deploys only
  from `main` (confirm this is still true in Project Settings → Git before the first Production
  deploy — if it's ever been changed, that's a decision to review, not assume).
- Domain `mapleimprint.ca` — confirm it's attached to this project and points at Production, not a
  stale deployment.

### Supabase
- Two projects exist: `mapleimprint-staging` (what Preview/dev use today) and the real Production
  project. They must never be confused — `knownProductionSupabaseProject.ts` exists specifically so
  local scripts/tests refuse to run against the Production project by name.
- **Confirmed by direct inspection of Vercel's env vars this round**: Production has
  `SUPABASE_SERVICE_ROLE_KEY` set, but has **no** `NEXT_PUBLIC_SUPABASE_URL` or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` entry at all (Preview has all three, pointed at staging). Per
  `docs/environment-configuration.md`, this isn't a silent-breakage risk — both Supabase clients
  fail closed with a named "X is not set" error rather than guessing a project — but it is a real
  gap: as configured right now, every Supabase-dependent Production request (checkout, Studio,
  quotes, admin) would fail. This is covered as a mandatory blocker in section 3 and the GO/NO-GO
  checklist below.
- `design-uploads` storage bucket: confirm current Production bucket visibility (public vs
  private) before deploying — see section 4, this is a deliberate, separate step, not bundled into
  the code deploy.

### Square
- `NEXT_PUBLIC_SQUARE_ENVIRONMENT`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`,
  `NEXT_PUBLIC_SQUARE_LOCATION_ID`, `SQUARE_ACCESS_TOKEN` are already set for Production in Vercel
  (confirmed present by key name only — values were not read or logged). Whether
  `NEXT_PUBLIC_SQUARE_ENVIRONMENT` is actually set to `production` (live money) rather than
  `sandbox` needs direct confirmation in the Vercel dashboard before go-live — this document does
  not read secret values, so it can't confirm the value itself, only that the key exists.
- `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` are both set for Production.
  The webhook route (`src/app/api/webhooks/square/route.ts`) refuses to process an event if either
  is missing, and separately rejects any request with an invalid signature — confirm in Square's
  own Developer Dashboard that the configured webhook subscription URL matches
  `SQUARE_WEBHOOK_NOTIFICATION_URL`'s value exactly (`https://mapleimprint.ca/api/webhooks/square`
  is the expected shape) and that it's subscribed to the payment/order events this app consumes.

### Chit Chats
- Confirmed present in **Preview only**: `CHIT_CHATS_ENVIRONMENT`, `CHIT_CHATS_CLIENT_ID`,
  `CHIT_CHATS_API_ACCESS_TOKEN`. Production has none of the three. This is correct and intentional
  for today — `resolveShippingProvider` keeps Production on `FreeShippingProvider` regardless, so
  these variables would do nothing in Production yet even if added early. Don't add them to
  Production ahead of the code change in section 2 step 5 — doing so has no effect and risks
  confusion about what's actually active.
- At least one real, measured `PACKAGING_PROFILES` entry must exist before the real shipping
  policy can quote anything other than "Request a Shipping Quote" — see
  `docs/packaging-measurement-worksheet.md`. Confirmed still zero entries as of this writing.
- The Chit Chats account's on-file Settings → Returns origin address vs. `BUSINESS.addressLine1` in
  `src/lib/constants.ts` discrepancy (owner-reported 2026-11-15) remains unresolved — no API exists
  to check this programmatically; it requires logging into the Chit Chats dashboard directly. See
  `docs/owner-handoff-checklist.md` section 5.

### Tax configuration
- `resolveTaxProvider` returns `ZeroTaxProvider` for Production unconditionally
  (`src/lib/checkout/taxProvider.ts:121-123`) — this is a deliberate code gate, not a config toggle.
  The 13% Ontario HST *rate* is correctly coded in `canadianTaxRates.ts`, but GST/HST
  *registration* status has not been confirmed by the owner/accountant. Activating real tax in
  Production requires both: (a) registration confirmed, and (b) a deliberate, reviewed code change
  to this function's Production branch — never a dashboard flip.
- PST/QST (BC/SK/MB/QC) stays off even after GST/HST is confirmed — a separate registration
  decision per province, gated by the `pstQstEnabled` constructor flag.

### Product catalogue
- No action identified for this runbook beyond what's already tracked in
  `docs/owner-handoff-checklist.md` section 2 (SanMar/S&S image-access outreach — optional, not a
  launch blocker; the catalogue already degrades honestly to a styled placeholder when a supplier
  image is unavailable).

### Customer artwork
- Covered in full by section 4 below (private-bucket migration) — this is the one piece of
  "customer artwork" readiness that's still outstanding for Production specifically.

---

## 2. Deploying `checkout-square-payments` → Production, after owner approval

Only do this after every mandatory blocker in section 3's checklist and this section's own
pre-conditions are satisfied. Each step is independently checkable before moving to the next.

1. **Final review of the diff** between `main` and `checkout-square-payments` (e.g.
   `git diff main...checkout-square-payments` or the equivalent PR view) — a human read, not an
   automated gate.
2. **Set any missing Production environment variables first** (section 3) — specifically
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the real Production Supabase
   project. Setting env vars does not deploy anything by itself; do this before the merge so the
   very first Production deploy on the new code already has what it needs.
3. **Merge `checkout-square-payments` into `main`** via a normal reviewed PR (not a direct push) —
   this triggers Vercel's Production deployment from `main`.
4. **Watch the Production deployment reach `READY`** in the Vercel dashboard before telling anyone
   the new version is live. If it fails to build, nothing currently live is affected — the previous
   Production deployment keeps serving traffic until a new one succeeds.
5. **Smoke-test Production immediately**: load the homepage, browse a category, open Studio and
   confirm a design loads/saves, submit one real page load of `/checkout` far enough to see a tax
   and shipping total calculated (don't complete payment yet — that's section 5, a separate,
   explicitly-approved step). Confirm tax shows $0 (expected, per section 1) and shipping shows
   free (expected, per `FreeShippingProvider`) — if either shows something else, stop and
   investigate before proceeding to real-money testing.
6. **Only after the above**, proceed to section 5's controlled real-payment verification.

Activating real tax and/or real shipping in Production (the `resolveTaxProvider` /
`resolveShippingProvider` Production branches) is a **separate, later, deliberate code change** —
not part of this deploy sequence, and not safe to bundle into it. Do it as its own reviewed PR once
the business prerequisites (GST/HST registration confirmed; at least one measured packaging
profile; shipping-origin discrepancy resolved) are actually met.

---

## 3. Production environment variables — gaps and verification needed

No values are shown below — only which keys exist or are missing, confirmed directly against
Vercel's current configuration for this project.

**Confirmed present for Production** (key names only): `SQUARE_ACCESS_TOKEN`,
`NEXT_PUBLIC_SQUARE_ENVIRONMENT`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`,
`NEXT_PUBLIC_SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SHEET_ID`,
`GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`.

**Confirmed missing for Production — mandatory before launch:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — without these, every
  Supabase-dependent route fails closed (see section 1). This must be the real Production Supabase
  project's values, not staging's.

**Confirmed missing for Production — not launch-blocking, but worth a deliberate decision:**
- `CHIT_CHATS_API_ACCESS_TOKEN`, `CHIT_CHATS_CLIENT_ID`, `CHIT_CHATS_ENVIRONMENT` — correctly absent
  today; add only alongside the code change that moves Production off `FreeShippingProvider`.
- `OWNER_NOTIFICATION_EMAIL` — unset in both Preview and Production. Site functions without it;
  simply means no staff alert email on new orders/leads until set.
- `N8N_ORDER_CONFIRMATION_WEBHOOK_URL` — set in Preview only, no Production entry found. If this
  workflow (paid-order → n8n → Drive/Sheets handoff) is expected to run for real Production orders,
  this needs to be added before launch; confirm with whoever owns the n8n workflow whether a
  Production-specific webhook URL is expected here or whether this integration is intentionally
  Preview/staging-only for now.

**Needs direct dashboard verification (this document cannot read the value):**
- `NEXT_PUBLIC_SQUARE_ENVIRONMENT`'s actual value for Production — confirm it reads `production`
  (not `sandbox`) before any real-money test in section 5.

---

## 4. Private-bucket migration procedure

Full detail and the completed staging dress rehearsal are in `docs/private-bucket-cutover.md` —
summarized here for the runbook; see that document for the complete audit table and rationale.

**Pre-condition**: this round's signed-URL code (already in `checkout-square-payments`) must be
live in Production before flipping the bucket — not the other way around.

1. Deploy the code (section 2) first.
2. In the Supabase dashboard (Production project) → Storage → `design-uploads` → bucket settings:
   switch `public` → private. Prefer low-traffic hours; any in-flight request holding an old plain
   public URL stops working the instant this flips.
3. **Smoke-test immediately**, in this order (each depends on data the previous step produced):
   Studio upload + fresh-reload canvas check → remove-background → submit a quote with an attached
   file → view that quote's status page → view it as admin → download its ZIP.
4. Confirm Production's `storage.objects` policies (Authentication → Policies, scoped to
   `design-uploads`) have no `anon` `SELECT`/listing policy — matching staging's posture. Production
   policy was never captured as SQL in this repo, so this is a direct dashboard check.
5. Watch server logs for `[storage] createSignedUrl failed` / `threw` for the first hour.

**Rollback**: flip the bucket back to public in the Supabase dashboard. The signed-URL code works
correctly against a public bucket too (it just produces a harmless extra signature on an
already-public object) — no code rollback needed either direction.

---

## 5. Controlled real-money payment verification

This is the one step in this whole runbook that touches real money. It requires explicit owner
approval immediately before doing it — not a standing authorization from this document.

1. Confirm `NEXT_PUBLIC_SQUARE_ENVIRONMENT` is `production` (section 3) and that sections 2–4 are
   already complete and smoke-tested.
2. Owner (or someone the owner designates) places **one real order using a real card, for a small,
   genuinely refundable amount**, through each fulfillment path that's live at launch (at minimum:
   Ottawa pickup; a delivery order if real shipping is active, otherwise confirm delivery still
   correctly shows free shipping/$0 tax as designed).
3. Confirm: the amount actually charged on the card matches subtotal + shipping + tax exactly as
   shown on the confirmation page: the Square webhook fires and is recorded (check
   `SQUARE_WEBHOOK_NOTIFICATION_URL`'s logs or the app's own webhook-event table); the order
   confirmation email sends via Resend; the uploaded design file is retrievable from the
   (by-then-private) bucket on the confirmation/admin pages.
4. **Refund the test charge** through the Square dashboard once every check above passes.
5. Only after this passes does "launch" mean real customers can pay — do not announce launch before
   this step completes successfully.

---

## 6. Order confirmation, notification, shipping, and fulfillment checks

- **Order confirmation page**: already verified to show "Design approved" only for genuinely custom
  orders (recent commit `5012ade`) — no action needed, listed here as a known-correct behavior to
  re-check during the section 5 real-order test, not re-audit now.
- **Payment webhook**: `src/app/api/webhooks/square/route.ts` refuses to process without both
  `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` set, and separately verifies
  the request signature — confirm both are the values from Square's real Production webhook
  subscription, not leftover Sandbox ones.
- **Order confirmation email**: sent via Resend (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`, both present
  for Production) — confirm the sending domain/address is verified in the Resend dashboard for
  Production use, not just for whatever was tested in Preview.
- **Staff order notification**: `OWNER_NOTIFICATION_EMAIL` is unset (section 3) — no alert email
  will fire on new orders until set. Not a launch blocker, but worth deciding before launch day
  rather than being surprised by silence.
- **Shipping**: Production ships every order free with no cap today (`FreeShippingProvider`) — this
  is the current, deliberate state, not a bug to fix as part of this launch. Real shipping
  activation is a separate, later decision (section 2).
- **Fulfillment / Drive handoff**: `N8N_ORDER_CONFIRMATION_WEBHOOK_URL` has no Production entry
  (section 3) — confirm with the n8n workflow owner whether paid Production orders are expected to
  reach Drive/Sheets automatically, or whether that handoff is manual until this is added.

---

## 7. Rollback procedures

- **Checkout/payment failure after a Production deploy**: use Vercel's "Instant Rollback" to the
  last known-good Production deployment (Vercel dashboard → Deployments → previous ready deployment
  → Promote to Production). This reverts code only — no env var or Supabase/storage change is
  required or should accompany an emergency code rollback.
- **Artwork/Storage access failure** (private bucket cutover causing broken images/signed-URL
  errors): flip the `design-uploads` bucket back to public in the Supabase dashboard (section 4's
  rollback) — faster and more targeted than a full code rollback, since the code itself handles
  both bucket states correctly.
- **Supabase env var misconfiguration** (e.g. Production pointed at the wrong project, or still
  missing `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`): fix the Vercel env var
  directly and redeploy (or trigger a redeploy without a new commit) — this fails closed with a
  named error rather than silently serving wrong data, so this failure mode should be loud and fast
  to diagnose from Vercel's runtime logs (`Error: X is not set`).
- **Square webhook signature/config failure**: the webhook route already refuses invalid or
  unconfigured requests rather than silently accepting bad events — fix the
  `SQUARE_WEBHOOK_SIGNATURE_KEY`/`SQUARE_WEBHOOK_NOTIFICATION_URL` values or the Square Dashboard
  subscription URL and no code change/rollback is needed.
- **Real-money test (section 5) reveals an incorrect charge amount**: do not proceed to announcing
  launch. Refund the test charge, roll back the triggering code change if one was just deployed,
  and re-run section 5 from the start once fixed.

---

## 8. Final GO / NO-GO checklist

### Technical blockers (code/config — this repo or Vercel/Supabase/Square settings)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for Production, pointed at
      the real Production Supabase project (section 3) — **confirmed missing today.**
- [ ] `NEXT_PUBLIC_SQUARE_ENVIRONMENT` confirmed (not just present) as `production` for real-money
      processing (section 3) — **value not verifiable from this document; needs direct check.**
- [ ] Square's Developer Dashboard webhook subscription URL confirmed to match
      `SQUARE_WEBHOOK_NOTIFICATION_URL`'s actual Production value (section 1).
- [ ] `design-uploads` bucket flipped to private for Production, with the section 4 smoke tests
      passed (section 4) — **not yet done for Production; staging rehearsal already complete.**
- [ ] Section 5's one real, refunded payment test passed end-to-end (webhook recorded, email sent,
      artwork retrievable) — **not yet performed.**
- [ ] `N8N_ORDER_CONFIRMATION_WEBHOOK_URL` decision made for Production (add it, or confirm it's
      intentionally not wired yet) (section 3/6).

### Business decisions (owner/accountant — not something code can resolve)
- [ ] GST/HST registration status confirmed with an accountant — gates real tax activation
      (section 1). **Still ZeroTaxProvider in Production by design until this is confirmed.**
- [ ] BC/SK/MB PST and Quebec QST registration confirmed separately, if/when applicable.
- [ ] At least one real, measured packaging profile entered (worksheet in
      `docs/packaging-measurement-worksheet.md`) — gates real shipping rates ever quoting anything
      but "Request a Shipping Quote" (section 1).
- [ ] Chit Chats shipping-origin address discrepancy resolved — decide which address is correct and
      update the other (section 1).
- [ ] Decision on whether to launch with free/uncapped Production shipping (current state) or wait
      for real shipping activation (section 2) — a deliberate choice, not a default to accept
      silently.
- [ ] `OWNER_NOTIFICATION_EMAIL` — decide whether to set it before launch for staff alerts.

**Launching today, as currently configured, means**: Production checkout/Studio/admin would fail
closed on the missing Supabase env vars (must fix first); once fixed, Production would launch with
$0 tax and free uncapped shipping for every order, both by deliberate, reviewed code gates rather
than accident — acceptable as a conscious interim launch posture, not acceptable if either gap is
undiscovered at go-live.
