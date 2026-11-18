-- Studio's three base tables, reconstructed for a FRESH project at their PRE-migration-history
-- shape -- see this folder's README.md for how and why. Deliberately does NOT include the
-- columns added later by supabase/migrations/001, 004, 005, 006 (frozenAt/designSnapshot/
-- frozenRevision, assetId, exportStatus/exportedFiles/exportError/exportedAt, previewFiles) --
-- apply every file already in supabase/migrations/ on top of this one, in numeric order, to
-- bring a fresh project to the same final shape this repo's reviewed migration history produces.
-- That also resolves a real ordering dependency: supabase/migrations/004_assets.sql both CREATEs
-- "Asset" and ALTERs "DesignObject" to add a column referencing it -- which only works once
-- "DesignObject" already exists, exactly as it does immediately after this file runs.
--
-- Column names/types are a data-model mirror of src/lib/studio/types.ts (already public) --
-- this is not access-control or security-relevant information on its own.
--
-- Row Level Security policies are DELIBERATELY NOT included here. See the comment right before
-- `alter table ... enable row level security` below for why, and what to do instead.

create table if not exists "DesignProject" (
  id uuid primary key default gen_random_uuid(),
  "ownerSession" text not null,
  "productSlug" text not null,
  "categorySlug" text not null,
  "subcategorySlug" text not null,
  "productName" text not null,
  "brandName" text not null,
  "colourName" text not null,
  -- SizeQty[] -- [{ size: string, qty: number }, ...]
  "sizeBreakdown" jsonb not null,
  "totalQuantity" integer not null,
  "productTemplateVersion" text not null,
  "pricingSnapshot" jsonb null,
  "mockupImages" jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'ordered')),
  revision integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "DesignProject_ownerSession_idx" on "DesignProject" ("ownerSession");

create table if not exists "DesignSide" (
  id uuid primary key default gen_random_uuid(),
  "designProjectId" uuid not null references "DesignProject"(id) on delete cascade,
  "sideType" text not null,
  "printAreaWidth" numeric not null,
  "printAreaHeight" numeric not null
);

create index if not exists "DesignSide_designProjectId_idx" on "DesignSide" ("designProjectId");

create table if not exists "DesignObject" (
  id uuid primary key default gen_random_uuid(),
  "designSideId" uuid not null references "DesignSide"(id) on delete cascade,
  type text not null check (type in ('image', 'text', 'shape', 'qr')),
  "assetUrl" text null,
  content text null,
  "fontFamily" text null,
  "fontSize" numeric null,
  fill text null,
  "normalizedX" numeric not null,
  "normalizedY" numeric not null,
  "normalizedWidth" numeric not null,
  "normalizedHeight" numeric not null,
  rotation numeric not null default 0,
  opacity numeric not null default 1,
  "zIndex" integer not null default 0,
  name text null,
  hidden boolean not null default false,
  -- --- text-only ---
  bold boolean not null default false,
  italic boolean not null default false,
  align text null check (align in ('left', 'center', 'right')),
  "letterSpacing" numeric null,
  "lineHeight" numeric null,
  curve numeric null,
  underline boolean null,
  strikethrough boolean null,
  "textTransform" text null check ("textTransform" in ('none', 'uppercase', 'lowercase', 'title')),
  "effectType" text null check ("effectType" in ('none', 'shadow', 'lift', 'glow', 'background', 'hollow')),
  "shadowColor" text null,
  "shadowOpacity" numeric null,
  "shadowBlur" numeric null,
  "shadowOffsetX" numeric null,
  "shadowOffsetY" numeric null,
  "bgColor" text null,
  "bgPadding" numeric null,
  "bgCornerRadius" numeric null,
  -- --- shape-only (strokeColor/strokeWidth also reused for the text Outline effect) ---
  "shapeKind" text null,
  "strokeColor" text null,
  "strokeWidth" numeric null,
  -- --- image-only ---
  "flipX" boolean not null default false,
  "flipY" boolean not null default false,
  "cropX" numeric null,
  "cropY" numeric null,
  "cropWidth" numeric null,
  "cropHeight" numeric null,
  -- --- qr-only ---
  "qrDestination" text null,
  "qrErrorCorrection" text null check ("qrErrorCorrection" in ('L', 'M', 'Q', 'H')),
  "qrForegroundColor" text null,
  "qrBackgroundColor" text null,
  "qrDotStyle" text null check ("qrDotStyle" in ('square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded')),
  "qrCornerStyle" text null check ("qrCornerStyle" in ('square', 'dot', 'extra-rounded')),
  "qrLogoUrl" text null,
  "qrStylePreset" text null check ("qrStylePreset" in ('classic', 'rounded', 'soft', 'bold', 'minimal')),
  "qrFrameStyle" text null check ("qrFrameStyle" in ('none', 'border')),
  "qrLabelText" text null,
  "qrValidated" boolean null,
  "qrAssetId" text null
);

create index if not exists "DesignObject_designSideId_idx" on "DesignObject" ("designSideId");

alter table "DesignProject" enable row level security;
alter table "DesignSide" enable row level security;
alter table "DesignObject" enable row level security;

-- RLS POLICIES ARE DELIBERATELY NOT WRITTEN OUT HERE. supabase/migrations/004_assets.sql already
-- contains a real, reviewed ownership policy for the Asset table (scoped to the caller's
-- x-mi-session header) -- apply that SAME pattern to these three tables yourself, adapting the
-- predicate to join through DesignSide/DesignProject for the two tables with no ownerSession
-- column of their own, rather than trusting a second, independently-written copy of
-- security-critical policy logic in this file. Writing out two separately-maintained copies of
-- the same access-control rule is exactly the kind of drift risk that caused problems before
-- (see 009_restrict_payment_function_permissions.sql's own history) -- copy the existing,
-- already-reviewed pattern directly instead.
