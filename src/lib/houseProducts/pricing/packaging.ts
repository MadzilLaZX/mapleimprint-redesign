// Real VistaPrint packaging pricing, gathered live from their rendered configurators 2026-10-10.
// Same "real anchor + flagged estimate" technique as signs.ts/stickers.ts/banners.ts.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type PackagingKind = "product-box" | "mailer-box" | "tissue-paper" | "packaging-tape";

export interface BoxSize {
  key: string;
  label: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

function box(l: number, w: number, h: number): BoxSize {
  return { key: `${l}x${w}x${h}`, label: `${l}" x ${w}" x ${h}"`, lengthIn: l, widthIn: w, heightIn: h };
}

// REAL confirmed size deltas, VistaPrint reverse-tuck product boxes at qty 100 — base size
// 2.25"x2.25"x2.25" = $105.00 total ($1.05/unit), every other size a confirmed +/- dollar delta
// off that same qty-100 total (not an independently re-derived per-unit price).
export const PRODUCT_BOX_SIZES: BoxSize[] = [
  box(2.25, 2.25, 2.25), box(2, 2, 2), box(2.5, 2.5, 2.25), box(2.75, 2.75, 2.25), box(2.75, 2.75, 2.75),
  box(3, 3, 1.5), box(3.5, 2.5, 1), box(4, 4, 2), box(5, 3, 1.5), box(6, 4, 2.5),
];
const PRODUCT_BOX_BASE_QTY100 = 105.0;
const PRODUCT_BOX_DELTA_AT_QTY100: Record<string, number> = {
  "2.25x2.25x2.25": 0,
  "2x2x2": -15.0,
  "2.5x2.5x2.25": 20.0,
  "2.75x2.75x2.25": 20.0,
  "2.75x2.75x2.75": 45.0,
  // Confirmed deltas only ran to the sizes above (same live-session cutoff as the sign anchors) —
  // the remaining 5 sizes are estimated by scaling the confirmed deltas' $/cubic-inch rate onto
  // their own volume, flagged below.
};

// REAL confirmed size surcharges, VistaPrint custom mailer boxes at qty 144 — base size
// 5"x3"x1.5" = $404.00 total ($2.81/unit), every other size a confirmed +dollar surcharge off that
// same qty-144 total.
export const MAILER_BOX_SIZES: BoxSize[] = [
  box(5, 3, 1.5), box(6, 4, 3), box(6, 5, 2.25), box(7, 5, 3), box(8, 6, 3),
  box(8, 8, 5), box(9, 6, 4), box(9, 7, 2.25), box(9.5, 7.75, 4), box(11.25, 9, 3), box(12, 9, 2),
];
const MAILER_BOX_BASE_QTY144 = 404.0;
const MAILER_BOX_SURCHARGE_AT_QTY144: Record<string, number> = {
  "5x3x1.5": 0,
  "6x4x3": 101.0,
  "6x5x2.25": 95.0,
  "7x5x3": 129.0,
  "8x6x3": 183.0,
  "8x8x5": 337.0,
  "9x6x4": 227.0,
  "9x7x2.25": 168.0,
  "9.5x7.75x4": 242.0,
  "11.25x9x3": 251.0,
  "12x9x2": 227.0,
};

function volumeOf(s: BoxSize): number {
  return s.lengthIn * s.widthIn * s.heightIn;
}

function boxPriceAtReferenceQty(
  sizes: BoxSize[],
  sizeKey: string,
  baseTotal: number,
  deltas: Record<string, number>,
): { totalAtRefQty: number; isEstimate: boolean } | undefined {
  const target = sizes.find((s) => s.key === sizeKey);
  if (!target) return undefined;
  if (deltas[sizeKey] !== undefined) return { totalAtRefQty: baseTotal + deltas[sizeKey], isEstimate: false };
  // Unconfirmed size — scale the confirmed deltas' average $/cubic-inch rate onto this size's own
  // volume (same area/volume-proportional fallback banners.ts and signs.ts both already use).
  const confirmedKeys = Object.keys(deltas).filter((k) => k !== "0");
  let totalRate = 0;
  let count = 0;
  for (const key of confirmedKeys) {
    const s = sizes.find((x) => x.key === key);
    if (!s || volumeOf(s) === 0) continue;
    totalRate += deltas[key] / volumeOf(s);
    count++;
  }
  const avgRate = count > 0 ? totalRate / count : 0;
  return { totalAtRefQty: baseTotal + avgRate * volumeOf(target), isEstimate: true };
}

// REAL anchor: VistaPrint tissue paper, 14"x10", White, 10# weight, qty 100 — $36.99 total
// ($0.3699/sheet).
function sz(w: number, h: number) {
  return { key: `${w}x${h}`, label: `${w}" x ${h}"`, widthIn: w, heightIn: h };
}
const TISSUE_SHEET_SIZES = [sz(14, 10), sz(20, 14), sz(24, 18), sz(29, 21)];
const TISSUE_ANCHOR = { sizeKey: "14x10", pricePer100: 36.99 };
export const TISSUE_SIZES = TISSUE_SHEET_SIZES;
export type TissueMaterial = "white" | "kraft";
export const TISSUE_WEIGHTS = [10, 18, 30] as const;

// REAL anchors: VistaPrint packaging tape, 100' roll qty 1 = $24.99; 300' roll = +$20.00
// ($44.99 total).
const TAPE_ROLL_LENGTHS = [
  { key: "100ft", label: "100 ft roll", priceAtQty1: 24.99 },
  { key: "300ft", label: "300 ft roll", priceAtQty1: 44.99 },
];
export const TAPE_ROLL_OPTIONS = TAPE_ROLL_LENGTHS.map((r) => ({ value: r.key, label: r.label }));

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface PackagingQuoteInput {
  kind: PackagingKind;
  sizeKey?: string; // product-box / mailer-box (BoxSize key) or tissue-paper (TissueSize key)
  rollKey?: string; // packaging-tape only
  weight?: 10 | 18 | 30; // tissue-paper only
  quantity: number;
}

export interface PackagingQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  isEstimate: boolean;
}

