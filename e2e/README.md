# Playwright end-to-end tests

Real-browser tests against the **local dev server only** (`http://localhost:3000`) — never a
Vercel Preview or Production URL. Run with `npm run test:e2e` (Chromium only; Firefox/WebKit
binaries were never installed — add them with `npx playwright install firefox webkit` plus a
`projects` entry in `playwright.config.ts` if ever needed).

## Why routes are mocked, and which ones

This environment's `.env.local` has no `SUPABASE_SERVICE_ROLE_KEY` / Studio Supabase keys
configured at all, and regardless of that, writing to live Supabase, sending real email, or
submitting a real customer quote/payment is explicitly out of scope for these tests. Every route
that would write to Supabase is intercepted **at the browser network layer** via Playwright's
`page.route()` (`studioMocks.ts`, `quoteMocks.ts`) — the request never reaches the Next.js dev
server, so the real route handler never runs for these specific calls. Everything else (the real
React/Konva/Three.js client code, real `<Link>` navigation, real cart `localStorage`, real
QuoteWizard validation) runs for real, unmocked, in an actual Chromium browser.

Mocked: `POST /api/studio`, `GET/PATCH /api/studio/[id]`, `POST /api/studio/[id]/freeze`,
`POST /api/studio/[id]/locations`, `POST /api/studio/upload`, `POST /api/quote`.

Not mocked (real, unmocked network requests to the local dev server): every page navigation,
`/api/studio/upload`'s actual request/response contract shape (only its Supabase-writing side is
replaced), cart (`localStorage`, no network at all).

## Quote status security model

See `quoteStatusSecurity.spec.ts`'s file header comment for the full writeup. Short version: the
quote reference is a bearer token (sole access control, no secondary session/email check) —
that's only safe because it's unguessable, which `generateQuoteReference.ts` was fixed to ensure
in the previous round (commit `de01f13`). Fully proving "a valid reference never leaks a
*different* customer's row" would need two real rows in a real/test Supabase instance, which this
environment doesn't have — that's a documented gap, not a claim that it was proven end-to-end.

## Screenshots

Saved to `e2e/screenshots/` (gitignored — run artifacts, not source) and attached to the HTML
report (`npx playwright show-report` after a run).
