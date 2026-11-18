# Local database + Square sandbox test environment setup

Written because this round needed to test against a real (not mocked) Supabase database and the
Square sandbox, and neither was available in this environment. Nothing in this file was executed
against live infrastructure — follow it to actually run the integration tests this round added.

## 1. Local, isolated Supabase (for `src/lib/studio/dbIntegration.test.ts`)

**Blocker confirmed this round:** `npx supabase start` failed with `"docker: command not found
(podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"`. Neither
Docker nor Podman nor an existing `supabase/config.toml` were present. The Supabase CLI itself
(`npx -y supabase --version` → 3.2.0) downloads fine — only the container runtime is missing.

**Steps once Docker Desktop (or Podman) is installed:**

1. `npx supabase init` — one-time, creates `supabase/config.toml`. The existing
   `supabase/migrations/` folder is picked up automatically; nothing needs copying.
2. `npx supabase start` — spins up real, local-only Postgres/Auth/Storage/Realtime containers.
   Prints a local API URL (`http://127.0.0.1:54321`), an `anon` key, and a `service_role` key —
   all local-only, unrelated to the real project's credentials.
3. Migrations apply automatically against a fresh local instance. If you need to re-apply after
   editing a migration: `npx supabase db reset`.
4. Run the new tests:
   ```
   LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
   LOCAL_SUPABASE_SERVICE_ROLE_KEY=<service_role key supabase start printed> \
   RUN_LOCAL_DB_INTEGRATION_TESTS=1 \
   node --import ./scripts/register-test-alias-loader.mjs --test src/lib/studio/dbIntegration.test.ts
   ```

**Safety note:** this test file hard-refuses to run if `LOCAL_SUPABASE_URL` matches the real
project's URL (`ovqkwedpwmuusnijbxro`) — it cannot be pointed at production even by mistake. This
is intentionally different from this repo's other `*.integration.test.ts` files
(`fulfillOrder.integration.test.ts`, `chitChatsQuoteStore.integration.test.ts`), which run against
the real shared project with service-role credentials under an explicit opt-in — those are
pre-existing, were not changed this round, and should not be run without understanding that they
write to the same database as real customer data (synthetic, clearly-marked, self-cleaning rows,
but real writes to the real project regardless).

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
