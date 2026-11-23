-- Adds a post-payment fulfillment lifecycle for MapleOrder: AWAITING_PRODUCTION -> IN_PRODUCTION
-- -> (READY_FOR_PICKUP | SHIPPED) -> COMPLETED, branching on the order's own fulfillmentMethod.
--
-- Deliberately a SEPARATE column from MapleOrder.status (the payment state, untouched by this
-- file) rather than new values added to that same column. Reason: mark_order_paid_and_sync_attempt
-- (007/009/012/013) transitions an order to PAID via `where status != 'PAID'` -- if fulfillment
-- states lived in that same column, a duplicate/racing Square webhook delivery for an order that
-- had already progressed to, say, IN_PRODUCTION would see status != 'PAID' and INCORRECTLY revert
-- it back to 'PAID', discarding real fulfillment progress. Keeping fulfillment in its own column
-- makes that impossible by construction: payment reconciliation never reads or writes it except to
-- initialize it once, and nothing in this file ever touches MapleOrder.status.
--
-- NOT APPLIED to any live database by this commit -- prepared for review/approval only, same
-- convention as every other migration file in this directory (010, etc.). Intended target for
-- approval is the staging project (`mapleimprint-staging`) only; Production (`maple-imprint-
-- catalogue`, ovqkwedpwmuusnijbxro) access is explicitly paused this round and must not be touched.

alter table "MapleOrder"
  add column if not exists "fulfillmentStatus" text null
    check ("fulfillmentStatus" in ('AWAITING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED')),
  add column if not exists "fulfillmentStatusUpdatedAt" timestamptz null,
  add column if not exists "shippingCarrier" text null,
  add column if not exists "trackingNumber" text null;

-- Append-only audit trail -- every successful transition, independent of (and never replacing) the
-- current-state columns above. Same relationship ProcessedWebhookEvent has to MapleOrder's payment
-- columns: the columns on MapleOrder are the fast read-optimized "current state" projection, this
-- table is the real history. No update/delete path is ever used against it by application code.
create table if not exists "MapleOrderFulfillmentEvent" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references "MapleOrder"(id) on delete cascade,
  "fromStatus" text null,
  "toStatus" text not null,
  "shippingCarrier" text null,
  "trackingNumber" text null,
  "changedAt" timestamptz not null default now()
);

create index if not exists "MapleOrderFulfillmentEvent_orderId_idx" on "MapleOrderFulfillmentEvent" ("orderId");

alter table "MapleOrderFulfillmentEvent" enable row level security;
-- Deny-all, same posture as every other table in 002_maple_orders.sql -- service-role only.

-- Server-side-validated transition. ALL validity rules (allowed target states, pickup-vs-delivery
-- branching, the PAID precondition, tracking-number requirement for SHIPPED) are enforced HERE, in
-- the one place every caller must go through -- never trusted from the client. The row lock on the
-- initial SELECT ... FOR UPDATE is what makes two concurrent identical staff clicks (or a
-- double form-submit) collapse into one real transition and one harmless idempotent no-op, rather
-- than two audit rows or a corrupted intermediate state -- same atomicity principle as
-- mark_order_paid_and_sync_attempt's own row lock (007's header).
create function transition_order_fulfillment_status(
  p_order_id uuid,
  p_to_status text,
  p_shipping_carrier text default null,
  p_tracking_number text default null
)
returns table (
  success boolean,
  error text,
  new_status text
)
language plpgsql
as $$
declare
  v_payment_status text;
  v_current text;
  v_is_pickup boolean;
  v_allowed boolean := false;
