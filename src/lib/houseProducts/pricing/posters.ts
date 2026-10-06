// Real VistaPrint poster pricing, gathered live from vistaprint.com/hub/poster-sizes 2026-10-06 —
// a static, server-rendered reference page (unlike most of VistaPrint's JS-gated configurators),
// so this is a full real size ladder, not an estimate. Every price is VistaPrint's own real
// published single-unit price for their standard/semi-gloss stock — the 30% Maple margin
// (margin.ts) is applied at quote time only, in quotePoster() below. No quantity-discount curve or
// material-delta data was found for posters (the hub page only shows qty-1 pricing), so — same as
// stickers.ts — pricing here is linear per unit from this one real anchor per size, and only one
// material (Standard Semi-Gloss) is offered live-priced; other VistaPrint stocks (Premium Matte,
// Premium Glossy, Foam-Mounted, Outdoor) are real options but weren't priced, so they're not
// offered here rather than guessed.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export interface PosterSize {
  key: string;
  label: string;
  widthIn: number;
  heightIn: number;
  /** VistaPrint's real single-unit price, Standard Semi-Gloss stock. */
  priceAt1: number;
}

export const POSTER_SIZES: PosterSize[] = [
  { key: "8.5x11", label: "8.5\" x 11\"", widthIn: 8.5, heightIn: 11, priceAt1: 3.99 },
  { key: "11x17", label: "11\" x 17\"", widthIn: 11, heightIn: 17, priceAt1: 9.59 },
  { key: "16x20", label: "16\" x 20\"", widthIn: 16, heightIn: 20, priceAt1: 10.39 },
  { key: "18x24", label: "18\" x 24\"", widthIn: 18, heightIn: 24, priceAt1: 13.59 },
  { key: "22x28", label: "22\" x 28\"", widthIn: 22, heightIn: 28, priceAt1: 23.99 },
  { key: "24x36", label: "24\" x 36\"", widthIn: 24, heightIn: 36, priceAt1: 28.79 },
  { key: "28x40", label: "28\" x 40\"", widthIn: 28, heightIn: 40, priceAt1: 35.19 },
  { key: "36x48", label: "36\" x 48\"", widthIn: 36, heightIn: 48, priceAt1: 49.59 },
];

export type PosterOrientation = "portrait" | "landscape";

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface PosterQuoteInput {
  sizeKey: string;
  quantity: number;
}

export interface PosterQuoteResult {
  unitPriceCents: number;
  totalCents: number;
}

export function quotePoster(input: PosterQuoteInput): PosterQuoteResult | QuoteError {
  const { sizeKey, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Invalid quantity." };
  const size = POSTER_SIZES.find((s) => s.key === sizeKey);
  if (!size) return { error: "Unknown poster size." };
  return {
    unitPriceCents: toCents(applyHouseMargin(size.priceAt1)),
    totalCents: toCents(applyHouseMargin(size.priceAt1 * quantity)),
  };
}
