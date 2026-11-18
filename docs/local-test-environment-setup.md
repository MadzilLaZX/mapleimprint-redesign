# Local database + Square sandbox test environment setup

Written because this round needed to test against a real (not mocked) Supabase database and the
Square sandbox, and neither was available in this environment. Nothing in this file was executed
against live infrastructure — follow it to actually run the integration tests this round added.

## 0. Does Vercel Preview share Production Supabase? Yes — by source code, not configuration

Confirmed by reading `src/lib/studio/supabaseClient.ts` and `src/lib/server/supabaseAdmin.ts`: the
Supabase project connection is a fixed source constant in both files, not an environment variable,
and there is no staging-equivalent constant anywhere in this codebase. Practically: local dev,
every Vercel Preview deployment, and Production all run the same code path and therefore reach the
same Supabase project — there is no environment-based data isolation today. This is a deliberate,
pre-existing tradeoff (documented in `supabaseClient.ts`'s own comment) made before Preview/
Production separation was a concern for private-storage work specifically. Worth an explicit owner
decision about introducing a real staging project and making that connection env-configurable, now
that private-storage correctness depends on knowing which project is actually live — not acted on
here since it's a deployment-architecture change, not a readiness-review fix.

## 1. Local, isolated Supabase (for `src/lib/studio/dbIntegration.test.ts` and
   `src/lib/server/privateStorageIntegration.test.ts`)

**Blocker confirmed this round (and the round before):** `npx supabase start` failed with
`"docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure
it is on PATH"`. Neither Docker nor Podman nor an existing `supabase/config.toml` were present. The
Supabase CLI itself (`npx -y supabase --version` → 3.2.0) downloads fine — only the container
runtime is missing. Re-confirmed this round; nothing has changed about this blocker.

**Second blocker, newly confirmed this round — Docker alone is NOT sufficient:**

- The Studio-related base tables have no `CREATE TABLE` anywhere in this repository —
  `supabase/migrations/001_design_freeze.sql`'s own header comment says they were created directly
  against the live project, outside any migration tooling this repo runs automatically. Every
  numbered migration under `supabase/migrations/` is an `ALTER TABLE` against tables assumed to
  already exist, so a bare local instance would fail on the very first migration.
- The design-uploads storage bucket and its access policy are, likewise, dashboard-only — not
  captured as SQL anywhere in this repo.
- Neither gap is new this round; both are now explicitly documented because
  `privateStorageIntegration.test.ts` (below) is the first test that would actually need all of
  this to exist locally to run meaningfully.

**Steps once Docker Desktop (or Podman) is installed — updated to account for the missing base schema:**

1. `npx supabase init` — one-time, creates `supabase/config.toml`.
2. `npx supabase link` (needs a database password from Project Settings > Database), then
   **`npx supabase db pull`** — the standard Supabase-CLI way to capture a schema that was never
   checked in. This produces a new migration file with the real table definitions pulled from the
   live project. **Review the pulled file before trusting it** — this is a read-only pull, not a
   write, but double-check it didn't pull anything unexpected.
3. `npx supabase start`, then `npx supabase db reset` to apply the pulled schema plus every file
   already in `supabase/migrations/` against the fresh local instance.
4. In the local Supabase Studio (`http://127.0.0.1:54323`), manually recreate the storage bucket
   and its access policy to match the live project — copy the policy directly from the production
   dashboard (Authentication → Policies, scoped to `storage.objects`) rather than guessing its
   shape; the exact rule isn't reproduced here.
5. Run the DB-only tests:
   ```
   LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
   LOCAL_SUPABASE_SERVICE_ROLE_KEY=<service_role key supabase start printed> \
   RUN_LOCAL_DB_INTEGRATION_TESTS=1 \
   node --import ./scripts/register-test-alias-loader.mjs --test src/lib/studio/dbIntegration.test.ts
   ```
6. Run the new real-Storage tests (needs step 4 done first):
   ```
   LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
   LOCAL_SUPABASE_SERVICE_ROLE_KEY=<service_role key supabase start printed> \
   RUN_LOCAL_STORAGE_INTEGRATION_TESTS=1 \
   node --import ./scripts/register-test-alias-loader.mjs --test src/lib/server/privateStorageIntegration.test.ts
   ```
   This file uses the real `@supabase/supabase-js` Storage API (not a fake client) to verify: a
   real upload is fetchable via a real signed URL; a short-TTL signed URL actually expires; the
   real (previously-inferred, now observable) behavior of signing a path that was never uploaded;
   a real signed→normalized→re-signed round trip; fail-secure behavior against a since-deleted
   object; and a full real Studio-reload → freeze → artwork-export → quote-attachment-viewing
   chain, confirming the exported production PNG is itself a real, non-empty, independently
   fetchable file.

