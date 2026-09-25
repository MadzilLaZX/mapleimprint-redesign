// Real VistaPrint business-card pricing, gathered live from their configurator 2026-09-25. Every
// dollar figure is VistaPrint's own real published total price for that stock/quantity — the 30%
// Maple margin (margin.ts) is applied at quote time only, in quoteBusinessCard() below.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type CardStock =
  | "matte" | "glossy" | "uncoated" | "natural-textured" | "pearl" | "linen" | "recycled-matte"
  | "soft-touch" | "kraft" | "hemp" | "bamboo" | "fine-grit" | "ultra-thick";

export const CARD_STOCKS: { value: CardStock; label: string }[] = [
  { value: "matte", label: "Matte" },
  { value: "glossy", label: "Glossy" },
  { value: "uncoated", label: "Uncoated" },
  { value: "natural-textured", label: "Natural Textured" },
  { value: "pearl", label: "Pearl" },
  { value: "linen", label: "Linen" },
  { value: "recycled-matte", label: "Recycled Matte" },
  { value: "soft-touch", label: "Soft Touch" },
  { value: "kraft", label: "Kraft" },
  { value: "hemp", label: "Hemp" },
  { value: "bamboo", label: "Bamboo" },
  { value: "fine-grit", label: "Fine Grit" },
  { value: "ultra-thick", label: "Ultra Thick" },
];

export const CARD_COMMON_QUANTITIES = [50, 100, 250, 500, 1000, 2500, 5000] as const;

// Single-sided total price by [stock][quantity]. Matte has extra real-sampled quantities beyond
// the 7 common tiers (1500/2000/10000); every other stock only has the 7 common ones sampled.
export const CARD_SINGLE_SIDED: Record<CardStock, Partial<Record<number, number>>> = {
  matte: { 50: 10.0, 100: 14.99, 250: 19.99, 500: 24.99, 1000: 37.99, 1500: 53.99, 2000: 65.99, 2500: 80.99, 5000: 127.99, 10000: 222.99 },
  glossy: { 50: 10.0, 100: 15.99, 250: 21.99, 500: 27.99, 1000: 43.99, 2500: 92.99, 5000: 143.99 },
  uncoated: { 50: 10.0, 100: 15.99, 250: 21.99, 500: 26.99, 1000: 41.99, 2500: 89.99, 5000: 143.99 },
  "natural-textured": { 50: 20.99, 100: 29.99, 250: 36.99, 500: 41.99, 1000: 70.99, 2500: 149.99, 5000: 256.99 },
  pearl: { 50: 23.99, 100: 33.99, 250: 40.99, 500: 45.99, 1000: 79.99, 2500: 171.99, 5000: 294.99 },
  // Linen/Recycled Matte/Soft Touch/Kraft share Pearl's single-sided pricing exactly (per the real
  // gathered data) — kept as separate literal rows rather than aliasing, since a future real price
  // check might reveal them diverging.
  linen: { 50: 23.99, 100: 33.99, 250: 40.99, 500: 45.99, 1000: 79.99, 2500: 171.99, 5000: 294.99 },
  "recycled-matte": { 50: 23.99, 100: 33.99, 250: 40.99, 500: 45.99, 1000: 79.99, 2500: 171.99, 5000: 294.99 },
  "soft-touch": { 50: 23.99, 100: 33.99, 250: 40.99, 500: 45.99, 1000: 79.99, 2500: 171.99, 5000: 294.99 },
  kraft: { 50: 23.99, 100: 33.99, 250: 40.99, 500: 45.99, 1000: 79.99, 2500: 171.99, 5000: 294.99 },
  hemp: { 50: 19.99, 100: 28.99, 250: 49.99, 500: 84.99, 1000: 135.99, 2500: 304.99, 5000: 573.99 },
  bamboo: { 50: 23.99, 100: 33.99, 250: 58.99, 500: 88.99, 1000: 142.99, 2500: 315.99, 5000: 589.99 },
  "fine-grit": { 50: 23.99, 100: 33.99, 250: 58.99, 500: 88.99, 1000: 142.99, 2500: 315.99, 5000: 589.99 },
  "ultra-thick": { 50: 26.99, 100: 37.99, 250: 81.99, 500: 143.99, 1000: 241.99, 2500: 551.99, 5000: 949.99 },
};

