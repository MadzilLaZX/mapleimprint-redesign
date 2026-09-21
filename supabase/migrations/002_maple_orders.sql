-- Maple order/payment schema — checkout + Square Sandbox payments pipeline.
--
-- Ownership/security model, deliberately different from DesignProject/DesignSide/DesignObject:
-- those tables use permissive RLS scoped by a self-issued, unsigned `x-mi-session` cookie, which
-- is fine for low-stakes design autosave but not safe for payment/PII data (anyone who copies a
-- session cookie value gains full read/write to that "session"). These four tables use deny-all
-- RLS instead — no anon/authenticated policies at all — mirroring how catalogue-engine's Prisma
-- tables are locked down. Every access path is server-only, through src/lib/server/supabaseAdmin.ts
-- (the service-role key, which bypasses RLS entirely). Never expose these tables to the anon key.
--
-- Money is stored as integer cents, not floats — src/lib/studio/pricing.ts's floats are fine for
-- display but wrong to persist for a payment record.
--
-- Apply against the `maple-imprint-catalogue` Supabase project (ovqkwedpwmuusnijbxro) via the SQL
-- editor, same out-of-band process as 001_design_freeze.sql.

create table if not exists "MapleOrder" (
  id uuid primary key default gen_random_uuid(),
  -- Human/support-facing token, NOT sequential (see order confirmation page's IDOR note) — must
  -- carry enough entropy that guessing/enumerating another order isn't practical, since the
  -- confirmation page reads by reference through the service-role client.
  reference text not null unique,
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED')),
  "contactName" text not null,
  "contactEmail" text not null,
  "contactPhone" text not null,
  "shippingAddress" jsonb not null,
  "subtotalCents" integer not null,
  "taxCents" integer not null default 0,
  "shippingCents" integer not null default 0,
  "totalCents" integer not null,
  currency text not null default 'CAD',
  "squareOrderId" text null,
  "squarePaymentId" text null,
  "squareLocationId" text null,
  -- Guards the order-confirmation email so it fires exactly once even if the synchronous payment
  -- response and a webhook reconciliation both resolve PAID close together.
  "emailSentAt" timestamptz null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "MapleOrderLine" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references "MapleOrder"(id) on delete cascade,
  -- The CartItem.id string this line came from — traceability only, not a foreign key (cart is
  -- client-side/localStorage, has no server row).
  "cartItemId" text not null,
  "productName" text not null,
  "categorySlug" text not null,
  "colourName" text null,
  "sizeBreakdown" jsonb null,
  quantity integer not null,
  "unitPriceCents" integer not null,
  "lineTotalCents" integer not null,
  "customizationType" text null,
  "designProjectId" uuid null,
  "designFrozenRevision" integer null,
  -- Denormalized copy of DesignProject.designSnapshot at order-creation time — an order line
  -- stays reconstructable even if the live Studio row is later deleted/GC'd. Null for BLANK lines.
  "designSnapshot" jsonb null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "MapleOrderLine_orderId_idx" on "MapleOrderLine" ("orderId");

create table if not exists "PaymentAttempt" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references "MapleOrder"(id) on delete cascade,
  -- Generated once per checkout submission and persisted before the Square call, so retries
  -- (including a customer double-click) reuse it rather than risking a duplicate charge.
  "idempotencyKey" text not null unique,
  "squarePaymentId" text null,
  status text not null default 'CREATED' check (status in ('CREATED', 'SUCCEEDED', 'FAILED')),
  "sourceType" text not null check ("sourceType" in ('CARD', 'APPLE_PAY', 'GOOGLE_PAY')),
  "failureReason" text null,
  "rawResponse" jsonb null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "PaymentAttempt_orderId_idx" on "PaymentAttempt" ("orderId");

create table if not exists "ProcessedWebhookEvent" (
  id uuid primary key default gen_random_uuid(),
  -- Square's own event id — existence of a row here is the idempotency guard against Square's
  -- at-least-once webhook redelivery.
  "squareEventId" text not null unique,
  "eventType" text not null,
  "receivedAt" timestamptz not null default now(),
  payload jsonb not null
);

alter table "MapleOrder" enable row level security;
alter table "MapleOrderLine" enable row level security;
alter table "PaymentAttempt" enable row level security;
alter table "ProcessedWebhookEvent" enable row level security;
-- Deliberately no policies created for anon/authenticated — deny-all. Service-role connections
-- (src/lib/server/supabaseAdmin.ts) bypass RLS entirely and are the only intended access path.
