-- Atomically transitions a MapleOrder to PAID and syncs its PaymentAttempt in a single Postgres
-- transaction (the function body's implicit BEGIN/COMMIT), replacing two separate, non-atomic
-- Supabase REST calls the application previously made. A real order (MO-KZULY7SS) was found live
-- with MapleOrder correctly PAID but its PaymentAttempt still FAILED, because those two writes
-- could partially complete. This closes that gap structurally: Postgres's row lock on the first
-- UPDATE's WHERE clause (status != 'PAID') serializes concurrent callers, so only one call ever
-- wins the transition, and both tables commit together or not at all.
--
-- Verified live against synthetic rows (created and deleted within this same session, 2026-11-10):
--   - decline followed by a successful retry -- both tables end up consistent, stale
--     failureReason cleared
--   - duplicate call against an already-PAID order -- safe no-op, no second write
--   - two genuinely concurrent calls for the same order -- exactly one ever wins
--   - a nonexistent order id -- returns newly_paid=false rather than erroring
--
-- Called from src/lib/checkout/fulfillOrder.ts's markOrderPaidAndNotify(), which is itself called
-- from both /api/checkout/pay (the synchronous success path) and /api/webhooks/square (the
-- reconciliation path) -- replacing the two separate .update() calls that used to live there.
--
-- APPLIED against the `maple-imprint-catalogue` Supabase project (ovqkwedpwmuusnijbxro),
-- 2026-11-10, same out-of-band process as 001-006. Purely additive: no existing table/column
-- changes, no data touched except by the function's own callers going forward.

create or replace function mark_order_paid_and_sync_attempt(
  p_order_id uuid,
  p_square_order_id text,
  p_square_payment_id text,
  p_raw_response jsonb default null
)
returns table (
  newly_paid boolean,
  order_reference text,
  contact_name text,
  contact_email text,
  total_cents integer,
  already_emailed boolean
)
language plpgsql
as $$
declare
  v_reference text;
  v_contact_name text;
  v_contact_email text;
  v_total_cents integer;
  v_email_sent_at timestamptz;
begin
  update "MapleOrder"
  set status = 'PAID',
      "squareOrderId" = p_square_order_id,
      "squarePaymentId" = p_square_payment_id,
      "updatedAt" = now()
  where id = p_order_id
    and status != 'PAID'
  returning "reference", "contactName", "contactEmail", "totalCents", "emailSentAt"
    into v_reference, v_contact_name, v_contact_email, v_total_cents, v_email_sent_at;

  if not found then
    -- Either the order doesn't exist, or another call already won this exact transition --
    -- nothing further to do, and nothing to roll back since nothing was changed.
    return query select false, null::text, null::text, null::text, null::integer, null::boolean;
    return;
  end if;

  -- Same transaction, same commit/rollback unit as the MapleOrder update above -- this is what
  -- makes the two tables unable to end up with contradictory terminal statuses.
  update "PaymentAttempt"
  set status = 'SUCCEEDED',
      "squarePaymentId" = p_square_payment_id,
      "rawResponse" = coalesce(p_raw_response, "rawResponse"),
      "failureReason" = null
  where "orderId" = p_order_id
    and status != 'SUCCEEDED';

  return query select true, v_reference, v_contact_name, v_contact_email, v_total_cents, (v_email_sent_at is not null);
end;
$$;