**Safety note:** both test files hard-refuse to run if `LOCAL_SUPABASE_URL` matches the real
project's URL (`ovqkwedpwmuusnijbxro`) — neither can be pointed at production even by mistake. This
is intentionally different from this repo's other `*.integration.test.ts` files
(`fulfillOrder.integration.test.ts`, `chitChatsQuoteStore.integration.test.ts`), which run against
the real shared project with service-role credentials under an explicit opt-in — those are
pre-existing, were not changed this round, and should not be run without understanding that they
write to the same database as real customer data (synthetic, clearly-marked, self-cleaning rows,
but real writes to the real project regardless).

**Not yet attempted even once Docker + the schema pull exist:** this round did not install Docker
or run `supabase db pull` (per the standing "don't change Production settings" constraint — `db
pull` itself is read-only, but setting up the full local chain was judged out of scope for a review
pass and left for the owner to execute deliberately). `privateStorageIntegration.test.ts` is
therefore prepared and verified to skip cleanly without credentials (6/6 tests report `SKIP`, 0
failures), but **no claim is made that it has actually passed against real infrastructure** — that
remains the owner's to run and confirm.

Covers: Studio project creation/saving, editable design JSON round-tripping, design freeze
(idempotent re-freeze), a quote submission carrying its real frozen design snapshot, quote
reference isolation between two synthetic customers, and admin `buildFileInventory` never leaking
one customer's files into another's inventory.

## 2. Square sandbox

**Not configured in this environment** — `.env.local` has no `SQUARE_*`/`NEXT_PUBLIC_SQUARE_*`
keys at all (confirmed this round; same state as the prior round's audit).

**Steps to obtain sandbox credentials:**

1. Log into the [Square Developer Dashboard](https://developer.squareup.com/apps) with the
   account that owns (or will own) Maple Imprint's Square account.
2. Open the application (or create one) → **Sandbox** tab (not Production).
3. Copy: **Sandbox Access Token**, **Sandbox Application ID**, and a **Sandbox Location ID** (from
   **Locations**, or create a sandbox test location).
4. Set in `.env.local` (never commit these):
   ```
   NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox
   NEXT_PUBLIC_SQUARE_APPLICATION_ID=<sandbox application id>
   NEXT_PUBLIC_SQUARE_LOCATION_ID=<sandbox location id>
   SQUARE_ACCESS_TOKEN=<sandbox access token>
   ```
5. For webhook testing, also set `SQUARE_WEBHOOK_SIGNATURE_KEY` (from the dashboard's Webhooks
   section) and `SQUARE_WEBHOOK_NOTIFICATION_URL` (must match exactly what's configured there).
6. Use Square's documented [sandbox test card numbers](https://developer.squareup.com/docs/testing/sandbox)
   to exercise success/decline paths — never a real card.

**What to verify once sandbox credentials exist** (not done this round):

- A full `/checkout` run with a sandbox test card actually reaches `payment.status === "COMPLETED"`
  and `markOrderPaidAndNotify` transitions the real (local, not production) `MapleOrder` row to
  `PAID`.
- A sandbox decline test card produces the expected `402` + human-readable `humanPaymentError`
  message, and `PaymentAttempt.status` becomes `FAILED` without ever marking the order `PAID`.
- Submitting the exact same `idempotencyKey` + request body twice reuses the existing order rather
  than double-charging (this is what `fulfillOrder.integration.test.ts`'s existing "duplicate
  webhook" and "concurrent callbacks" scenarios already cover at the database-function level —
  only the live Square call + webhook delivery itself remains unverified without sandbox access).
- The real Square webhook delivery (not just a crafted test payload) reaches
  `/api/webhooks/square` and its signature verifies via Square's own `WebhooksHelper`.

## 3. What this round verified without either of the above

- `src/lib/checkout/priceCartItem.test.ts` (15 new tests) — the server-side pricing
  recomputation both `/api/checkout/quote` and `/api/checkout/pay` call before ever trusting an
  amount, using a fake Supabase client (same pattern as `freeze.test.ts`) for the one DB call it
  makes. Covers: a stale `designFrozenRevision` being rejected (a customer can't check out at a
  price that no longer matches a since-edited design), drinkware never being price-able at
  checkout (routes to quote by design), multi-location printing cost scaling correctly, and a
  real catalogue BLANK product resolving to a real positive price.
- A real finding, documented but not blindly fixed without Square sandbox to verify a fix against:
  `SquarePaymentSection.tsx` generates a fresh idempotency key on every failed/network-error retry
  (necessary — Square's Web Payments SDK tokens are single-use, so the retried request's `sourceId`
  always differs, and reusing an idempotency key with a changed request body is itself rejected by
  Square). This means a narrow failure window — the payment request succeeds server-side and at
  Square, but the response is lost before reaching the browser — has no idempotency protection at
  the payment layer against a double charge on retry. Worth a deliberate decision once sandbox
  access exists to actually test a fix, not a speculative code change now.
