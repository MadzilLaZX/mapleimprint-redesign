# Vercel Preview deployment setup

Written in an earlier round because no dedicated Preview setup doc existed yet (only
`production-deployment-checklist.md`, which assumes a project already exists and covers
Production promotion, not initial Preview setup). Re-reviewed this round (`next.config.ts` and
the env var inventory re-checked against the current codebase) -- no changes needed, the
guidance below still holds. Nothing in this document was executed -- creating a Vercel project,
connecting this repo, or setting any environment variable all require your explicit action (see
"Important: a Vercel project almost certainly already exists" below). See
`docs/owner-handoff-checklist.md` for the short action-list version of this and every other
remaining step.

## Important: a Vercel project almost certainly already exists

Earlier rounds of this engagement reported "no Vercel project found" based on Claude's own
Vercel API access (via the connected MCP integration). That conclusion was **incomplete, not
wrong about the API call, but wrong about what it implies**: `next.config.ts`'s own header
comment (commit `aa2e872`, 2026-11-10) references a real, live Production deployment at
`mapleimprint.ca` that returned actual Vercel error codes (`402
OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`) under real traffic, and `docs/launch-readiness-report.md`
(an earlier round) already lists **"Vercel API access for Claude — dashboard-level reconnection —
currently works via manual dashboard actions only"** as a known, standing blocker — i.e., a
project exists, Claude's current API connection simply isn't authorized against the Vercel
account/team that owns it.

**Before treating this as "set up a new project from scratch," confirm with the account owner
whether `mapleimprint.ca`'s existing Vercel project should be reconnected to this branch instead
of creating a second, separate one.** Creating a duplicate project when one already exists would
be a real, confusing mistake, not a safe default.

## Minimum environment variables for a working Preview

Verified directly this round: **`npm run build` succeeds with every one of the variables below
completely unset** (confirmed by running a full local build against an `.env.local` containing
only `CHIT_CHATS_*` values — every other key absent). Nothing here is required for the site to
build or for static pages to render. What each one gates is listed so you can decide which to set
for a *meaningful* Preview test (one where checkout/admin/email actually work), as opposed to a
Preview that merely builds.

