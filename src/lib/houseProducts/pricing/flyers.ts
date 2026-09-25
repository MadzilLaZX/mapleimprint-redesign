// Real VistaPrint 8.5"x11" flyer pricing, gathered live from their configurator 2026-09-25. Every
// dollar figure is VistaPrint's own real published total price for that stock/quantity — the 30%
// Maple margin (margin.ts) is applied at quote time only, in quoteFlyer() below.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type FlyerStock =
  | "glossy-budget" | "glossy-standard" | "glossy-premium" | "glossy-premium-plus" | "glossy-deluxe"
  | "matte-budget" | "matte-standard" | "uncoated-budget" | "recycled-standard";

export const FLYER_STOCKS: { value: FlyerStock; label: string }[] = [
  { value: "glossy-budget", label: "Glossy — Budget" },
  { value: "glossy-standard", label: "Glossy — Standard" },
  { value: "glossy-premium", label: "Glossy — Premium" },
  { value: "glossy-premium-plus", label: "Glossy — Premium Plus" },
  { value: "glossy-deluxe", label: "Glossy — Deluxe" },
  { value: "matte-budget", label: "Matte — Budget" },
  { value: "matte-standard", label: "Matte — Standard" },
  { value: "uncoated-budget", label: "Uncoated — Budget" },
  { value: "recycled-standard", label: "Recycled — Standard" },
];

export const FLYER_QUANTITIES = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000] as const;

interface FlyerPriceRow {
  single: number[]; // aligned with FLYER_QUANTITIES
  double: number[];
}

export const FLYER_PRICES: Record<FlyerStock, FlyerPriceRow> = {
  "glossy-budget": { single: [25.99, 39.99, 59.99, 99.99, 134.99, 159.99, 319, 529, 839, 1649], double: [33.99, 52.99, 78.99, 129.99, 175.99, 204.99, 397, 644, 1032, 1970] },
  "glossy-standard": { single: [28.99, 43.99, 64.99, 104.99, 144.99, 169.99, 334, 554, 869, 1699], double: [36.99, 56.99, 83.99, 134.99, 185.99, 214.99, 412, 669, 1062, 2020] },
  "glossy-premium": { single: [36.99, 55.99, 84.99, 134.99, 184.99, 224.99, 444, 774, 1319, 2619], double: [44.99, 68.99, 103.99, 164.99, 225.99, 269.99, 522, 889, 1512, 2940] },
  "glossy-premium-plus": { single: [41.99, 63.99, 97.99, 154.99, 211.99, 256.99, 510, 889, 1517, 3012], double: [49.99, 76.99, 116.99, 184.99, 252.99, 301.99, 588, 1004, 1710, 3333] },
  "glossy-deluxe": { single: [58.99, 88.99, 135.99, 215.99, 292.99, 353.99, 708, 1236, 2111, 4191], double: [66.99, 101.99, 154.99, 245.99, 333.99, 398.99, 786, 1351, 2304, 4512] },
  "matte-budget": { single: [28.99, 43.99, 65.99, 109.99, 147.99, 175.99, 351, 582, 923, 1814], double: [36.99, 56.99, 84.99, 139.99, 188.99, 220.99, 429, 697, 1116, 2135] },
  "matte-standard": { single: [31.99, 47.99, 70.99, 114.99, 157.99, 185.99, 366, 607, 953, 1864], double: [39.99, 60.99, 89.99, 144.99, 198.99, 230.99, 444, 722, 1146, 2185] },
  "uncoated-budget": { single: [28.99, 43.99, 65.99, 109.99, 147.99, 175.99, 351, 582, 923, 1814], double: [36.99, 56.99, 84.99, 139.99, 188.99, 220.99, 429, 697, 1116, 2135] },
  "recycled-standard": { single: [34.99, 48.99, 75.99, 119.99, 167.99, 195.99, 381, 632, 983, 1914], double: [42.99, 61.99, 94.99, 149.99, 208.99, 240.99, 459, 747, 1176, 2235] },
};

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface FlyerQuoteInput {
  stock: FlyerStock;
  sides: "single" | "double";
  quantity: number;
}

export interface FlyerQuoteResult {
  totalCents: number;
  unitPriceCents: number;
}

export function quoteFlyer(input: FlyerQuoteInput): FlyerQuoteResult | QuoteError {
  const idx = FLYER_QUANTITIES.indexOf(input.quantity as (typeof FLYER_QUANTITIES)[number]);
  if (idx === -1) return { error: "This quantity isn't offered." };
  const price = FLYER_PRICES[input.stock][input.sides][idx];
  return { totalCents: toCents(applyHouseMargin(price)), unitPriceCents: toCents(applyHouseMargin(price / input.quantity)) };
}
