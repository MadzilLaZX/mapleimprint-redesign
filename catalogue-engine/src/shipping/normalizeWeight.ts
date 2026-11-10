// Extracts package weight/dimension data that BOTH supplier connectors already capture into
// SupplierProduct.rawPayload today but that nothing reads — confirmed via a live query against
// every row in the table (2026-11-10): 671/671 SanMar products carry a per-piece weight, and
// 1102/1102 S&S products carry unitWeight + caseWeight + case dimensions. This was sitting unused
// the whole time; it did not need a new supplier API call to obtain.
//
// PROVENANCE OF EACH UNIT — read before trusting a value downstream:
//
//   SanMar `weight` (Bulk Data / getProductInfoBulk service): SanMar's own published integration
//   guides describe this field as "PIECE_WEIGHT ... approximate weight per piece in pounds" —
//   confirmed from SanMar's own EPDD file-format documentation and Web Services guide text, not
//   invented. Per-piece, not per-case. SanMar's Bulk Data service does not return any case/package
//   weight or dimension field at all (verified against the connector's own documented field list,
//   SanMarConnector.ts lines 10-16) — caseSize is a piece-per-case COUNT, not a weight.
//
//   S&S `unitWeight`/`caseWeight`: multiple independent sources describing S&S's own API state
//   these are in pounds (same convention as SanMar — both are US-headquartered suppliers using
//   the US-standard imperial unit for this field). caseWeight is a real, supplier-stated case
//   weight, not derived.
//
//   S&S `caseWidth`/`caseHeight`/`caseLength`: UNIT NOT EXPLICITLY DOCUMENTED anywhere findable
//   (checked S&S's own API docs page — blocked by the same Cloudflare protection affecting their
//   CDN — and third-party mirrors, which also don't state a unit for these three fields
//   specifically). Treated here as inches on physical-plausibility grounds only: a real sampled
//   case of 24 polos read caseWidth 11.03 / caseHeight 9.13 / caseLength 15.08, which is a
//   plausible real shipping-carton size in inches and an impossible one in centimetres (a
//   15cm-long box could not hold 24 garments). This is a reasoned inference, not a confirmed fact
//   — callers MUST treat `caseDimensions` as lower-confidence than `unitWeightLb`/`caseWeightLb`
//   and should not present it to a customer-facing rate calculation as supplier-certain.
//
// This module does ONE thing: read already-ingested rawPayload, return typed+labelled numbers.
// It does not call any supplier API, does not write to the database, and does not invent a value
// for any field a supplier didn't actually provide (returns null instead).

export type WeightConfidence = 'confirmed' | 'inferred';