| Variable | Required for Preview to build? | Required for what to actually work |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | No | Any checkout API call (`/api/checkout/quote`, `/api/checkout/pay`) — without it, those routes 500 cleanly (caught by Next.js's own route-handler error boundary, not a crash) the moment they're hit, but the rest of the site is unaffected. |
| `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID`, `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | No | The Square card form on `/checkout` — without `NEXT_PUBLIC_SQUARE_APPLICATION_ID`/`_LOCATION_ID`, the client-side SDK fails to initialize (see `SquarePaymentSection.tsx`); without `SQUARE_ACCESS_TOKEN`, the actual payment call 500s server-side. Use **sandbox** keys for Preview — never Production keys on a non-Production deployment. |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | No | `/admin` login. Fixed this round: previously, leaving `ADMIN_SESSION_SECRET` unset while *any* cookie happened to match the session-cookie shape would throw uncaught inside `proxy.ts`'s middleware, 500ing the entire `/admin` section instead of redirecting to login (see `src/lib/admin/session.ts` — now fails closed, returns "invalid" on any error). Still recommended to set both for Preview so staff can actually test the admin section. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | No | Confirmation/notification emails — `getResend()` returns `null` when unset and every call site treats that as "skip the email," never an error (see `src/lib/automation/email/resend.ts`). |
| `OWNER_NOTIFICATION_EMAIL` | No | New-lead and new-order staff alerts — both call sites no-op when unset (see `production-deployment-checklist.md`'s existing note). Standing decision from a prior round: fine to leave unset. |
| `CHIT_CHATS_*` | No | Not read by the live `shippingProvider` export at all (`FreeShippingProvider`, Chit Chats code is built but not activated) — only relevant to the manual scripts and the inactive `ChitChatsShippingProvider`. Not needed for a Preview test of the current live checkout flow. |
| `GOOGLE_*`, `TELEGRAM_*`, `PHOTOROOM_API_KEY`, `N8N_ORDER_CONFIRMATION_WEBHOOK_URL` | No | Each independently gated and already documented in `.env.example`/`AUTOMATION.md` as optional with a graceful "not available" fallback. |

**Practical recommendation for a meaningful Preview test** (not just "does it build"): set
`SUPABASE_SERVICE_ROLE_KEY`, the four Square sandbox variables, and `ADMIN_PASSWORD`/
`ADMIN_SESSION_SECRET`. Everything else can stay unset without breaking anything, including a
real checkout-and-payment test (using Square's own sandbox test card numbers, never a real card).

## Preview vs. Production separation

- **Scope environment variables per-environment in the Vercel dashboard** (Project → Settings →
  Environment Variables → each variable's own Environment checkboxes) — e.g., `SQUARE_ACCESS_TOKEN`
  should be a **sandbox** token for Preview and a **separate Production** token for Production;
  never the same value in both. `taxProvider.ts`'s own `resolveTaxProvider()` already does this
  automatically for tax (reads `VERCEL_ENV`, forces `$0` tax on `"production"` regardless of any
  other config) — Square credentials need the equivalent discipline applied manually via Vercel's
  per-environment variable scoping, since there's no code-level gate for which Square key is
  "allowed" in which environment.
- **`NEXT_PUBLIC_*` variables are not secrets and are intentionally client-visible** — confirmed
  this round: only three exist in the whole codebase (`NEXT_PUBLIC_SQUARE_ENVIRONMENT`,
  `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID`), all meant to be read by
  Square's own client-side SDK per Square's documented pattern. Every other variable in
  `.env.example` has no `NEXT_PUBLIC_` prefix and is read only from server-side code (`src/lib/server/`,
  API routes, or server components) — grepped this round to confirm no server-secret-holding
  module (`supabaseAdmin.ts`, `squareClient.ts`) is ever imported from a client component.
- **`VERCEL_ENV`** (Vercel's own automatic system variable — never set it yourself) is what
  distinguishes Preview from Production at the code level today, specifically for tax
  (`resolveTaxProvider`). Shipping (`FreeShippingProvider`) and Chit Chats are not currently
  environment-aware because neither is activated in either environment yet.

## Procedure: connecting this branch to a Vercel Preview (once you decide which project)

1. Confirm with the account owner whether to reconnect the existing `mapleimprint.ca` project or
   create a new one (see the warning above) — **this is the one step that needs a decision before
   anything else**.
2. Vercel dashboard → the chosen project → Settings → Git → confirm the connected repository is
   `MadzilLaZX/mapleimprint-redesign` and that `checkout-square-payments` (or whichever branch you
   want previewed) will get automatic Preview deployments on push.
3. Settings → Environment Variables → add the variables from the table above, scoped to
   **Preview** only (not Production) — see "Preview vs. Production separation" above for exactly
   which values are safe to reuse vs. must differ from Production's.
4. Push a commit (or open a PR) on the target branch — Vercel builds and deploys a Preview URL
   automatically; no manual trigger needed once steps 1-3 are done.
5. Smoke-test the Preview URL: homepage, a product page, `/checkout` (sandbox card, never real),
   `/admin/login`. Same scope `production-deployment-checklist.md` already describes for
   Production, just against the Preview URL first.

## What this round verified without needing Vercel API access

- A full local production build (`npm run build`) succeeds with none of the above variables set —
  2040+ static pages generated, zero errors.
- No server secret is reachable from any client component (grepped for `supabaseAdmin`/
  `squareClient` imports under `src/components/`).
- Fixed a real bug where a missing `ADMIN_SESSION_SECRET` could 500 the entire `/admin` section
  instead of failing closed to "please log in" — see `src/lib/admin/session.ts`.
