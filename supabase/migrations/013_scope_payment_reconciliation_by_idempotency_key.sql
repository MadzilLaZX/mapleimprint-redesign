-- Closes a residual race window found by firing two genuinely concurrent sandbox payment
-- requests at the same order (not sequential retries -- those were already safe after 012):
-- both requests insert their own PaymentAttempt row (status 'CREATED') before either calls
-- Square. If request A's payment completes and its mark_order_paid_and_sync_attempt() call runs
-- WHILE request B's own PaymentAttempt row is still 'CREATED' (B hasn't reached its own Square
-- call yet, or Square hasn't responded), 012's "status = 'CREATED'" match catches BOTH rows --
-- A's own row (correct) AND B's still-pending row (wrong), stamping B's row with A's
-- squarePaymentId and SUCCEEDED status moments before B's own request discovers its real
-- outcome (Square itself rejects B with "The order is already paid" -- confirmed live) and
-- overwrites status back to FAILED, but never resets squarePaymentId -- leaving a FAILED record
-- with a misleading squarePaymentId belonging to a different attempt entirely.
--
-- Fix: an optional p_idempotency_key parameter. When provided (the synchronous /pay path always
-- knows its own key), the update matches that EXACT attempt only -- zero ambiguity regardless of
-- how many other attempts for the same order are mid-flight. When omitted (the webhook path has
-- no idempotencyKey of its own to offer), falls back to 012's "status = 'CREATED'" behavior,
-- unchanged.
--
-- IMPORTANT, learned applying this live: `create or replace function` with the SAME name but an
-- ADDED trailing parameter (even with a default) does NOT replace the existing function -- it
-- creates a SEPARATE OVERLOAD, and Postgres grants EXECUTE to PUBLIC by default on any newly
-- created function regardless of what the old one had. Confirmed this live: applying this as a
-- plain `create or replace function` momentarily left the new 5-parameter overload callable by
-- `anon`/`authenticated` -- exactly the hole 009 closed for the 4-parameter version. This file
-- instead explicitly drops the old signature first and grants the new one correctly, so it's
-- safe to replay from scratch on a fresh database without ever passing through that gap.

drop function if exists mark_order_paid_and_sync_attempt(uuid, text, text, jsonb);

create function mark_order_paid_and_sync_attempt(
  p_order_id uuid,
  p_square_order_id text,
  p_square_payment_id text,
  p_raw_response jsonb default null,
  p_idempotency_key text default null
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

  if p_idempotency_key is not null then
    update "PaymentAttempt"
    set status = 'SUCCEEDED',
        "squarePaymentId" = p_square_payment_id,
        "rawResponse" = coalesce(p_raw_response, "rawResponse"),
        "failureReason" = null
    where "orderId" = p_order_id
      and "idempotencyKey" = p_idempotency_key;
  else
    update "PaymentAttempt"
    set status = 'SUCCEEDED',
        "squarePaymentId" = p_square_payment_id,
        "rawResponse" = coalesce(p_raw_response, "rawResponse"),
        "failureReason" = null
    where "orderId" = p_order_id
      and status = 'CREATED';
  end if;

  return query select true, v_reference, v_contact_name, v_contact_email, v_total_cents, (v_email_sent_at is not null);
end;
$$;

-- New functions default to EXECUTE granted to PUBLIC -- revoke that explicitly rather than
-- trusting it was never granted, same posture as 009's original fix for this same function.
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from public;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from anon;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from authenticated;
grant execute on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) to service_role;
