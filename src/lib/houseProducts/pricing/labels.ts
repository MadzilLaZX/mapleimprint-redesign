// Real VistaPrint paper (roll) label pricing, gathered live from their configurator 2026-10-06.
// Every SIZE price below is VistaPrint's own real published total price at quantity 1000, Circle
// shape, White Paper, Multi-Column Roll — the fullest real ladder found for any label/sticker
// product this session. The 30% Maple margin (margin.ts) is applied at quote time only, in
// quoteLabel() below.
// Format (+Single-Column Roll) and material deltas were only confirmed at one size (1"x1") —
// applied as a flat dollar delta to every size here, same "borrow a real delta, don't invent one"
// technique as stickers.ts. Shape (Circle/Square/Rounded Square) was confirmed as price-equivalent
// on VistaPrint's own default roll configuration — no shape-specific price difference was found,
// so the same size ladder applies to all three. No real bulk-quantity curve beyond qty 1000 was
// found, so — same as posters.ts/stickers.ts — pricing is linear per unit from this one anchor.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type LabelShape = "circle" | "square" | "rounded-square";

export const LABEL_SHAPES: { value: LabelShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "rounded-square", label: "Rounded Square" },
];

export type LabelMaterial = "white-paper" | "uncoated-paper" | "betulla-laid-paper";

export const LABEL_MATERIALS: { value: LabelMaterial; label: string; deltaAt1000: number }[] = [
  { value: "white-paper", label: "White Paper", deltaAt1000: 0 },
  { value: "uncoated-paper", label: "Uncoated Paper", deltaAt1000: 20.8 },
  { value: "betulla-laid-paper", label: "Betulla Laid Paper", deltaAt1000: 31.2 },
];

export type LabelFormat = "multi-column-roll" | "single-column-roll";

export const LABEL_FORMATS: { value: LabelFormat; label: string; deltaAt1000: number }[] = [
  { value: "multi-column-roll", label: "Multi-Column Roll", deltaAt1000: 0 },
  { value: "single-column-roll", label: "Single-Column Roll", deltaAt1000: 16.0 },
];

// Real total price at quantity 1000, White Paper, Multi-Column Roll — the sampled base ladder.
export const LABEL_SIZES: { key: string; label: string; priceAt1000: number }[] = [
  { key: "1x1", label: "1\" x 1\"", priceAt1000: 79.99 },
  { key: "1.5x1.5", label: "1.5\" x 1.5\"", priceAt1000: 99.99 },
  { key: "2x2", label: "2\" x 2\"", priceAt1000: 107.99 },
  { key: "2.5x2.5", label: "2.5\" x 2.5\"", priceAt1000: 136.79 },
  { key: "3x3", label: "3\" x 3\"", priceAt1000: 174.39 },
  { key: "3.5x3.5", label: "3.5\" x 3.5\"", priceAt1000: 193.59 },
  { key: "4x4", label: "4\" x 4\"", priceAt1000: 202.39 },
  { key: "5x5", label: "5\" x 5\"", priceAt1000: 230.39 },
];

const MIN_LABEL_QTY = 50;

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface LabelQuoteInput {
  sizeKey: string;
  material: LabelMaterial;
  format: LabelFormat;
  quantity: number;
}

export interface LabelQuoteResult {
  unitPriceCents: number;
  totalCents: number;
}

export function quoteLabel(input: LabelQuoteInput): LabelQuoteResult | QuoteError {
  const { sizeKey, material, format, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < MIN_LABEL_QTY) {
    return { error: `Minimum order is ${MIN_LABEL_QTY} labels.` };
  }
  const size = LABEL_SIZES.find((s) => s.key === sizeKey);
  if (!size) return { error: "Unknown label size." };
  const materialDelta = LABEL_MATERIALS.find((m) => m.value === material)?.deltaAt1000 ?? 0;
  const formatDelta = LABEL_FORMATS.find((f) => f.value === format)?.deltaAt1000 ?? 0;
  const totalAt1000 = size.priceAt1000 + materialDelta + formatDelta;
  const perUnit = totalAt1000 / 1000;
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
  };
}