// Double-sided total price — only sampled for 8 of 13 stocks. Absent entries (Linen/Recycled
// Matte/Soft Touch/Kraft) mean double-sided pricing genuinely wasn't gathered for them, NOT that
// VistaPrint doesn't offer it — doubleSidedAvailable() reflects exactly what we have data for.
export const CARD_DOUBLE_SIDED: Partial<Record<CardStock, Partial<Record<number, number>>>> = {
  matte: { 50: 16.0, 100: 21.99, 250: 30.99, 500: 39.99, 1000: 55.99, 2500: 121.99, 5000: 191.99 },
  glossy: { 50: 16.0, 100: 22.99, 250: 32.99, 500: 42.99, 1000: 61.99, 2500: 133.99, 5000: 207.99 },
  uncoated: { 50: 16.0, 100: 22.99, 250: 32.99, 500: 41.99, 1000: 59.99, 2500: 130.99, 5000: 207.99 },
  "natural-textured": { 50: 26.99, 100: 36.99, 250: 47.99, 500: 56.99, 1000: 86.99, 2500: 183.99, 5000: 313.99 },
  pearl: { 50: 29.99, 100: 40.99, 250: 51.99, 500: 60.99, 1000: 95.99, 2500: 205.99, 5000: 351.99 },
  hemp: { 50: 25.99, 100: 35.99, 250: 60.99, 500: 99.99, 1000: 151.99, 2500: 338.99, 5000: 630.99 },
  bamboo: { 50: 29.99, 100: 40.99, 250: 69.99, 500: 103.99, 1000: 158.99, 2500: 349.99, 5000: 646.99 },
  "ultra-thick": { 50: 32.99, 100: 44.99, 250: 92.99, 500: 158.99, 1000: 257.99, 2500: 585.99, 5000: 1006.99 },
};

// Rounded-corner total price (single-sided) — only sampled for Matte/Glossy.
export const CARD_ROUNDED_CORNERS: Partial<Record<CardStock, Partial<Record<number, number>>>> = {
  matte: { 50: 16.0, 100: 21.99, 250: 29.99, 500: 36.99, 1000: 57.99, 2500: 143.99, 5000: 232.99 },
  glossy: { 50: 16.0, 100: 22.99, 250: 31.99, 500: 39.99, 1000: 63.99, 2500: 155.99, 5000: 248.99 },
};

export function doubleSidedAvailable(stock: CardStock): boolean {
  return stock in CARD_DOUBLE_SIDED;
}
export function roundedCornersAvailable(stock: CardStock): boolean {
  return stock in CARD_ROUNDED_CORNERS;
}
export function availableQuantities(stock: CardStock): number[] {
  return Object.keys(CARD_SINGLE_SIDED[stock])
    .map(Number)
    .sort((a, b) => a - b);
}

export interface CardQuoteInput {
  stock: CardStock;
  quantity: number;
  sides: "single" | "double";
  roundedCorners?: boolean;
}

export interface CardQuoteResult {
  totalCents: number;
  unitPriceCents: number;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function quoteBusinessCard(input: CardQuoteInput): CardQuoteResult | QuoteError {
  const { stock, quantity, sides, roundedCorners } = input;
  if (roundedCorners) {
    if (sides === "double") return { error: "Rounded corners are only available single-sided." };
    if (!roundedCornersAvailable(stock)) return { error: "Rounded corners aren't available for this stock." };
    const price = CARD_ROUNDED_CORNERS[stock]?.[quantity];
    if (price === undefined) return { error: "This quantity isn't offered for this stock." };
    return { totalCents: toCents(applyHouseMargin(price)), unitPriceCents: toCents(applyHouseMargin(price / quantity)) };
  }
  if (sides === "double") {
    if (!doubleSidedAvailable(stock)) return { error: "Double-sided isn't available for this stock." };
    const price = CARD_DOUBLE_SIDED[stock]?.[quantity];
    if (price === undefined) return { error: "This quantity isn't offered for this stock." };
    return { totalCents: toCents(applyHouseMargin(price)), unitPriceCents: toCents(applyHouseMargin(price / quantity)) };
  }
  const price = CARD_SINGLE_SIDED[stock][quantity];
  if (price === undefined) return { error: "This quantity isn't offered for this stock." };
  return { totalCents: toCents(applyHouseMargin(price)), unitPriceCents: toCents(applyHouseMargin(price / quantity)) };
}
