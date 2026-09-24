// Splits a product's existing `priceTiers` (wholesale cost run through the margin+.99 rule, plus
// the client's print-cost chart, baked together by catalogue-engine's export — see
// calculatePrice() in catalogue-engine/src/pricing/engine.ts) back into its two components: a
// pure blank-garment price and the chart's per-location printing cost. This is deliberately NOT a
// second pricing pipeline — it's algebra on numbers the site already computes and already shows
// the customer, so "Buy It Blank" and Studio's line-item breakdown stay consistent with the
// shop's "From $X" price instead of drifting from it.
//
// PRICING AUDIT (2026-09-24) — two corrections landed together, see PROJECT_NOTES.md for the full
// writeup:
//   1. catalogue-engine's "40%" was a MARKUP (cost x 1.40), not the client's specified 40% GROSS
//      MARGIN (cost / 0.60) — fixed in catalogue-engine/src/pricing/engine.ts. That fix requires
//      re-running the export pipeline against live supplier cost data (this session has no
//      database access to do that) — so `priceTiers`/`startingPrice` in the CURRENTLY exported
//      src/lib/generated/products.json still reflect the OLD markup math until that re-export
//      happens. blankUnitPrice() below is pure algebra on whatever that file currently contains,
//      so it will automatically become margin-correct the moment the file is regenerated — no
//      code change needed here for that part.
//   2. This file was unconditionally adding a flat $20 DESIGN_FEE on top of printing cost for
//      EVERY customized order — on top of a first-print fee that is ALSO $20 at quantity 1-2,
//      silently double-charging (a $15 blank + $20 print should total $35, not $35 + another $20
//      design fee = $55). Removed for the standard self-service Studio flow (see
//      calculateCustomizePrice below) — DESIGN_FEE/the `designFee` field are kept only because
//      Maple-assisted/"Surprise Me" design SERVICE flows may get a real fee later; they must never
//      apply it automatically to a customer who designs their own artwork.
//
// The three charts (apparel, headwear, mug) share the client's quantity-tier boundaries but
// different dollar values and, for mugs, a different SHAPE (a decoration MODE choice, not
// additive locations) — see catalogue-engine/src/pricing/rules/seed-data.ts, duplicated here
// since the frontend has no runtime dependency on that package (static-JSON architecture). These
// are the client's own published printing costs, not a secret, so mirroring them here is safe; if
// the chart ever changes both copies need updating.

import type { CatalogueProduct } from "@/lib/products";
import { familyFor, type ProductFamily } from "@/lib/studio/productDecorationProfile";

export interface ChartTier {
  minQty: number;
  maxQty: number | null;
  firstLocationCost: number;
  additionalLocationCost: number;
}

const APPAREL_CHART: ChartTier[] = [
  { minQty: 1, maxQty: 2, firstLocationCost: 20.0, additionalLocationCost: 5.0 },
  { minQty: 3, maxQty: 10, firstLocationCost: 18.0, additionalLocationCost: 4.5 },
  { minQty: 11, maxQty: 35, firstLocationCost: 15.0, additionalLocationCost: 4.0 },
  { minQty: 36, maxQty: 70, firstLocationCost: 12.0, additionalLocationCost: 3.5 },
  { minQty: 71, maxQty: 99, firstLocationCost: 9.0, additionalLocationCost: 3.25 },
  { minQty: 100, maxQty: null, firstLocationCost: 7.0, additionalLocationCost: 3.0 },
];

const HEADWEAR_CHART: ChartTier[] = [
  { minQty: 1, maxQty: 2, firstLocationCost: 12.0, additionalLocationCost: 3.0 },
  { minQty: 3, maxQty: 10, firstLocationCost: 10.0, additionalLocationCost: 2.5 },
  { minQty: 11, maxQty: 35, firstLocationCost: 8.0, additionalLocationCost: 2.0 },
  { minQty: 36, maxQty: 70, firstLocationCost: 7.0, additionalLocationCost: 1.75 },
  { minQty: 71, maxQty: 99, firstLocationCost: 6.5, additionalLocationCost: 1.5 },
  { minQty: 100, maxQty: null, firstLocationCost: 5.99, additionalLocationCost: 1.0 },
];

export interface MugChartTier {
  minQty: number;
  maxQty: number | null;
  oneSideCost: number;
  wrapAroundCost: number;
}

// Mugs are a decoration-METHOD choice (one-side vs wrap-around), never "first print + additional
// locations" — a wrap-around mug is one selected option, not two stacked print charges. No live
// mug product exists yet (S&S/SanMar don't carry drinkware — see productDecorationProfile.ts's
// familyFor comment), so this is the pricing FORMULA only; Studio has no decoration-mode picker UI
// to wire it into yet, honestly deferred until a real mug product exists to test against.
export const MUG_CHART: MugChartTier[] = [
  { minQty: 1, maxQty: 2, oneSideCost: 10.0, wrapAroundCost: 15.0 },
  { minQty: 3, maxQty: 10, oneSideCost: 8.0, wrapAroundCost: 12.0 },
  { minQty: 11, maxQty: 35, oneSideCost: 7.5, wrapAroundCost: 10.0 },
  { minQty: 36, maxQty: 70, oneSideCost: 7.0, wrapAroundCost: 9.0 },
  { minQty: 71, maxQty: 99, oneSideCost: 6.5, wrapAroundCost: 8.0 },
  { minQty: 100, maxQty: null, oneSideCost: 5.99, wrapAroundCost: 7.0 },
];

/** No longer applied automatically anywhere (see this file's 2026-09-24 header note) — kept only
 *  as the number a future Maple-assisted/Designer-service fee would reuse, never charged to a
 *  standard self-service Studio order. */
