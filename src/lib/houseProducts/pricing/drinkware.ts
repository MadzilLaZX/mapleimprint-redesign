// Real VistaPrint drinkware pricing, gathered live from their rendered product-grid pages
// 2026-10-06/07 (price loads client-side, so this required a real browser session, not just a
// static fetch). VistaPrint's real drinkware catalogue is heavily third-party-branded (YETI®,
// Hydro Flask®, Owala®, Stanley®, CORKCICLE®) — Maple has no supplier relationship with those
// brands, so every product here is one of VistaPrint's own GENERIC/unbranded or house-brand items,
// never a branded one. Every price is real and sourced; what's modeled (not sourced, since
// VistaPrint's grid pages only show a price RANGE, not a quantity-keyed table the way
// banners/cards/flyers were sampled) is WHICH quantity each end of that range corresponds to:
// industry-standard promo pricing has the HIGH price at the product's real stated minimum order
// quantity and the LOW price at a bulk breakpoint — assumed here at BULK_QTY_REFERENCE for every
// product, since VistaPrint didn't expose the real breakpoint. Both dollar figures are 100% real;
// only their quantity mapping is an estimate, exactly flagged via isEstimate below, same technique
// as banners.ts's bannerQuantityMultiplier.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

const BULK_QTY_REFERENCE = 250;

export type DrinkwareKind = "mug" | "tumbler" | "water-bottle" | "pint-glass";

export interface DrinkwareVariant {
  key: string;
  label: string;
  minQty: number;
  /** Real VistaPrint price per unit AT minQty (the range's high end). */
  priceAtMinQty: number;
  /** Real VistaPrint price per unit AT (or near) BULK_QTY_REFERENCE (the range's low end). */
  priceAtBulkQty: number;
}

// Real ranges, sourced per-product from VistaPrint's generic/unbranded drinkware grid.
export const DRINKWARE_VARIANTS: Record<DrinkwareKind, DrinkwareVariant[]> = {
  mug: [
    { key: "11oz", label: "11oz Ceramic Mug", minQty: 36, priceAtMinQty: 7.23, priceAtBulkQty: 4.2 }, // Traditional Ceramic Custom Mug
    { key: "12oz", label: "12oz Ceramic Mug", minQty: 36, priceAtMinQty: 2.93, priceAtBulkQty: 1.83 }, // Vancouver White Ceramic Mug
    { key: "15oz", label: "15oz Ceramic Mug, cork base", minQty: 24, priceAtMinQty: 9.89, priceAtBulkQty: 7.15 }, // Bates Ceramic Mug
    { key: "16oz", label: "16oz Ceramic Bistro Mug", minQty: 1, priceAtMinQty: 14.99, priceAtBulkQty: 5.99 }, // Bistro Ceramic Coffee Mug, no real minimum
  ],
  tumbler: [
    { key: "14oz", label: "14oz Double-Wall Tumbler", minQty: 25, priceAtMinQty: 8.35, priceAtBulkQty: 4.52 },
    { key: "18oz", label: "18oz Stainless Steel Tumbler", minQty: 50, priceAtMinQty: 12.69, priceAtBulkQty: 4.15 }, // Kasper Stainless Steel Tumbler
    { key: "20oz", label: "20oz Stainless Steel Tumbler", minQty: 1, priceAtMinQty: 28.99, priceAtBulkQty: 12.99 }, // Perfect Line SS Tumbler, no real minimum
    { key: "40oz", label: "40oz Stainless Steel Tumbler with Handle", minQty: 1, priceAtMinQty: 29.99, priceAtBulkQty: 14.99 },
  ],
  "water-bottle": [
    { key: "20oz", label: "20oz Sports Water Bottle", minQty: 100, priceAtMinQty: 2.27, priceAtBulkQty: 1.34 }, // Bike Sports Water Bottle
    { key: "22oz", label: "22oz Insulated Water Bottle, bamboo lid", minQty: 50, priceAtMinQty: 4.01, priceAtBulkQty: 2.61 },
    { key: "25oz", label: "25oz Double-Wall Water Bottle", minQty: 25, priceAtMinQty: 13.32, priceAtBulkQty: 8.4 },
    { key: "26oz", label: "26oz Stainless Steel Water Bottle", minQty: 72, priceAtMinQty: 9.59, priceAtBulkQty: 6.25 },
    { key: "27oz", label: "27oz Insulated Water Bottle", minQty: 1, priceAtMinQty: 26.99, priceAtBulkQty: 11.99 }, // Olympian Water Bottle, no real minimum
  ],
  "pint-glass": [
    { key: "16oz-pint", label: "16oz Pint Glass", minQty: 6, priceAtMinQty: 17.68, priceAtBulkQty: 2.5 },
    { key: "16oz-frosted", label: "16oz Frosted Pint Glass", minQty: 6, priceAtMinQty: 18.95, priceAtBulkQty: 3.06 },
    { key: "20oz-pilsner", label: "20oz Pilsner Glass", minQty: 1, priceAtMinQty: 28.89, priceAtBulkQty: 8.0 },
  ],
};

export const DRINKWARE_LABELS: Record<DrinkwareKind, string> = {
  mug: "Ceramic Mugs",
  tumbler: "Stainless Steel Tumblers",
  "water-bottle": "Insulated Water Bottles",
  "pint-glass": "Pint Glasses",
};

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Linear interpolation between the two real sampled points (minQty→high price,
 *  BULK_QTY_REFERENCE→low price), holding flat outside that range — same shape as
 *  banners.ts's bannerQuantityMultiplier, just for a 2-point curve instead of 8. */
function perUnitAt(variant: DrinkwareVariant, quantity: number): number {
  if (quantity <= variant.minQty) return variant.priceAtMinQty;
  if (quantity >= BULK_QTY_REFERENCE) return variant.priceAtBulkQty;
  const t = (quantity - variant.minQty) / (BULK_QTY_REFERENCE - variant.minQty);
  return variant.priceAtMinQty + (variant.priceAtBulkQty - variant.priceAtMinQty) * t;
}

export interface DrinkwareQuoteInput {
  kind: DrinkwareKind;
  variantKey: string;
  quantity: number;
}

export interface DrinkwareQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  /** True whenever quantity isn't exactly at one of the two real sampled points — the
   *  interpolated value in between is VistaPrint's real shape of curve (high at low qty, low at
   *  bulk qty) but not a sourced number at that exact quantity. */
  priceIsEstimate: boolean;
}

export function quoteDrinkware(input: DrinkwareQuoteInput): DrinkwareQuoteResult | QuoteError {
  const { kind, variantKey, quantity } = input;
  const variant = DRINKWARE_VARIANTS[kind]?.find((v) => v.key === variantKey);
  if (!variant) return { error: "Unknown product/size." };
  if (!Number.isInteger(quantity) || quantity < variant.minQty) {
    return { error: `Minimum order for this item is ${variant.minQty.toLocaleString()}.` };
  }
  const perUnit = perUnitAt(variant, quantity);
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
    priceIsEstimate: quantity !== variant.minQty && quantity !== BULK_QTY_REFERENCE,
  };
}
