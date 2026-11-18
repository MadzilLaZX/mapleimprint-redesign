-- NOT APPLIED as of this file being written (2026-11-19) -- written to support the durable
-- payment-attempt state model proposed in docs/payment-idempotency-design.md. Review that document
-- first; this column alone does nothing until /api/checkout/pay/route.ts is updated to use it,
-- which is explicitly NOT done this round (needs Square sandbox validation first).
--
-- Problem: MapleOrder.reference/id today are only found via PaymentAttempt.idempotencyKey, which
-- the client is FORCED to regenerate on every retry (Square's Web Payments SDK tokens are
-- single-use, so sourceId always differs on retry, and reusing an idempotencyKey with a changed
-- request body is itself rejected by Square). That means every retry after a failed/lost-response
-- attempt currently creates a BRAND NEW MapleOrder, even for what is, from the customer's
-- perspective, one checkout attempt -- and if a prior attempt actually succeeded but its response
-- was lost in transit, a retry has no way to discover that before charging again.
--
-- Fix: a second, STABLE identifier the client generates ONCE per checkout session (not
-- regenerated on retry, unlike the Square idempotencyKey) and sends on every /api/checkout/pay
-- call. The server looks up an existing MapleOrder by this id FIRST -- if one exists and is
-- already PAID, return success immediately without calling Square again; if one exists but isn't
-- paid yet, reuse the same order (and its squareOrderId, if already created) instead of making a
-- new one. Apply against the `maple-imprint-catalogue` Supabase project (ovqkwedpwmuusnijbxro)
-- via the SQL editor, same out-of-band process as every other migration here -- once the
-- corresponding route code is written AND validated against the Square sandbox.

alter table "MapleOrder"
  add column if not exists "checkoutAttemptId" text null;

-- Partial unique index (not a plain unique constraint) because this column is null for every
-- order created before this migration, and for any future order where the client-side change
-- hasn't rolled out yet -- a plain unique constraint would reject a second null, which is wrong
-- here; postgres unique constraints already treat NULL as distinct from other NULLs by default,
-- but being explicit with a partial index (where not null) documents the intent directly rather
-- than relying on that default behavior being understood.
create unique index if not exists "MapleOrder_checkoutAttemptId_key"
  on "MapleOrder" ("checkoutAttemptId")
  where "checkoutAttemptId" is not null;
