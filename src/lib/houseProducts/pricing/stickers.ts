// Real VistaPrint custom-sticker pricing, gathered live from their configurator 2026-10-06. Every
// REAL_* price below is VistaPrint's own real published total price at quantity 200 — the 30%
// Maple margin (margin.ts) is applied at quote time only, in quoteSticker() below.
//
// Unlike banners/cards/flyers (where every cell in the price grid was individually confirmed),
// VistaPrint's sticker pages only fully rendered a complete size+material ladder for ONE shape
// (Oval) before the site's anti-bot redirect cut research short — Square got a full SIZE ladder
// (one material), Circle/Rectangle/Die-Cut each got exactly one confirmed size+material point.
// Missing cells are filled by SCALING a real confirmed ratio from the shape with full data onto
// the shape that's missing it (e.g. Oval's real "3x5 costs 2.08x what 1x2 costs" ratio applied to
// Rectangle's one real anchor price) — the same technique already used for banner add-ons
// (banners.ts, addonsFor()) — rather than inventing a number outright. Every estimated cell is
// marked isEstimate: true wherever it's surfaced, exactly like the banner module.
//
// VistaPrint showed no real bulk-quantity discount curve on any sticker page (unlike banners,
// where one was found) — pricing here is deliberately LINEAR per unit from the one confirmed
// quantity-200 rate, not a fabricated discount curve. This likely slightly OVER-prices large
// orders relative to VistaPrint's real (probably-discounted) bulk rate — the safe direction, since
// it never UNDER-prices Maple's own margin.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type StickerShape = "square" | "circle" | "rectangle" | "oval" | "die-cut";

export const STICKER_SHAPES: { value: StickerShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "rectangle", label: "Rectangle" },
  { value: "oval", label: "Oval" },
  { value: "die-cut", label: "Die-Cut (custom shape)" },
];

export type StickerMaterial = "white-paper" | "white-plastic" | "clear-plastic" | "gold-foil" | "silver-foil" | "holographic";

export const STICKER_MATERIALS: { value: StickerMaterial; label: string }[] = [
  { value: "white-plastic", label: "White Plastic (water-resistant)" },
  { value: "white-paper", label: "White Paper" },
  { value: "clear-plastic", label: "Clear Plastic (water-resistant)" },
  { value: "gold-foil", label: "Gold Foil" },
  { value: "silver-foil", label: "Silver Foil" },
  { value: "holographic", label: "Holographic" },
];

export interface StickerSize {
  key: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

function sz(widthIn: number, heightIn: number): StickerSize {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString());
  return { key: `${widthIn}x${heightIn}`, widthIn, heightIn, label: `${fmt(widthIn)}" x ${fmt(heightIn)}"` };
}

// Real sizes VistaPrint offers per shape (confirmed from the live catalogue, not invented).
export const STICKER_SIZES: Record<StickerShape, StickerSize[]> = {
  square: [sz(1.5, 1.5), sz(2, 2), sz(2.5, 2.5), sz(3, 3), sz(4, 4)],
  circle: [sz(1.5, 1.5), sz(2, 2), sz(2.5, 2.5), sz(3, 3), sz(4, 4)],
  rectangle: [sz(1, 2), sz(2, 3), sz(3, 4), sz(3, 5)],
  oval: [sz(1, 2), sz(2, 3), sz(3, 4), sz(3, 5)],
  "die-cut": [sz(2, 2), sz(2.5, 2.5), sz(3, 3), sz(3.5, 3.5), sz(4, 4), sz(4.5, 4.5), sz(5, 5)],
};

// Real materials offered per shape (confirmed from the live catalogue).
export const STICKER_MATERIALS_BY_SHAPE: Record<StickerShape, StickerMaterial[]> = {
  square: ["white-plastic", "white-paper", "clear-plastic", "gold-foil", "silver-foil"],
  circle: ["white-plastic", "white-paper", "clear-plastic", "gold-foil", "silver-foil", "holographic"],
  rectangle: ["white-plastic", "white-paper", "clear-plastic", "gold-foil", "silver-foil", "holographic"],
  oval: ["white-plastic", "white-paper", "clear-plastic", "gold-foil", "silver-foil", "holographic"],
  "die-cut": ["white-plastic", "white-paper", "clear-plastic", "holographic"],
};

// REAL White Plastic prices at quantity 200 (VistaPrint's sale price, the actual current
// customer-facing number) — the one fully-sampled size ladder for Square.
const SQUARE_WHITE_PLASTIC_AT_200: Record<string, number> = {
  "1.5x1.5": 54.39, "2x2": 76.79, "2.5x2.5": 86.39, "3x3": 95.99, "4x4": 129.59,
};

// REAL White Plastic price at quantity 200, one confirmed anchor point.
const CIRCLE_WHITE_PLASTIC_2X2 = 54.39;

