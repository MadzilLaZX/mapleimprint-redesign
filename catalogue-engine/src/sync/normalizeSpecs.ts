// Maps a supplier's raw, free-text spec label (e.g. S&S's `specName` — "Chest Width", "Body
// Length", whatever vocabulary they actually use) to one of a small set of normalized measurement
// types the frontend Size Guide knows how to render sensibly, grouped and labelled.
//
// IMPORTANT: this vocabulary is UNCONFIRMED. It was written from common industry terminology
// (Gildan/Bella+Canvas/Next Level-style spec sheets use language close to this), not from a real
// S&S API response — nobody has called /v2/specs/ against the live API yet (no credentials
// available in the environment that wrote this). Before trusting this in production:
//   1. Run a real GET /v2/specs/?style=<id> call and log the distinct specName values that
//      actually come back.
//   2. Compare them against SPEC_TYPE_PATTERNS below and adjust.
// An unmatched specName is never dropped — it's stored with normalizedSpecType: null and its raw
// label preserved, so nothing is lost while this list gets tuned against real data.

export type NormalizedSpecType =
  | "CHEST_WIDTH_FLAT"
  | "CHEST_CIRCUMFERENCE"
  | "BODY_LENGTH"
  | "SLEEVE_LENGTH"
  | "SHOULDER_WIDTH"
  | "WAIST"
  | "INSEAM"
  | "NECK";

// Ordered by specificity — first match wins, so put more specific patterns (e.g. "chest width")
// before more general ones (e.g. bare "chest") to avoid a generic term swallowing a specific one.
const SPEC_TYPE_PATTERNS: { type: NormalizedSpecType; patterns: RegExp[] }[] = [
  { type: "CHEST_WIDTH_FLAT", patterns: [/chest.*width/i, /chest.*flat/i, /width.*chest/i] },
  { type: "CHEST_CIRCUMFERENCE", patterns: [/chest.*circ/i, /chest.*around/i, /^chest$/i] },
  { type: "BODY_LENGTH", patterns: [/body.*length/i, /^length$/i, /garment.*length/i] },
  { type: "SLEEVE_LENGTH", patterns: [/sleeve.*length/i, /^sleeve$/i] },
  { type: "SHOULDER_WIDTH", patterns: [/shoulder.*width/i, /shoulder.*to.*shoulder/i, /^shoulder$/i] },
  { type: "WAIST", patterns: [/waist/i] },
  { type: "INSEAM", patterns: [/inseam/i] },
  { type: "NECK", patterns: [/neck/i] },
];

/** Human-readable label + short measuring instruction per normalized type, for the Size Guide UI.
 *  `isFlatMeasurement: true` types are a garment laid flat and measured edge-to-edge — HALF the
 *  actual body circumference, never the same number as a tape measured around the body. The UI
 *  must say this explicitly per type, not just once generically, since a customer comparing a
 *  flat chest-width value against their own body-circumference tape measurement would size down
 *  incorrectly by roughly half. */
export const SPEC_TYPE_INFO: Record<
  NormalizedSpecType,
  { label: string; instruction: string; isFlatMeasurement: boolean }
> = {
  CHEST_WIDTH_FLAT: {
    label: "Chest width",
    instruction:
      "Garment laid flat, measured straight across just below the sleeves — this is HALF the body circumference, not the same as a tape measured around your chest.",
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

export function normalizeSpecName(rawSpecName: string): NormalizedSpecType | null {
  for (const { type, patterns } of SPEC_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(rawSpecName))) return type;
  }
  return null;
}

/** Parses a raw spec value like "21.5" or "21.5 in" into a number + unit. S&S's docs example
 *  ("Neck Size" -> "16") suggests plain numeric strings, inches by convention for US/CA apparel
 *  suppliers — but VERIFY against a real response before trusting the unit assumption; if a raw
 *  value ever includes an explicit unit suffix, that's used instead of the inches default. */
export function parseSpecValue(rawValue: string): { value: number; unit: "in" | "cm" } | null {
  const match = rawValue.trim().match(/^([\d.]+)\s*(in|inch|inches|cm|centimeters?)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unitRaw = match[2]?.toLowerCase();
  const unit: "in" | "cm" = unitRaw?.startsWith("cm") || unitRaw?.startsWith("centim") ? "cm" : "in";
  return { value, unit };
}