begin
  select "status", "fulfillmentStatus",
         coalesce(("shippingAddress"->>'fulfillmentMethod') = 'pickup', false)
    into v_payment_status, v_current, v_is_pickup
  from "MapleOrder"
  where id = p_order_id
  for update;

  if not found then
    return query select false, 'Order not found'::text, null::text;
    return;
  end if;

  if v_payment_status != 'PAID' then
    return query select false, 'Order is not paid -- fulfillment cannot start or change'::text, v_current;
    return;
  end if;

  if p_to_status not in ('AWAITING_PRODUCTION', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED') then
    return query select false, format('Unknown fulfillment status: %s', p_to_status), v_current;
    return;
  end if;

  -- Idempotent no-op: a duplicate click/request for the exact status it's already at succeeds
  -- harmlessly rather than erroring or writing a second identical audit row.
  if v_current = p_to_status then
    return query select true, null::text, v_current;
    return;
  end if;

  v_allowed := case
    when v_current is null and p_to_status = 'AWAITING_PRODUCTION' then true
    when v_current = 'AWAITING_PRODUCTION' and p_to_status = 'IN_PRODUCTION' then true
    when v_current = 'IN_PRODUCTION' and p_to_status = 'READY_FOR_PICKUP' and v_is_pickup then true
    when v_current = 'IN_PRODUCTION' and p_to_status = 'SHIPPED' and not v_is_pickup then true
    when v_current = 'READY_FOR_PICKUP' and p_to_status = 'COMPLETED' then true
    when v_current = 'SHIPPED' and p_to_status = 'COMPLETED' then true
    else false
  end;

  if not v_allowed then
    return query select false, format('Cannot move from %s to %s for this order''s fulfillment method', coalesce(v_current, '(none)'), p_to_status), v_current;
    return;
  end if;

  if p_to_status = 'SHIPPED' and (p_tracking_number is null or length(trim(p_tracking_number)) = 0) then
    return query select false, 'A tracking number is required to mark an order shipped'::text, v_current;
    return;
  end if;

  update "MapleOrder"
  set "fulfillmentStatus" = p_to_status,
      "fulfillmentStatusUpdatedAt" = now(),
      "shippingCarrier" = coalesce(p_shipping_carrier, "shippingCarrier"),
      "trackingNumber" = coalesce(p_tracking_number, "trackingNumber"),
      "updatedAt" = now()
  where id = p_order_id;

  insert into "MapleOrderFulfillmentEvent" ("orderId", "fromStatus", "toStatus", "shippingCarrier", "trackingNumber")
  values (p_order_id, v_current, p_to_status, p_shipping_carrier, p_tracking_number);

  return query select true, null::text, p_to_status;
end;
$$;

-- New functions default to EXECUTE granted to PUBLIC -- revoke explicitly rather than trust it was
-- never granted. Same posture 009/013 established for mark_order_paid_and_sync_attempt, and the
-- exact lesson 013 learned the hard way: a signature change to an EXISTING function creates a new
-- overload with a fresh default grant, so this must be re-asserted any time this signature changes.
revoke all on function transition_order_fulfillment_status(uuid, text, text, text) from public;
revoke all on function transition_order_fulfillment_status(uuid, text, text, text) from anon;
revoke all on function transition_order_fulfillment_status(uuid, text, text, text) from authenticated;
grant execute on function transition_order_fulfillment_status(uuid, text, text, text) to service_role;

-- Auto-initializes fulfillmentStatus the instant an order is actually paid -- the SAME 5-parameter
-- signature as 013's version (an in-place replace, not a new overload -- grants are preserved when
-- the signature is unchanged; see 013's header for why that distinction matters), with exactly one
-- addition to the existing UPDATE statement. Every other line of this function (payment columns,
-- PaymentAttempt sync logic, both idempotency-key branches, return shape) is byte-for-byte
-- unchanged from 013 -- preserving existing Square payment reconciliation and webhook behavior
-- exactly, per this round's explicit requirement. Because this UPDATE only ever matches a row
-- while "status != 'PAID'" (i.e. the first-ever successful payment transition for that order),
-- "fulfillmentStatus" is always null at this point -- no unconditional overwrite risk.
create or replace function mark_order_paid_and_sync_attempt(
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
      "fulfillmentStatus" = 'AWAITING_PRODUCTION',
      "fulfillmentStatusUpdatedAt" = now(),
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

revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from public;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from anon;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) from authenticated;
grant execute on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb, text) to service_role;