// REAL full size + material ladder at quantity 200, White Plastic base — Oval is the only shape
// VistaPrint's page fully rendered before the research session's anti-bot redirect, so it's the
// source of the real relative-scaling ratios used to estimate Rectangle (same 4 sizes) below.
const OVAL_WHITE_PLASTIC_AT_200: Record<string, number> = {
  "1x2": 57.59, "2x3": 87.99, "3x4": 110.39, "3x5": 119.99,
};
// REAL per-unit material deltas at size 1x2, White Plastic as $0 baseline.
const OVAL_MATERIAL_DELTA_AT_1X2: Partial<Record<StickerMaterial, number>> = {
  "white-paper": -6.0, "clear-plastic": 12.0, "gold-foil": 22.0, "silver-foil": 22.0, "holographic": 9.0,
};

// REAL White Plastic price at quantity 200, one confirmed anchor point.
const DIE_CUT_WHITE_PLASTIC_2X2 = 76.79;

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Scales a shape's one real confirmed anchor price across its other sizes using a DIFFERENT
 *  shape's real empirical size-to-price ratios (the same "borrow a real curve shape, don't invent
 *  one" technique banners.ts uses for add-ons). Returns both the price and whether it's a direct
 *  real number (the anchor itself) or a scaled estimate. */
function scaleFromRatioSource(
  targetSizes: StickerSize[],
  anchorSizeKey: string,
  anchorPrice: number,
  ratioSource: Record<string, number>,
  ratioAnchorKey: string,
): Record<string, { price: number; isEstimate: boolean }> {
  const ratioAnchorPrice = ratioSource[ratioAnchorKey];
  const out: Record<string, { price: number; isEstimate: boolean }> = {};
  for (const s of targetSizes) {
    if (s.key === anchorSizeKey) {
      out[s.key] = { price: anchorPrice, isEstimate: false };
      continue;
    }
    const ratioPrice = ratioSource[s.key];
    if (ratioPrice !== undefined) {
      out[s.key] = { price: anchorPrice * (ratioPrice / ratioAnchorPrice), isEstimate: true };
    } else {
      // Size isn't in the ratio source either (e.g. die-cut's 3.5/4.5/5 sizes, which neither
      // square nor itself has a confirmed point for) — fall back to area-proportional scaling
      // from the nearest size we DO have a price for, same approach as banners.ts's addonsFor().
      const targetArea = s.widthIn * s.heightIn;
      let nearestKey = anchorSizeKey;
      let nearestDiff = Infinity;
      for (const s2 of targetSizes) {
        const p = s2.key === anchorSizeKey ? anchorPrice : out[s2.key]?.price;
        if (p === undefined) continue;
        const diff = Math.abs(s2.widthIn * s2.heightIn - targetArea);
        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearestKey = s2.key;
        }
      }
      const nearestSize = targetSizes.find((x) => x.key === nearestKey)!;
      const nearestPrice = nearestKey === anchorSizeKey ? anchorPrice : out[nearestKey].price;
      const scale = targetArea / (nearestSize.widthIn * nearestSize.heightIn);
      out[s.key] = { price: nearestPrice * scale, isEstimate: true };
    }
  }
  return out;
}

interface StickerCell {
  priceAt200: number;
  isEstimate: boolean;
}

/** Every (shape, size, material) price at quantity 200 — computed once at module load from the
 *  real anchors above, not re-derived per quote call. Real cells use VistaPrint's own confirmed
 *  dollar figure; estimated cells are flagged per-cell so the configurator can show "estimated
 *  pricing" instead of presenting a guess as fact. */
