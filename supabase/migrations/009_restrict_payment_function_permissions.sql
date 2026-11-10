-- APPLIED against the `maple-imprint-catalogue` Supabase project (ovqkwedpwmuusnijbxro),
-- 2026-11-11, same out-of-band process as 001-008.
--
-- mark_order_paid_and_sync_attempt() (007) was created with a plain `create function` statement
-- and no explicit REVOKE -- Postgres's default is to grant EXECUTE to PUBLIC, which (via Supabase's
-- role setup) meant `anon` and `authenticated` could invoke a function that transitions a real
-- order to PAID and its payment attempt to SUCCEEDED, not just `service_role`.
--
-- Verified live with the project's own anon key before this fix: the call succeeded (no
-- permission error) but RLS on MapleOrder/PaymentAttempt (zero policies, confirmed separately)
-- meant the resulting UPDATE affected zero rows -- the order's status was confirmed unchanged
-- afterward. So this was not an active, exploitable hole today, but relying on RLS as the *only*
-- barrier is fragile: a future permissive policy added for an unrelated feature could silently
-- make this function exploitable by any unauthenticated caller. Re-verified after this fix: the
-- anon key now gets a clean 42501 permission-denied calling this function at all, and the real
-- app's service-role access is unaffected.
--
-- This migration exists so that restriction survives a fresh deployment of 007 (e.g. a new
-- environment, or 007 being replayed from scratch) rather than only existing as a manual,
-- undocumented follow-up fix. `create or replace function` in 007 does not reset grants on an
-- existing function, but a brand-new deployment running 007 alone would recreate the original,
-- overly-permissive default -- this file is what makes the restriction part of the repeatable
-- migration history, not a one-off applied only to this project's current database.

revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb) from public;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb) from anon;
revoke all on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb) from authenticated;
grant execute on function mark_order_paid_and_sync_attempt(uuid, text, text, jsonb) to service_role;
