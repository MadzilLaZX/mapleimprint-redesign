# Staging baseline schema

Bootstraps a **brand-new, empty** Supabase project so it has the tables, storage bucket, and base
schema the main app (not catalogue-engine) needs to run against it. Written because this repo's
`supabase/migrations/` folder only contains *incremental* changes — every file in it is either an
`ALTER TABLE` assuming `DesignProject`/`DesignSide`/`DesignObject` already exist, or a brand-new
table added well after the app started. Those three tables have no `CREATE TABLE` anywhere in
version control; they were created directly against the live project before this repo had
migration tooling at all (see `supabase/migrations/001_design_freeze.sql`'s own header comment).
This folder closes that one specific gap — everything else the app needs already has real,
reviewed SQL in `supabase/migrations/`, and this folder deliberately does not duplicate any of it.

## Scope

Covers the main Next.js app's domain only: Studio (`DesignProject`/`DesignSide`/`DesignObject`,
this folder's own `001_core_tables.sql`) and the `design-uploads` storage bucket
(`002_storage_bucket.sql`). Everything else — `Asset`, checkout/payments (`MapleOrder`/
`MapleOrderLine`/`PaymentAttempt`/`ProcessedWebhookEvent`), quotes (`QuoteRequest`/
`QuoteRequestLine`), shipping-quote caching (`ChitChatsShippingQuote`), and the
`mark_order_paid_and_sync_attempt()` function — already has real, reviewed `CREATE TABLE`/
function SQL directly in `supabase/migrations/`; apply those files as-is rather than looking for
a copy of them here.

**Does NOT cover catalogue-engine's own schema** (`MasterProduct`, `SupplierProduct`, `Brand`,
`Category`, etc.) — that's a separate Prisma-managed schema with its own migration tooling
(`catalogue-engine/prisma/`). Run catalogue-engine's own Prisma migrations against the staging
project separately if you want product-catalogue data there too.

## Base table/role grants — a separate gap from RLS, covered by `003_grants.sql`

RLS policies alone are not sufficient on a project created with Supabase's "auto-grant API
access" dashboard toggle off (`mapleimprint-staging` was): every table starts with zero base
SELECT/INSERT/UPDATE/DELETE grants for `anon`/`service_role`, so even a correct RLS policy
42501s with "permission denied for table X" until the matching base grant exists too. See
`003_grants.sql`'s own header for the full derivation (read from real call sites, not guessed)
and exactly which commands each role needs per table.

## Row Level Security policies — intentionally not written out here

This folder's SQL creates tables and the storage bucket, but does **not** include the RLS
policies that scope each table/bucket to its owning session. Two reasons:

1. `supabase/migrations/004_assets.sql` already has a real, reviewed ownership policy for `Asset`
   — `001_core_tables.sql`'s own comment points you at copying that same pattern for
   `DesignProject`/`DesignSide`/`DesignObject` rather than trusting a second, independently
   written copy of the same security-critical logic.
2. The real `design-uploads` bucket's storage-level access policy was never captured as SQL
   anywhere in this repo, and reconstructing a guess at it for a public file — while the real
   bucket is still public in production — isn't something this repo publishes. Copy the real
   policy from the production dashboard (Authentication → Policies → storage.objects) directly
   onto staging's bucket through the Supabase dashboard UI instead; see `002_storage_bucket.sql`'s
   own comment.

## How this was produced — read before trusting it

**`001_core_tables.sql` is a reconstruction, not a copy.** No live database connection was
available while writing this (see `docs/local-test-environment-setup.md`), so there was no way to
run `supabase db pull` against the real project and capture its actual schema byte-for-byte.
Instead, its three tables were rebuilt from every column name/type implied by the application
code that reads or writes them, and from `src/lib/studio/types.ts`'s field lists — deliberately at
their shape from *before* any numbered migration ran (no `assetId`, no export/preview columns),
so applying every file in `supabase/migrations/` on top afterward reaches the exact same final
state this repo's real migration history produces, without this file needing to guess at that
final state itself.

**Before trusting this for anything beyond local experimentation:** if you ever get a moment with
real database credentials, run `npx supabase db pull` against the live project and diff its output
against `001_core_tables.sql`. Fix whichever one is wrong — almost certainly this one, since it
was written without seeing the real schema at all.

## How to apply

Against a fresh local instance (`supabase start`) or a fresh staging project's SQL editor, in order:

1. `001_core_tables.sql` (this folder) — `DesignProject`, `DesignSide`, `DesignObject`.
2. Every file already in `supabase/migrations/`, in numeric order (001 through the highest
   number present) — brings the three tables above to their full current shape and creates
   everything else (`Asset`, checkout/order/payment/quote/shipping-quote tables, the payment
   function). `create table if not exists` / `add column if not exists` make every one of these
   safe to run against a database that doesn't have the earlier state yet.
3. `002_storage_bucket.sql` (this folder) — creates the `design-uploads` bucket, private.
4. In the Supabase dashboard, manually recreate the bucket's access policy and the three Studio
   tables' RLS policies by copying the real, already-reviewed patterns (see the RLS section
   above) — not by writing new policy SQL from a guess.
5. `003_grants.sql` (this folder) — base table/role grants. Only needed if this project (like
   `mapleimprint-staging`) was created with "auto-grant API access" off; skip it if grants
   already exist (a normal Supabase project does this automatically on table creation).

**Never contains real customer data.** These files create empty tables and an empty bucket —
nothing here seeds, copies, or references any real `MapleOrder`/`QuoteRequest`/customer upload.
