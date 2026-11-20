-- Base table/role privileges, closing a gap NOT covered by 001/002 or anything in
-- supabase/migrations/: this project (mapleimprint-staging) was created with Supabase's
-- "auto-grant API access" dashboard toggle OFF. On a normal Supabase project, creating a table
-- automatically grants the base SELECT/INSERT/UPDATE/DELETE privileges a table's own RLS
-- policies are meant to gate -- with that toggle off, EVERY table here (including the
-- already-existing ones from supabase/migrations/) only has the baseline
-- REFERENCES/TRIGGER/TRUNCATE for `anon`/`authenticated`/`service_role`, confirmed via
-- `information_schema.role_table_grants`. RLS policies alone do nothing without this: Postgres
-- checks the GRANT before it ever evaluates a row's RLS policy, so a missing grant surfaces as
-- `permission denied for table X` (42501) regardless of how correct the policy is.
--
-- This file is NOT "grant everything a policy would technically allow." Each statement below is
-- derived from actually reading the real (non-test) call sites that use that role's client, and
-- grants exactly the command(s) exercised there -- see each block's comment. Re-derive this list
-- from the code if routes are ever added/removed, rather than assuming it stays complete forever.
--
-- Apply after 001_core_tables.sql, every file in supabase/migrations/, and 002_storage_bucket.sql
-- (needs every table these statements reference to already exist).

-- === anon -- Studio's session-scoped (RLS-governed) client, createStudioClient() ===
-- Matches exactly the operations src/app/api/studio/**/route.ts performs. No DELETE on
-- DesignProject/DesignSide (never deleted directly by the app), no UPDATE on DesignObject
-- (autosave replaces via delete+insert, never updates a row in place).
grant select, insert, update on "DesignProject" to anon;
grant select, insert on "DesignSide" to anon;
grant select, insert, delete on "DesignObject" to anon;
-- Asset: saveUpload.ts does `.insert({...}).select("id").single()` -- PostgREST's
-- `Prefer: return=representation` behind `.select()` needs SELECT in addition to INSERT, not
-- just INSERT alone, or the insert itself 42501s even though the row would otherwise be valid.
-- The app never reads Asset back via the anon key for any other reason, so nothing broader than
-- this is granted despite the table's own "owner_all_asset" RLS policy (migration 004)
-- nominally permitting UPDATE/DELETE too.
grant select, insert on "Asset" to anon;

-- === anon -- design-uploads bucket, same session-scoped client ===
-- saveUpload.ts / remove-background/route.ts upload directly; no anon-key read ever happens
-- (every real read goes through a server-issued signed URL via the service-role client) and no
-- anon-key delete ever happens either -- see the storage.objects RLS policies in
-- 002_storage_bucket.sql's companion setup for the matching per-session-folder restriction.
grant select, insert, update on storage.objects to anon;

-- === service_role -- the admin client, createAdminClient() ===
-- Bypasses RLS entirely (BYPASSRLS), same as every Supabase project's service_role by default --
-- these grants restore the standard baseline that "auto-grant API access OFF" suppressed, they
-- do not change service_role's trust model (it was always fully trusted; this just lets it do
-- its job). Derived from every real `supabaseAdmin`/`admin` call site in src/app and src/lib
-- (excluding *.test.ts files, which use their own isolated local/cloud connections and never run
-- automatically):
--   - DesignProject/Asset: SELECT only (src/lib/admin/fileInventory.ts, the admin quote/order
--     detail + ZIP routes, src/app/api/admin/design/[id]/json/route.ts). Admin never writes
--     either table.
--   - MapleOrder: SELECT/INSERT/UPDATE/DELETE (src/app/api/checkout/pay/route.ts creates, looks
--     up, updates squareOrderId, and rolls back with DELETE on a partial failure;
--     src/lib/checkout/fulfillOrder.ts sets emailSentAt). UPDATE is also required for
--     mark_order_paid_and_sync_attempt() -- confirmed SECURITY INVOKER (not DEFINER), so its
--     internal UPDATE runs as whichever role calls it (service_role), not as the function owner.
--   - MapleOrderLine: SELECT/INSERT (order-line creation at checkout; read back for
--     fulfillment/admin ZIP). No direct UPDATE/DELETE in app code -- MapleOrder's
--     `on delete cascade` handles line cleanup without needing a separate grant (FK-cascade
--     deletes are enforced by the system trigger, not subject to the deleting role's own
--     table-level DELETE grant on the child table).
--   - PaymentAttempt: SELECT/INSERT/UPDATE (idempotency lookup, creation, and status updates in
--     checkout/pay/route.ts; also updated by the RPC above).
--   - ProcessedWebhookEvent: INSERT only (src/app/api/webhooks/square/route.ts relies on the
--     unique constraint on squareEventId for dedup, not a SELECT-then-insert check).
--   - QuoteRequest: SELECT/INSERT (idempotency lookup; `.insert({...}).select("id").single()`
--     needs SELECT for the same PostgREST return=representation reason as Asset above).
--   - QuoteRequestLine: SELECT/INSERT (line creation in src/app/api/quote/route.ts; read back by
--     the admin quote ZIP route).
--   - DesignSide/DesignObject: NOT granted -- no admin-client call site touches either table
--     directly anywhere in the app; Studio's own session-scoped client already covers them.
--   - ChitChatsShippingQuote: NOT granted -- SupabaseChitChatsQuoteStore's own header comment
--     confirms it is "NOT reachable from any live code path today" (zero API routes construct
--     it); grant this table once that wiring actually ships, re-deriving from its real call
--     sites at that point rather than guessing now.
grant select on "DesignProject" to service_role;
grant select on "Asset" to service_role;
grant select, insert, update, delete on "MapleOrder" to service_role;
grant select, insert on "MapleOrderLine" to service_role;
grant select, insert, update on "PaymentAttempt" to service_role;
grant insert on "ProcessedWebhookEvent" to service_role;
grant select, insert on "QuoteRequest" to service_role;
grant select, insert on "QuoteRequestLine" to service_role;
