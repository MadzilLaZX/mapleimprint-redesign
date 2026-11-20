-- Fixes a data-integrity bug surfaced by real Square sandbox testing of the new checkoutAttemptId
-- retry model (docs/payment-idempotency-design.md): mark_order_paid_and_sync_attempt() (007)
-- updated EVERY PaymentAttempt row for an order with status != 'PAID' ... err, != 'SUCCEEDED' to
-- SUCCEEDED, not just the one attempt that actually succeeded. Before this round, that was never
-- wrong -- every order only ever had exactly one PaymentAttempt, since a new idempotencyKey always
-- created a brand-new MapleOrder rather than reusing one. Now that a retry for the SAME
-- checkoutAttemptId can add a SECOND PaymentAttempt to an EXISTING order (see
-- supabase/migrations/011_checkout_attempt_id.sql), a declined-then-retried-successfully order
-- ends up with its real "declined" PaymentAttempt silently overwritten to SUCCEEDED (same
-- squarePaymentId as the real one, failureReason wiped) -- confirmed live against Square sandbox:
-- a genuine decline followed by a successful retry left BOTH PaymentAttempt rows reading
-- SUCCEEDED, destroying the audit trail of what actually happened.
--
-- Fix: only the currently in-flight attempt (status = 'CREATED') is eligible -- a FAILED row from
-- an earlier attempt for the same order is never touched again, regardless of what happens to a
-- later attempt. This is narrower than the old "!= 'SUCCEEDED'" (which also matched FAILED rows)
-- and behaves identically to before for every pre-existing single-attempt-per-order case, since
-- that one attempt is always still 'CREATED' at the moment this function runs.

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
    return query select false, null::text, null::text, null::text, null::integer, null::boolean;
    return;
  end if;

  -- Same transaction, same commit/rollback unit as the MapleOrder update above. Scoped to the
  -- in-flight attempt only (status = 'CREATED') -- NOT "!= 'SUCCEEDED'" -- so an earlier FAILED
  -- attempt for this same order (a genuine decline, now superseded by a successful retry) keeps
  -- its own real outcome on record instead of being silently relabeled SUCCEEDED.
  update "PaymentAttempt"
  set status = 'SUCCEEDED',
      "squarePaymentId" = p_square_payment_id,
      "rawResponse" = coalesce(p_raw_response, "rawResponse"),
      "failureReason" = null
  where "orderId" = p_order_id
    and status = 'CREATED';

  return query select true, v_reference, v_contact_name, v_contact_email, v_total_cents, (v_email_sent_at is not null);
end;
$$;