function buildStickerPrices(): Record<StickerShape, Record<string, Partial<Record<StickerMaterial, StickerCell>>>> {
  const result = {} as Record<StickerShape, Record<string, Partial<Record<StickerMaterial, StickerCell>>>>;

  // Square: real size ladder, White Plastic only (no material delta data was gathered for it).
  result.square = {};
  for (const [sizeKey, price] of Object.entries(SQUARE_WHITE_PLASTIC_AT_200)) {
    result.square[sizeKey] = { "white-plastic": { priceAt200: price, isEstimate: false } };
  }

  // Circle: one real anchor (2x2), scaled across sizes using Square's real ratios (same bounding
  // box dimensions, same material, closest physical analog available).
  const circleBySize = scaleFromRatioSource(STICKER_SIZES.circle, "2x2", CIRCLE_WHITE_PLASTIC_2X2, SQUARE_WHITE_PLASTIC_AT_200, "2x2");
  result.circle = {};
  for (const [sizeKey, { price, isEstimate }] of Object.entries(circleBySize)) {
    result.circle[sizeKey] = { "white-plastic": { priceAt200: price, isEstimate } };
  }

  // Oval: fully real — size ladder AND material deltas both confirmed.
  result.oval = {};
  for (const [sizeKey, basePrice] of Object.entries(OVAL_WHITE_PLASTIC_AT_200)) {
    const row: Partial<Record<StickerMaterial, StickerCell>> = { "white-plastic": { priceAt200: basePrice, isEstimate: false } };
    if (sizeKey === "1x2") {
      for (const [material, delta] of Object.entries(OVAL_MATERIAL_DELTA_AT_1X2)) {
        row[material as StickerMaterial] = { priceAt200: basePrice + delta, isEstimate: false };
      }
    } else {
      // Material deltas were only confirmed at 1x2 — apply the same dollar delta to other sizes
      // as an estimate (VistaPrint's own deltas showed no clear per-size pattern to model more
      // precisely, so a flat dollar delta is the most conservative extrapolation).
      for (const [material, delta] of Object.entries(OVAL_MATERIAL_DELTA_AT_1X2)) {
        row[material as StickerMaterial] = { priceAt200: basePrice + delta, isEstimate: true };
      }
    }
    result.oval[sizeKey] = row;
  }

  // Rectangle: shares Oval's exact 4 sizes — borrow Oval's real ratios AND material deltas onto
  // Rectangle's own one real anchor (1x2, White Plastic).
  const rectangleBySize = scaleFromRatioSource(STICKER_SIZES.rectangle, "1x2", 52.79, OVAL_WHITE_PLASTIC_AT_200, "1x2");
  result.rectangle = {};
  for (const [sizeKey, { price, isEstimate }] of Object.entries(rectangleBySize)) {
    const row: Partial<Record<StickerMaterial, StickerCell>> = { "white-plastic": { priceAt200: price, isEstimate } };
    for (const [material, delta] of Object.entries(OVAL_MATERIAL_DELTA_AT_1X2)) {
      row[material as StickerMaterial] = { priceAt200: price + delta, isEstimate: true };
    }
    result.rectangle[sizeKey] = row;
  }

  // Die-cut: one real anchor (2x2), scaled across sizes using Square's real ratios (same material,
  // same size range for the sizes they share; area-proportional fallback for 3.5/4.5/5", which
  // Square doesn't offer).
  const dieCutBySize = scaleFromRatioSource(STICKER_SIZES["die-cut"], "2x2", DIE_CUT_WHITE_PLASTIC_2X2, SQUARE_WHITE_PLASTIC_AT_200, "2x2");
  result["die-cut"] = {};
  for (const [sizeKey, { price, isEstimate }] of Object.entries(dieCutBySize)) {
    result["die-cut"][sizeKey] = {
      "white-plastic": { priceAt200: price, isEstimate },
      "white-paper": { priceAt200: price - 6.0, isEstimate: true }, // borrowing Oval's real white-paper delta
      "clear-plastic": { priceAt200: price + 12.0, isEstimate: true },
      holographic: { priceAt200: price + 9.0, isEstimate: true },
    };
  }

  return result;
}

const STICKER_PRICES = buildStickerPrices();

export function stickerCell(shape: StickerShape, sizeKey: string, material: StickerMaterial): StickerCell | undefined {
  return STICKER_PRICES[shape]?.[sizeKey]?.[material];
}

/** STICKER_MATERIALS_BY_SHAPE above lists every material VistaPrint's own site offers per shape,
 *  but buildStickerPrices() only ever priced the subset this research actually sampled (e.g. Square
 *  and Circle only got a White Plastic price ladder, despite VistaPrint showing 5-6 material
 *  options for them) — selecting an unpriced material silently turned into a quote error with no
 *  obvious cause. This narrows the advertised list down to materials this module can actually
 *  quote for that shape, checked against its first size (price-cell availability is uniform across
 *  a shape's own sizes, per buildStickerPrices' construction, so one size is representative). */
export function pricedMaterialsForShape(shape: StickerShape): StickerMaterial[] {
  const firstSize = STICKER_SIZES[shape][0].key;
  return STICKER_MATERIALS_BY_SHAPE[shape].filter((m) => stickerCell(shape, firstSize, m) !== undefined);
}

export interface StickerQuoteInput {
  shape: StickerShape;
  sizeKey: string;
  material: StickerMaterial;
  quantity: number;
}

export interface StickerQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  isEstimate: boolean;
}

const MIN_STICKER_QTY = 10;

export function quoteSticker(input: StickerQuoteInput): StickerQuoteResult | QuoteError {
  const { shape, sizeKey, material, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < MIN_STICKER_QTY) return { error: `Minimum order is ${MIN_STICKER_QTY} stickers.` };
  const cell = stickerCell(shape, sizeKey, material);
  if (!cell) return { error: "This material isn't available for this shape/size." };
  // Linear per-unit (see this file's top comment — no real bulk-discount curve was found).
  const perUnit = cell.priceAt200 / 200;
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
    isEstimate: cell.isEstimate,
  };
}