const WEIGHT_MULTIPLIER: Record<number, number> = { 10: 1, 18: 1.25, 30: 1.6 }; // heavier paper costs more per sheet — estimate, only 10# was confirmed

export function quotePackaging(input: PackagingQuoteInput): PackagingQuoteResult | QuoteError {
  const { kind, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Invalid quantity." };

  if (kind === "product-box") {
    if (!input.sizeKey) return { error: "Choose a size." };
    const result = boxPriceAtReferenceQty(PRODUCT_BOX_SIZES, input.sizeKey, PRODUCT_BOX_BASE_QTY100, PRODUCT_BOX_DELTA_AT_QTY100);
    if (!result) return { error: "Unknown size." };
    const perUnit = result.totalAtRefQty / 100; // linear per-unit from the qty-100 anchor — no bulk curve was confirmed, same conservative approach as stickers.ts
    return {
      unitPriceCents: toCents(applyHouseMargin(perUnit)),
      totalCents: toCents(applyHouseMargin(perUnit * quantity)),
      isEstimate: result.isEstimate || quantity !== 100,
    };
  }

  if (kind === "mailer-box") {
    if (!input.sizeKey) return { error: "Choose a size." };
    const result = boxPriceAtReferenceQty(MAILER_BOX_SIZES, input.sizeKey, MAILER_BOX_BASE_QTY144, MAILER_BOX_SURCHARGE_AT_QTY144);
    if (!result) return { error: "Unknown size." };
    const perUnit = result.totalAtRefQty / 144;
    return {
      unitPriceCents: toCents(applyHouseMargin(perUnit)),
      totalCents: toCents(applyHouseMargin(perUnit * quantity)),
      isEstimate: result.isEstimate || quantity !== 144,
    };
  }

  if (kind === "tissue-paper") {
    if (!input.sizeKey) return { error: "Choose a size." };
    const target = TISSUE_SHEET_SIZES.find((s) => s.key === input.sizeKey);
    if (!target) return { error: "Unknown size." };
    const anchor = TISSUE_SHEET_SIZES.find((s) => s.key === TISSUE_ANCHOR.sizeKey)!;
    const isAnchorSize = input.sizeKey === TISSUE_ANCHOR.sizeKey;
    const areaRatio = (target.widthIn * target.heightIn) / (anchor.widthIn * anchor.heightIn);
    const weight = input.weight ?? 10;
    const weightMultiplier = WEIGHT_MULTIPLIER[weight] ?? 1;
    const perUnitAt100 = TISSUE_ANCHOR.pricePer100 * areaRatio * weightMultiplier;
    const perUnit = perUnitAt100 / 100;
    return {
      unitPriceCents: toCents(applyHouseMargin(perUnit)),
      totalCents: toCents(applyHouseMargin(perUnit * quantity)),
      isEstimate: !isAnchorSize || weight !== 10 || quantity !== 100,
    };
  }

  // packaging-tape
  const roll = TAPE_ROLL_LENGTHS.find((r) => r.key === input.rollKey) ?? TAPE_ROLL_LENGTHS[0];
  const perUnit = roll.priceAtQty1;
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
    isEstimate: quantity > 1, // no real bulk-roll discount curve was found — linear above qty 1, same conservative direction as signs.ts
  };
}

export const PACKAGING_LABELS: Record<PackagingKind, string> = {
  "product-box": "Custom Product Boxes",
  "mailer-box": "Mailer & Shipping Boxes",
  "tissue-paper": "Custom Tissue Paper",
  "packaging-tape": "Custom Packaging Tape",
};