export interface NormalizedPackageData {
  supplierCode: 'sanmar' | 'ssactivewear';
  /** Per-piece (single garment) weight in pounds. */
  unitWeightLb: number | null;
  unitWeightConfidence: WeightConfidence | null;
  /** Full case weight in pounds — only ever provided by S&S; null for SanMar (not in this
   *  service's response). */
  caseWeightLb: number | null;
  /** Pieces per case, when known — not a weight, kept alongside for case-weight sanity checks
   *  (e.g. caseWeightLb / caseQty should roughly track unitWeightLb). */
  caseQty: number | null;
  /** Outer case dimensions in inches (see provenance note above re: confidence). Null when the
   *  supplier's response doesn't include dimension fields at all (always null for SanMar). */
  caseDimensionsIn: { length: number; width: number; height: number } | null;
  caseDimensionsConfidence: WeightConfidence | null;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

// Sanity bounds, not supplier-documented facts -- a value outside these is far more likely a unit
// mixup, a decoding bug, or a corrupt upstream row than a real product, so it's rejected (returns
// null) rather than silently accepted and later charged to a customer. Generous on purpose:
// observed real data tops out at 16.25 lb/piece (SanMar) and 8 lb/piece (S&S) -- these bounds
// exist to catch something clearly broken, not to second-guess plausible real values.
const MAX_PLAUSIBLE_UNIT_WEIGHT_LB = 50;
const MAX_PLAUSIBLE_CASE_WEIGHT_LB = 150;
const MAX_PLAUSIBLE_CASE_DIMENSION_IN = 60;
const MAX_PLAUSIBLE_CASE_QTY = 500;

function toBoundedNumber(value: unknown, max: number): number | null {
  const n = toFiniteNumber(value);
  return n !== null && n <= max ? n : null;
}

/** Reads a SanMar SupplierProduct.rawPayload (shape produced by SanMarConnector.ts — a
 *  `{ sampleRow: {...} }` wrapper, one representative row per style) and extracts weight data. */
export function normalizeSanMarWeight(rawPayload: unknown): NormalizedPackageData {
  const row = (rawPayload as { sampleRow?: Record<string, unknown> } | null)?.sampleRow;
  const unitWeightLb = toBoundedNumber(row?.weight, MAX_PLAUSIBLE_UNIT_WEIGHT_LB);
  return {
    supplierCode: 'sanmar',
    unitWeightLb,
    unitWeightConfidence: unitWeightLb !== null ? 'confirmed' : null,
    caseWeightLb: null,
    caseQty: toBoundedNumber(row?.caseSize, MAX_PLAUSIBLE_CASE_QTY),
    caseDimensionsIn: null,
    caseDimensionsConfidence: null,
  };
}

/** Reads an S&S SupplierProduct.rawPayload (shape produced by SSActivewearConnector.ts — a
 *  `{ style: {...}, sampleRow: {...} }` wrapper) and extracts weight + case dimension data. */
export function normalizeSSActivewearWeight(rawPayload: unknown): NormalizedPackageData {
  const row = (rawPayload as { sampleRow?: Record<string, unknown> } | null)?.sampleRow;
  const unitWeightLb = toBoundedNumber(row?.unitWeight, MAX_PLAUSIBLE_UNIT_WEIGHT_LB);
  const caseWeightLb = toBoundedNumber(row?.caseWeight, MAX_PLAUSIBLE_CASE_WEIGHT_LB);
  const length = toBoundedNumber(row?.caseLength, MAX_PLAUSIBLE_CASE_DIMENSION_IN);
  const width = toBoundedNumber(row?.caseWidth, MAX_PLAUSIBLE_CASE_DIMENSION_IN);
  const height = toBoundedNumber(row?.caseHeight, MAX_PLAUSIBLE_CASE_DIMENSION_IN);
  const caseDimensionsIn = length !== null && width !== null && height !== null ? { length, width, height } : null;

  return {
    supplierCode: 'ssactivewear',
    unitWeightLb,
    unitWeightConfidence: unitWeightLb !== null ? 'confirmed' : null,
    caseWeightLb,
    caseQty: toBoundedNumber(row?.caseQty, MAX_PLAUSIBLE_CASE_QTY),
    caseDimensionsIn,
    caseDimensionsConfidence: caseDimensionsIn !== null ? 'inferred' : null,
  };
}

/**
 * The explicit gate between "we have a number" and "it's safe to charge a customer based on it."
 * A real Canada Post rate request must never silently fall back to an `inferred`-confidence
 * measurement as if it were supplier-certain -- that's exactly the kind of quiet downgrade this
 * function exists to prevent. Today this means: weight can be authoritative (both suppliers'
 * weight fields are supplier-documented), dimensions cannot (S&S's case dimension unit is not
 * explicitly documented by S&S -- see this file's header). Callers building a live rate request
 * should check both independently and handle a false result the same way the rest of this
 * codebase handles missing shipping data: ask for a quote rather than fabricate one.
 */
export function hasAuthoritativeUnitWeight(data: NormalizedPackageData): boolean {
  return data.unitWeightConfidence === 'confirmed' && data.unitWeightLb !== null;
}

export function hasAuthoritativeCaseDimensions(data: NormalizedPackageData): boolean {
  return data.caseDimensionsConfidence === 'confirmed' && data.caseDimensionsIn !== null;
}