export const DESIGN_FEE = 20.0;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function chartFor(product: CatalogueProduct): ChartTier[] | null {
  const family: ProductFamily = familyFor(product.categorySlug, product.subcategorySlug);
  if (family === "headwear") return HEADWEAR_CHART;
  if (family === "mug") return null; // mugs use MUG_CHART's mode-based shape, not this additive-location shape
  if (family === "tee" || family === "hoodie" || family === "joggers" || family === "accessory") return APPAREL_CHART;
  return null; // business-card/flyer/poster — no approved apparel-style print rule; see Phase 11's "unmapped" handling
}

function tierFor<T extends { minQty: number; maxQty: number | null }>(chart: T[], quantity: number): T {
  return chart.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)) ?? chart[chart.length - 1];
}

/** The garment's retail price alone, with no decoration — constant across quantity (the client's
 *  chart has no blank-garment quantity discount, only a printing-cost one). Returns null when the
 *  product has no chart at all (bags, aprons, etc. — already `quote_required` everywhere else),
 *  OR when its family has no apparel-shaped print chart (mugs, flat-print families) — those still
 *  get a real blank price via `product.startingPrice` directly where a chart isn't needed to
 *  subtract a printing component out of it first. */
export function blankUnitPrice(product: CatalogueProduct): number | null {
  if (product.priceTiers === null || product.startingPrice === null) return null;
  const chart = chartFor(product);
  if (!chart) return product.startingPrice; // no printing-chart subtraction applies to this family
  return round2(product.startingPrice - chart[0].firstLocationCost);
}

export interface CustomizePriceBreakdown {
  blankUnitPrice: number;
  blankSubtotal: number;
  /** Always 0 for a standard self-service Studio order (see this file's header note) — kept as a
   *  field, not deleted, only so an already-frozen DesignProject snapshot from BEFORE this fix
   *  (which may carry a real $20 here) keeps totaling correctly without needing a data migration;
   *  see StudioClient.tsx's live-price recompute, which adds this same field back in unchanged. */
  designFee: number;
  printLocationsCount: number;
  printingSubtotal: number;
  /** Per-unit chart cost for exactly 1 print location, at this order's quantity tier — carried
   *  into the DesignProject's pricingSnapshot so Studio can recompute the printing line live as
   *  the customer adds/removes sides, without re-importing this module's chart data. */
  chartFirstLocationCost: number;
  /** Per-unit chart cost for each additional location beyond the first, same tier. */
  chartAdditionalLocationCost: number;
  total: number;
  quantityTierLabel: string;
}

/** Full customize-flow price: blank garment x qty, plus the chart's per-location printing cost x
 *  qty for however many sides actually have artwork on them. NO automatic design/customization
 *  fee (see this file's 2026-09-24 header note — that was a real double-charge bug, not a client
 *  pricing decision). Returns null for a family with no apparel-shaped print chart (e.g. mugs —
 *  use calculateMugDecorationPrice instead; flat-print families — no approved print rule yet). */
export function calculateCustomizePrice(
  product: CatalogueProduct,
  quantity: number,
  printLocationsCount: number,
): CustomizePriceBreakdown | null {
  const blank = blankUnitPrice(product);
  const chart = chartFor(product);
  if (blank === null || chart === null || quantity < 1) return null;
  const tier = tierFor(chart, quantity);
  const locations = Math.max(1, printLocationsCount);
  const perUnitPrinting = tier.firstLocationCost + tier.additionalLocationCost * (locations - 1);

  const blankSubtotal = round2(blank * quantity);
  const printingSubtotal = round2(perUnitPrinting * quantity);
  const designFee = 0;

  return {
    blankUnitPrice: blank,
    blankSubtotal,
    designFee,
    printLocationsCount: locations,
    printingSubtotal,
    chartFirstLocationCost: tier.firstLocationCost,
    chartAdditionalLocationCost: tier.additionalLocationCost,
    total: round2(blankSubtotal + designFee + printingSubtotal),
    quantityTierLabel: tier.maxQty === null ? `${tier.minQty}+` : `${tier.minQty}-${tier.maxQty}`,
  };
}

export interface MugDecorationPriceBreakdown {
  blankUnitPrice: number;
  blankSubtotal: number;
  decorationMode: "one_side" | "wrap_around";
  decorationCostPerUnit: number;
  decorationSubtotal: number;
  total: number;
  quantityTierLabel: string;
}

/** Mug pricing (Phase 9): a decoration MODE choice, not "first print + additional locations" — a
 *  wrap-around mug is one selected option, never first-print-cost plus a second charge on top.
 *  Formula-only today (see MUG_CHART's own comment on why Studio has no UI wired to this yet). */
export function calculateMugDecorationPrice(
  product: CatalogueProduct,
  quantity: number,
  decorationMode: "one_side" | "wrap_around",
): MugDecorationPriceBreakdown | null {
  if (product.priceTiers === null || product.startingPrice === null || quantity < 1) return null;
  const blank = product.startingPrice;
  const tier = tierFor(MUG_CHART, quantity);
  const decorationCostPerUnit = decorationMode === "one_side" ? tier.oneSideCost : tier.wrapAroundCost;

  const blankSubtotal = round2(blank * quantity);
  const decorationSubtotal = round2(decorationCostPerUnit * quantity);

  return {
    blankUnitPrice: blank,
    blankSubtotal,
    decorationMode,
    decorationCostPerUnit,
    decorationSubtotal,
    total: round2(blankSubtotal + decorationSubtotal),
    quantityTierLabel: tier.maxQty === null ? `${tier.minQty}+` : `${tier.minQty}-${tier.maxQty}`,
  };
}
