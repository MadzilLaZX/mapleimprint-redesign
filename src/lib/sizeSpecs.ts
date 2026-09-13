// Typed access to the generated size-spec data (src/lib/generated/sizeSpecs.json), produced by
// catalogue-engine/scripts/export-products-for-frontend.mjs from real, synced supplier
// measurements — see catalogue-engine/scripts/sync-specs.mjs. Currently `{}` for every product:
// the sync script exists and is ready to run, but hasn't been run against live S&S credentials
// yet (none available in the environment that built this). A product with no entry here has
// genuinely had no measurements synced — the UI must show that honestly, never a fabricated chart.

import rawSpecs from "./generated/sizeSpecs.json";

export type NormalizedSpecType =
  | "CHEST_WIDTH_FLAT"
  | "CHEST_CIRCUMFERENCE"
  | "BODY_LENGTH"
  | "SLEEVE_LENGTH"
  | "SHOULDER_WIDTH"
  | "WAIST"
  | "INSEAM"
  | "NECK";

export interface SizeSpecRow {
  sizeName: string;
  sizeOrder: string | null;
  specName: string;
  normalizedSpecType: NormalizedSpecType | null;
  value: string;
  unit: "in" | "cm" | null;
}

// Mirrors catalogue-engine/src/sync/normalizeSpecs.ts's SPEC_TYPE_INFO — duplicated here
// deliberately since the frontend has no runtime dependency on catalogue-engine's build output
// (matches the static-JSON architecture; see pricing.ts for the same pattern with the print-cost
// chart). If the measurement vocabulary or instructions change, update both copies.
export const SPEC_TYPE_INFO: Record<
  NormalizedSpecType,
  { label: string; instruction: string; isFlatMeasurement: boolean }
> = {
  CHEST_WIDTH_FLAT: {
    label: "Chest width",
    instruction:
      "Garment laid flat, measured straight across just below the sleeves — this is half the body circumference, not the same as a tape measured around your chest.",
    isFlatMeasurement: true,
  },
  CHEST_CIRCUMFERENCE: {
    label: "Chest",
    instruction: "Measured around the fullest part of the chest.",
    isFlatMeasurement: false,
  },
  BODY_LENGTH: {
    label: "Body length",
    instruction: "From the highest point of the shoulder to the bottom hem.",
    isFlatMeasurement: false,
  },
  SLEEVE_LENGTH: {
    label: "Sleeve length",
    instruction: "From the center back of the collar to the end of the sleeve.",
    isFlatMeasurement: false,
  },
  SHOULDER_WIDTH: {
    label: "Shoulder width",
    instruction: "From one shoulder seam to the other, across the back.",
    isFlatMeasurement: false,
  },
  WAIST: { label: "Waist", instruction: "Garment laid flat, measured straight across the waist.", isFlatMeasurement: true },
  INSEAM: { label: "Inseam", instruction: "From the crotch seam to the bottom of the leg.", isFlatMeasurement: false },
  NECK: { label: "Neck", instruction: "Measured around the collar opening.", isFlatMeasurement: false },
};

const SIZE_SPECS: Record<string, SizeSpecRow[]> = rawSpecs as Record<string, SizeSpecRow[]>;

export function getSizeSpecsFor(productSlug: string): SizeSpecRow[] {
  return SIZE_SPECS[productSlug] ?? [];
}

export const IN_TO_CM = 2.54;
