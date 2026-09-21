-- Design-freeze mechanism for DesignProject.
--
-- Problem: DesignProject is mutable and continuously autosaved (see PATCH /api/studio/[id]),
-- with no mechanism preventing edits after a design is approved and added to cart. A cart/order
-- line references a DesignProject by id + a `revision` counter that is never actually
-- incremented anywhere in the app — so nothing today stops a customer from reopening Studio
-- after checkout and silently changing what a paid order would produce.
--
-- Fix: freezing copies the full, assembled DesignProjectRecord (project + sides + objects) into
-- a self-contained JSONB snapshot at approve time, and the autosave PATCH route refuses to touch
-- a project once it's frozen. Orders reference the snapshot, never the live mutable rows.
--
-- Apply this against the `maple-imprint-catalogue` Supabase project (ovqkwedpwmuusnijbxro) via
-- the SQL editor — same out-of-band process used for the original DesignProject/DesignSide/
-- DesignObject tables (no migration tooling in this repo runs this automatically).

alter table "DesignProject"
  add column if not exists "frozenAt" timestamptz null,
  add column if not exists "designSnapshot" jsonb null,
  add column if not exists "frozenRevision" integer null;

-- `revision` already exists as a plain integer counter (default 0) but nothing ever increments
-- it today. From this migration forward, the autosave PATCH route increments it on every
-- successful sides-mutation; no schema change needed for that, this comment just documents the
-- behavior change happening in application code alongside this migration.
