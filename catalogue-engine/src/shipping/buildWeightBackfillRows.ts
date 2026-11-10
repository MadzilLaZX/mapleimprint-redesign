// Turns a batch of SupplierProduct rows into the exact values 006_supplier_product_weight.sql's
// columns would be populated with -- pure, synchronous, no DB/network access. This is the
// "population" step explicitly deferred when that migration was prepared: the migration adds the
// columns, this function computes what would go in them. Both are reviewed and approved
// separately from actually running either against the live database.
//
// A row is skipped entirely (not included in the output) when neither a weight nor a dimension
// could be extracted -- there's nothing useful to write, and writing an all-null row would be
// indistinguishable from "not yet processed," which is a worse state than "not present."

import {
  normalizeSanMarWeight,
  normalizeSSActivewearWeight,
  type NormalizedPackageData,
  type WeightConfidence,
} from './normalizeWeight.js';

export interface SupplierProductForBackfill {
  supplierProductId: string;
  supplierCode: 'sanmar' | 'ssactivewear';
  rawPayload: unknown;
}

export interface WeightBackfillRow {
  supplierProductId: string;
  unitWeightLb: number | null;
  caseWeightLb: number | null;
  caseQty: number | null;
  caseLengthIn: number | null;
  caseWidthIn: number | null;
  caseHeightIn: number | null;
  weightConfidence: WeightConfidence | null;
  dimensionsConfidence: WeightConfidence | null;
}

function toRow(supplierProductId: string, data: NormalizedPackageData): WeightBackfillRow {
  return {
    supplierProductId,
    unitWeightLb: data.unitWeightLb,
    caseWeightLb: data.caseWeightLb,
    caseQty: data.caseQty,
    caseLengthIn: data.caseDimensionsIn?.length ?? null,
    caseWidthIn: data.caseDimensionsIn?.width ?? null,
    caseHeightIn: data.caseDimensionsIn?.height ?? null,
    weightConfidence: data.unitWeightConfidence,
    dimensionsConfidence: data.caseDimensionsConfidence,
  };
}

function hasAnyData(row: WeightBackfillRow): boolean {
  return row.unitWeightLb !== null || row.caseWeightLb !== null || row.caseLengthIn !== null;
}

export function buildWeightBackfillRows(products: SupplierProductForBackfill[]): WeightBackfillRow[] {
  const rows: WeightBackfillRow[] = [];
  for (const product of products) {
    const normalized =
      product.supplierCode === 'sanmar'
        ? normalizeSanMarWeight(product.rawPayload)
        : normalizeSSActivewearWeight(product.rawPayload);
    const row = toRow(product.supplierProductId, normalized);
    if (hasAnyData(row)) rows.push(row);
  }
  return rows;
}
