# Production deployment & rollback checklist

Covers the state of each subsystem as of `checkout-square-payments` branch tip at the time this
was written, for whoever performs the actual Production promotion (not done by Claude -- requires
your explicit approval per standing instructions throughout this engagement).

## Pre-deployment verification (do this before promoting, not after)

| System | What to check | How |
|---|---|---|
| Square | `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_*` set correctly for the environment you're promoting to (sandbox vs production keys are different -- confirm you're not accidentally deploying sandbox keys to Production or vice versa) | Vercel dashboard → Project → Settings → Environment Variables, scoped to Production |
| Square webhook | `SQUARE_WEBHOOK_SIGNATURE_KEY` + `SQUARE_WEBHOOK_NOTIFICATION_URL` match the webhook subscription configured in Square's own dashboard for the Production domain | Square Developer Dashboard → Webhooks |
| Square sandbox testing | **Not yet done** -- no Square credentials of any kind exist in this environment (confirmed via `.env.local`), so nothing could be exercised against the real Square sandbox API. See `docs/local-test-environment-setup.md` for exactly how to get sandbox credentials and what to verify once they exist. Server-side pricing recomputation is covered by 15 tests (`priceCartItem.test.ts`) using a fake DB client, independent of Square. | `docs/local-test-environment-setup.md` |
| Payment idempotency (lost-response double-charge risk) | **Designed and unit-tested this round (2026-11-19), NOT yet wired into the live `/api/checkout/pay` route.** Root cause: `SquarePaymentSection.tsx` must regenerate its idempotency key on every retry (Square source tokens are single-use), so a request that actually succeeds server-side/at Square but whose response is lost before reaching the browser has no idempotency protection against a double charge on retry -- the server has no way to connect the retry to the earlier, successful attempt. Proposed fix: a second, stable `checkoutAttemptId` (not regenerated on retry) the server checks FIRST, short-circuiting to success if that checkout attempt already resulted in a `PAID` order. Full design, the decision logic (`src/lib/checkout/checkoutAttemptState.ts`, 7 tests, all passing), and an exact integration checklist are in `docs/payment-idempotency-design.md`. The schema change it needs is written but not applied (`supabase/migrations/011_checkout_attempt_id.sql`). Deliberately not wired into the live route without Square sandbox access to validate it against real retry/lost-response scenarios first. | `docs/payment-idempotency-design.md` |
| Tax | **UPDATED (2026-11-16):** `taxProvider` now resolves dynamically via `resolveTaxProvider(process.env.VERCEL_ENV)` -- `"production"` always forces `$0` tax regardless of any other config (a safety gate, not a toggle), every other environment (including Preview) charges real Ontario HST. GST/HST registration has still not been confirmed with an accountant as of this writing -- the Production gate exists specifically so that doesn't matter yet. PST/QST stays off everywhere. | grep `src/lib/checkout/taxProvider.ts`'s last line |
| Shipping | `shippingProvider` export is still `FreeShippingProvider`. Canada Post (`canada-post-activation-plan.md`) is no longer the plan -- **Chit Chats is now the planned primary carrier** (owner decision, 2026-11-12); see `docs/chit-chats-production-readiness.md` for its current state, which is substantially further along than Canada Post ever was but still not activated. | grep the file |
| Emails | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set for Production (confirmed working in a prior session's HANDOFF notes); `OWNER_NOTIFICATION_EMAIL` is a deliberate, standing decision to leave unset -- confirm that's still your intent before launch, since staff currently get no email on new paid orders **or new leads/quotes**. See "Owner notification email" section below for the exact config and why it must be enabled before launch. | Vercel env vars |
| Database migrations | 001-009 all applied to the live `maple-imprint-catalogue` project (008 applied 2026-11-11 following approval, backfill run and verified same day -- see `canada-post-activation-plan.md`). **Migration 010** (`ChitChatsShippingQuote`, the shipping quote cache) is reviewed/improved but **not applied** -- see `docs/chit-chats-supabase-validation.md`'s deployment checklist before applying it; nothing in this codebase reads from it yet, so it's safe to leave unapplied indefinitely without blocking anything else in this table. | `supabase/migrations/` folder, compare against what's actually been run |
| Local DB integration testing | **Blocked (2026-11-18)**: `npx supabase start` fails -- no Docker Desktop or Podman installed in this environment (`"docker: command not found (podman also not found)"`). `src/lib/studio/dbIntegration.test.ts` (6 tests: Studio project creation, design JSON persistence, freeze idempotency, quote-with-design-file submission, reference isolation between two customers, admin file-inventory cross-customer isolation) is written and ready but has never actually run against a real database -- it only confirmed it loads/type-checks cleanly with its own tests skipped. Install Docker Desktop, then follow `docs/local-test-environment-setup.md` section 1. | `docs/local-test-environment-setup.md` |
| Storage bucket access (`design-uploads`) | **Code-level mitigation shipped (2026-11-19); the bucket itself has NOT been changed and still needs owner action.** migration 004's own comment states "the bucket is public," meaning any stored file is fetchable by anyone with its URL, indefinitely, with no authentication check at the storage layer — this is a standing, not-fully-resolved privacy gap, and some stored paths are more exposed in practice than others depending on where their identifiers also appear elsewhere in the app (full reasoning deliberately kept out of this public-facing file — ask directly if you want the specifics before the bucket is fixed). **What shipped this round**: `src/lib/server/signedStorageUrl.ts` + `fileInventory.ts` now serve every asset/production/preview URL (quote status page and both admin ZIP routes) as a fresh, short-lived signed URL instead of the permanent stored public URL, with a safe fallback to the old URL if signing fails. This is pure code — no bucket/policy change, and it doesn't change what's fetchable today, since the bucket is still public either way. **Required to actually close the gap**: in the Supabase dashboard, switch the `design-uploads` bucket from public to private, and separately confirm no storage policy permits listing its contents. The moment the bucket is private, every surface already serving signed URLs becomes genuinely access-controlled with zero further code change. Not done this round — this is a live Production policy change that needs your sign-off, and no credentials were available to inspect or change it regardless. | `src/lib/server/signedStorageUrl.ts`, Supabase Dashboard → Storage → `design-uploads` → Policies |
| Product images | S&S Activewear CDN access is still blocked (Cloudflare 403) as of this writing -- ~78% of the apparel catalogue will show "Image coming soon" on Shop/homepage the moment real traffic hits those pages. This is the single largest known customer-facing gap and is not resolved by anything in this deployment. **Investigated again (2026-11-18)** after a report that ATC-branded products on `/products/custom-apparel/t-shirts` still showed the placeholder despite being surfaced first by the reliability sort: confirmed ATC is a brand SanMar distributes (not S&S) -- every sampled ATC image URL is hosted on `media.sanmarcanada.com`, and the catalogue mapping/URL generation is correct. **RESOLVED the mystery, same day**: the user then captured real DevTools evidence that a `media.sanmarcanada.com` URL returns `200 OK` via direct browser navigation but `403 Forbidden` (served by CloudFront itself -- `X-Cache: Error from cloudfront`, not the S3 origin) when the identical URL loads as an embedded image on our actual deployed domain. A plain, unauthenticated, no-referrer `curl` to the same exact URL this round also returned `200` (`X-Cache: Hit from cloudfront`). That pattern -- works with no/foreign referrer, fails for a real embedding referrer -- is the standard signature of referer-based hotlink protection. **So SanMar is now believed to have the same class of problem as S&S** (CDN-level access block), just not yet proven to the same degree -- we deliberately did not test Referer header variations against SanMar's CDN ourselves to pin down the exact rule, since doing so would be probing their access control rather than diagnosing it; that's a question for SanMar directly (see `catalogue-engine/OUTREACH_DRAFTS.md` section 1a, added this round). **Practical consequence**: `media.sanmarcanada.com`'s "reliable" classification in `shopQuery.ts`'s featured-sort tiebreaker was based on a plain no-referrer request and should now be treated as unconfirmed for real embedded use -- the code was deliberately left unchanged (no second speculative sort fix), only the comments were corrected to say so honestly. `referrerPolicy="no-referrer"` on the `<img>` would plausibly work around this but has **not** been implemented, since supplier permission for embedding at all is unconfirmed. | Visual check on Preview + DevTools Network tab for one `media.sanmarcanada.com` request's status/headers, same as what surfaced this |
| `products.json` freshness | Static export predates the SanMar description fix -- see `regenerate-products-json.md`. Not blocking, but descriptions will look incomplete for SanMar products until regenerated. | Compare file mtime / git log against the backfill commit |
| Quote status page security | **FIXED (2026-11-18)**, found during an autonomous end-to-end QA pass: `generateQuoteReference.ts` was producing a sequential `MI-YYYYMMDD-####` counter, but `/quote/[reference]/status` reads a quote by that reference ALONE via the service-role client with no other access check -- the reference IS that page's access control, by its own existing file comment. A sequential counter made this trivially enumerable: anyone with one reference could walk a few hundred neighbouring digits for the same day and read other customers' names, contact info, and uploaded artwork. Replaced with a random base32 suffix (commit `de01f13`), matching `generateOrderReference.ts`'s already-correct order token. No evidence this was actually exploited was found or looked for -- this was a code-review finding, not an incident report. | `src/lib/checkout/generateQuoteReference.ts` + its test |

## Owner notification email (verified this round)

**Logic verified, now under regression test** (`src/lib/automation/email/templates.test.ts`, 5
tests, passing -- added this round, runs as part of `npm test`). Confirmed by reading the code
directly, not assumed:

- A single env var, `OWNER_NOTIFICATION_EMAIL`, gates **two independent notification paths**:
  1. `src/lib/automation/notify.ts` -- new quote/contact/appointment leads (`ownerNotificationEmail()`).
  2. `src/lib/checkout/fulfillOrder.ts` -- paid orders (`adminOrderPaidEmail()`), the specific
     gap Priority 4 asked about.
- Both paths check `if (!ownerEmail) return` / `if (ownerEmail) { ... }` -- **there is no
  code-level default or fallback address.** If the var is unset, that notification is silently
  skipped; nothing errors, nothing queues, nothing retries later. (`AUTOMATION.md` previously
  claimed a code-level fallback to `info@mapleimprint.ca` -- that was incorrect and has been
  corrected this round; `.env.example`'s `info@mapleimprint.ca` is a documentation placeholder,
  never read by the app.)
- Both call sites isolate the email send in its own try/catch (`fulfillOrder.ts`) or
  `Promise.allSettled` branch (`notify.ts`), so a bad address or Resend outage cannot break order
  confirmation or lead intake for the customer -- failure is logged server-side only.
- `adminOrderPaidEmail()` itself: subject includes the order reference and customer name; body
  lists every line item with quantity and colour; all customer-supplied fields (name, email,
  product/colour names) are HTML-escaped before interpolation -- verified directly by the new
  tests, including a deliberate `<script>`/`&`-injection case.

**Exact configuration required before launch:**
1. Vercel dashboard → the project → Settings → Environment Variables.
2. Add `OWNER_NOTIFICATION_EMAIL`, scoped to **Production** (and Preview too, if you want to see
   test notifications on Preview deployments -- optional, Production is the one that matters for
   launch).
3. Value: **the real inbox Maple staff wants new-order and new-lead alerts sent to.** This is not
   something to default or guess -- `info@mapleimprint.ca` appears in `.env.example`/`BUSINESS.email`
   as the business's general contact address, but confirming that's the correct address for *this*
   specific purpose (as opposed to a different staff/ops inbox) is your call, not an assumption
   this report will make for you.
4. No code change, redeploy, or migration is needed to pick it up -- `process.env` is read at
   request time, so setting it in Vercel takes effect on the next request once the env var change
   is saved (Vercel may prompt a redeploy depending on which environment you edit).

**Still your decision, not resolved by this verification:** whether to keep this unset (the
standing decision from a prior session) or provide a real address now. The logic is launch-ready
either way; what's missing is purely the business decision + the address itself.

## Deployment order (safest sequence)

1. **Confirm Preview is green** on the exact commit you intend to promote (already true for
   `2a7bbef` and later as of the last verification pass -- re-verify if new commits have landed
   since).
2. **Apply any approved, not-yet-applied database migrations first**, before promoting the app
   code that might expect them -- in this branch's case, that's only migration 008 if/when you
   approve it; everything else the app currently uses (007, 009) is already live.
3. **Promote the Vercel deployment** to Production (Vercel dashboard → Deployments → the verified
   Preview build → Promote to Production). This is the step requiring your explicit action --
   Claude does not have authorization to do this and has not attempted to.
4. **Smoke-test Production immediately after promotion**: homepage, one product page, checkout
   quote flow (don't submit a real payment as part of this check), admin login. Same scope as the
   Preview verification already performed, just confirming the promotion itself didn't introduce
   an environment-specific issue (wrong env vars, etc.).
5. **Watch Square's webhook delivery log** for the first real order or two, to confirm signature
   verification is working against the Production webhook URL specifically (Preview and
   Production may have different `SQUARE_WEBHOOK_NOTIFICATION_URL` values).

## Rollback procedure

**Application code:** Vercel keeps every previous Production deployment available -- the fastest
rollback is Vercel dashboard → Deployments → find the last-known-good Production deployment →
"Promote to Production" on that one. This does not require a git revert and takes effect in
seconds. A git-level revert (`git revert`, new commit, redeploy) is the slower, more traditional
fallback if the Vercel-level rollback isn't available for some reason.

**Database migrations:** every migration applied this session is independently reversible:
- Migration 007 (`mark_order_paid_and_sync_attempt` function) and 009 (its permission grants): a
  function can be dropped (`drop function mark_order_paid_and_sync_attempt(uuid, text, text,
  jsonb);`) without affecting any table or data -- but note the application code
  (`fulfillOrder.ts`) depends on this function existing; don't drop it without also rolling back
  to a commit that uses the old two-call approach, or payment confirmation will break.
- Migration 008 (if applied): purely additive nullable columns on `SupplierProduct`. Reversible
  via `alter table "SupplierProduct" drop column "unitWeightLb", drop column "caseWeightLb", ...`
  (full list in the migration file itself) with zero effect on any other column or table.

**No migration this session alters or drops existing data** -- every rollback above is a clean
removal of something additive, never a restore-from-backup scenario.

## What this deployment does NOT change (confirm these stay true through the promotion)

- No real payment was ever processed by Claude during any verification pass.
- No product availability was changed (the 13 orphaned products remain published -- see
  `orphaned-products-before-after.md` -- pending your separate approval).
- No pricing rule was altered.
- No live migration was applied without being explicitly called out as applied vs. prepared above.
