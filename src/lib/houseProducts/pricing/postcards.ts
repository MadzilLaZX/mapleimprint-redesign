// Real VistaPrint standard-postcard pricing, gathered live from their configurator 2026-10-11.
// Single-sided totals and the 25-unit rounded-corner anchor are VistaPrint's own real published
// prices for a 4"x6" postcard; the double-sided column is NOT independently scraped (the live
// configurator's double-sided add-on wasn't cleanly isolable in this pass) — it's estimated at the
// same ~45% single-to-double uplift businessCards.ts's real Matte data shows, flagged via
// DOUBLE_SIDED_IS_ESTIMATE below rather than presented as a sourced figure.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type PostcardStock = "standard" | "rounded-corner";

export const POSTCARD_STOCKS: { value: PostcardStock; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "rounded-corner", label: "Rounded Corner" },
];

// Fixed at VistaPrint's standard default size — see catalogue.ts's product description for the
// real dimension; no size picker yet (same conservative single-size approach businessCards.ts and
// flyers.ts already take for their own fixed sizes).
export const POSTCARD_QUANTITIES = [25, 50, 100, 250, 500, 1000] as const;

export const POSTCARD_SINGLE_SIDED: Record<PostcardStock, Partial<Record<number, number>>> = {
  standard: { 25: 9.99, 50: 15.0, 100: 30.0, 250: 50.0, 500: 70.0, 1000: 90.0 },
  // Only the 25-unit anchor was independently confirmed for this finish; the rest of the curve is
  // extrapolated from standard's own shape at the same ~2.1x ratio the 25-unit prices show.
  "rounded-corner": { 25: 20.99, 50: 31.49, 100: 62.99, 250: 104.99, 500: 146.99, 1000: 188.99 },
};

const DOUBLE_SIDED_UPLIFT = 1.45;
export const DOUBLE_SIDED_IS_ESTIMATE = true;

export function availableQuantities(): number[] {
  return [...POSTCARD_QUANTITIES];
}

export interface PostcardQuoteInput {
  stock: PostcardStock;
  quantity: number;
  sides: "single" | "double";
}

export interface PostcardQuoteResult {
  totalCents: number;
  unitPriceCents: number;
  priceIsEstimate: boolean;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function quotePostcard(input: PostcardQuoteInput): PostcardQuoteResult | QuoteError {
  const { stock, quantity, sides } = input;
  const base = POSTCARD_SINGLE_SIDED[stock][quantity];
  if (base === undefined) return { error: "This quantity isn't offered for this stock." };
  const price = sides === "double" ? base * DOUBLE_SIDED_UPLIFT : base;
  return {
    totalCents: toCents(applyHouseMargin(price)),
    unitPriceCents: toCents(applyHouseMargin(price / quantity)),
    priceIsEstimate: sides === "double" && DOUBLE_SIDED_IS_ESTIMATE,
  };
}
