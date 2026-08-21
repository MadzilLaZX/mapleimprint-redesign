// Splits a product's existing, already-correct `priceTiers` (wholesale x 1.40 markup + the
// client's print-cost chart, baked together — see catalogue-engine's pricing fix) back into its
// two components: a pure blank-garment price and the chart's per-location printing cost. This is
// deliberately NOT a second pricing pipeline — it's algebra on numbers the site already computes
// and already shows the customer, so "Buy It Blank" and Studio's line-item breakdown stay
// consistent with the shop's "From $X" price instead of drifting from it.
//
// The two charts (apparel, headwear) share identical quantity-tier boundaries but different
// dollar values (see catalogue-engine/src/pricing/rules/seed-data.ts — duplicated here since the
// frontend has no runtime dependency on that package, matching the static-JSON architecture).
// These are the client's own published printing costs, not a secret, so mirroring them here is
// safe; if the chart ever changes both copies need updating.

import type { CatalogueProduct } from "@/lib/products";

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

export const DESIGN_FEE = 20.0;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function chartFor(product: CatalogueProduct): ChartTier[] {
  const isHeadwear =
    product.categorySlug === "hats-accessories" &&
    (product.subcategorySlug === "caps" || product.subcategorySlug === "beanies-toques");
  return isHeadwear ? HEADWEAR_CHART : APPAREL_CHART;
}

function tierFor(chart: ChartTier[], quantity: number): ChartTier {
  return chart.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)) ?? chart[chart.length - 1];
}

/** The garment's retail price alone, with no decoration — constant across quantity (the client's
 *  chart has no blank-garment quantity discount, only a printing-cost one). Returns null when the
 *  product has no chart at all (bags, aprons, etc. — already `quote_required` everywhere else). */
export function blankUnitPrice(product: CatalogueProduct): number | null {
  if (product.priceTiers === null || product.startingPrice === null) return null;
  const chart = chartFor(product);
  return round2(product.startingPrice - chart[0].firstLocationCost);
}

export interface CustomizePriceBreakdown {
  blankUnitPrice: number;
  blankSubtotal: number;
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

/** Full customize-flow price: blank garment x qty, plus the one-time $20 design fee, plus the
 *  chart's per-location printing cost x qty for however many sides actually have artwork on them. */
export function calculateCustomizePrice(
  product: CatalogueProduct,
  quantity: number,
  printLocationsCount: number,
): CustomizePriceBreakdown | null {
  const blank = blankUnitPrice(product);
  if (blank === null || quantity < 1) return null;
  const chart = chartFor(product);
  const tier = tierFor(chart, quantity);
  const locations = Math.max(1, printLocationsCount);
  const perUnitPrinting = tier.firstLocationCost + tier.additionalLocationCost * (locations - 1);

  const blankSubtotal = round2(blank * quantity);
  const printingSubtotal = round2(perUnitPrinting * quantity);
  const designFee = DESIGN_FEE;

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
