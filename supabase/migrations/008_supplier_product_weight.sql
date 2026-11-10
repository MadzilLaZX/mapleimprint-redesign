-- NOT APPLIED. Prepared for review only -- do not run against the live database without
-- explicit approval (per session instruction 2026-11-10).
--
-- Adds nullable shipping-weight columns to SupplierProduct so
-- normalizeSanMarWeight()/normalizeSSActivewearWeight() output (catalogue-engine/src/shipping/
-- normalizeWeight.ts) has somewhere to land without a second pass through rawPayload on every
-- checkout. Purely additive -- no existing column changes, no data loss, every new column
-- nullable. Confirmed live: 671/671 SanMar and 1102/1102 S&S SupplierProduct rows already have
-- the source data this would populate from (see normalizeWeight.ts's header for exactly which
-- fields, their confirmed/inferred units, and provenance).
--
-- Population (the actual UPDATE, once this is approved and applied) is computed by
-- buildWeightBackfillRows() -- tested against representative fixtures including the full
-- 671+1102 scale, see catalogue-engine/test/build-weight-backfill-rows.test.ts -- but running it
-- for real is a separate, not-yet-approved step from this schema addition.
--
-- hasAuthoritativeUnitWeight()/hasAuthoritativeCaseDimensions() (same module) are the gate any
-- real Canada Post rate request must pass before treating a value here as supplier-certain --
-- weightConfidence/dimensionsConfidence below exist specifically so that gate has something to
-- check. Today every S&S case-dimension row would be 'inferred' (unit not explicitly documented
-- by S&S) and therefore NOT authoritative for a real charge, by design.

alter table "SupplierProduct"
  add column if not exists "unitWeightLb" numeric null,
  add column if not exists "caseWeightLb" numeric null,
  add column if not exists "caseQty" integer null,
  add column if not exists "caseLengthIn" numeric null,
  add column if not exists "caseWidthIn" numeric null,
  add column if not exists "caseHeightIn" numeric null,
  -- 'confirmed' = supplier's own documentation states the unit; 'inferred' = unit not explicitly
  -- documented, value accepted on physical-plausibility grounds only (see normalizeWeight.ts).
  -- Kept separately for weight vs dimensions since S&S's case dimensions are 'inferred' while its
  -- weights are 'confirmed'.
  add column if not exists "weightConfidence" text null check ("weightConfidence" in ('confirmed','inferred')),
  add column if not exists "dimensionsConfidence" text null check ("dimensionsConfidence" in ('confirmed','inferred'));
