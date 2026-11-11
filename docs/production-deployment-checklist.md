# Production deployment & rollback checklist

Covers the state of each subsystem as of `checkout-square-payments` branch tip at the time this
was written, for whoever performs the actual Production promotion (not done by Claude -- requires
your explicit approval per standing instructions throughout this engagement).

## Pre-deployment verification (do this before promoting, not after)

| System | What to check | How |
|---|---|---|
| Square | `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_*` set correctly for the environment you're promoting to (sandbox vs production keys are different -- confirm you're not accidentally deploying sandbox keys to Production or vice versa) | Vercel dashboard → Project → Settings → Environment Variables, scoped to Production |
| Square webhook | `SQUARE_WEBHOOK_SIGNATURE_KEY` + `SQUARE_WEBHOOK_NOTIFICATION_URL` match the webhook subscription configured in Square's own dashboard for the Production domain | Square Developer Dashboard → Webhooks |
| Tax | `taxProvider` export is still `ZeroTaxProvider` (confirm by reading `src/lib/checkout/taxProvider.ts`'s last line) unless GST/HST registration has been confirmed with an accountant -- this has not happened as of this writing | grep the file, or check this doc's own history |
| Shipping | `shippingProvider` export is still `FreeShippingProvider` -- confirmed as of this session; Canada Post is not ready (see `canada-post-activation-plan.md`) | grep the file |
| Emails | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set for Production (confirmed working in a prior session's HANDOFF notes); `OWNER_NOTIFICATION_EMAIL` is a deliberate, standing decision to leave unset -- confirm that's still your intent before launch, since staff currently get no email on new paid orders **or new leads/quotes**. See "Owner notification email" section below for the exact config and why it must be enabled before launch. | Vercel env vars |
| Database migrations | 001-007 and 009 already applied to the live `maple-imprint-catalogue` project. **008 is prepared, validated, not applied** -- confirm you want it applied (or explicitly deferred) before or shortly after promoting; it's independent of the app code deploying correctly either way | `supabase/migrations/` folder, compare against what's actually been run |
| Product images | S&S Activewear CDN access is still blocked (Cloudflare 403) as of this writing -- ~78% of the apparel catalogue will show "Image coming soon" on Shop/homepage the moment real traffic hits those pages. This is the single largest known customer-facing gap and is not resolved by anything in this deployment. | Visual check on Preview, same as every prior verification pass |
| `products.json` freshness | Static export predates the SanMar description fix -- see `regenerate-products-json.md`. Not blocking, but descriptions will look incomplete for SanMar products until regenerated. | Compare file mtime / git log against the backfill commit |

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
