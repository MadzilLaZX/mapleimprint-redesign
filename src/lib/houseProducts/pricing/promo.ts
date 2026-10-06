// Real VistaPrint promotional-product pricing, gathered live from their rendered category pages
// 2026-10-06. VistaPrint's "Popular brands" rail for this category is heavily trademarked (YETI®,
// PopSockets®, Moleskine®, Carhartt®, Nike®, etc.) — every product here is a generic/unbranded
// item instead (e.g. the generic phone-stand items used in place of PopSockets®), per the same
// no-third-party-brands rule as drinkware.ts.
// Same modeling note as drinkware.ts: VistaPrint's category grids show a real price RANGE and a
// real minimum order quantity, not a quantity-keyed table — the high end is assumed to sit at the
// real minQty and the low end at BULK_QTY_REFERENCE, interpolated between. Both dollar figures are
// real and sourced; only which quantity the low end corresponds to is an assumption.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

const BULK_QTY_REFERENCE = 250;

export type PromoKind = "tote-bag" | "pen" | "notebook" | "keychain" | "magnet" | "phone-stand";

export interface PromoVariant {
  key: string;
  label: string;
  minQty: number;
  priceAtMinQty: number;
  priceAtBulkQty: number;
}

export const PROMO_VARIANTS: Record<PromoKind, PromoVariant[]> = {
  "tote-bag": [
    { key: "non-woven", label: "Non-Woven Polypropylene Tote", minQty: 50, priceAtMinQty: 2.17, priceAtBulkQty: 1.05 },
  ],
  pen: [
    { key: "wrap-ballpoint", label: "Design Wrap Ballpoint Pen", minQty: 50, priceAtMinQty: 2.96, priceAtBulkQty: 0.76 },
    { key: "metal-engraved", label: "Metal Engraved Ballpoint Pen", minQty: 50, priceAtMinQty: 4.24, priceAtBulkQty: 0.81 },
    { key: "metallic-aluminium", label: "Metallic Aluminium Ballpoint Pen", minQty: 50, priceAtMinQty: 2.26, priceAtBulkQty: 0.95 },
  ],
  notebook: [
    { key: "a5-softcover", label: "Softcover Lined A5 Notebook", minQty: 25, priceAtMinQty: 3.53, priceAtBulkQty: 1.81 },
    { key: "classic-journal", label: "Softy Classic Journal", minQty: 50, priceAtMinQty: 3.22, priceAtBulkQty: 1.65 },
    { key: "spiral-4x6", label: "Spiral Bound Lined Notebook, 4\" x 6\"", minQty: 50, priceAtMinQty: 2.67, priceAtBulkQty: 1.6 },
  ],
  keychain: [
    { key: "carabiner", label: "Engraved Carabiner Keychain", minQty: 50, priceAtMinQty: 1.8, priceAtBulkQty: 0.99 },
  ],
  magnet: [
    { key: "fridge-circle", label: "Fridge Magnet, Circle", minQty: 10, priceAtMinQty: 1.8, priceAtBulkQty: 0.9 }, // bracketed from the $17.99-for-10 ($1.80/unit) confirmed figure; low end estimated at half, flagged below
    { key: "power-clip", label: "Jumbo Power Clip Magnet", minQty: 18, priceAtMinQty: 2.49, priceAtBulkQty: 1.29 },
  ],
  "phone-stand": [
    { key: "foldable", label: "Foldable Phone & Tablet Stand", minQty: 125, priceAtMinQty: 1.86, priceAtBulkQty: 1.0 },
    { key: "slim-adjustable", label: "Slim Adjustable Phone Stand", minQty: 25, priceAtMinQty: 1.51, priceAtBulkQty: 0.91 },
  ],
};

/** Only the fridge-magnet low end wasn't independently confirmed (the research only had the
 *  qty-10 promo price) — everything else above is a real sourced range. Surfaced per-variant so
 *  the configurator can show "estimated" rather than presenting it as a sourced figure. */
const UNCONFIRMED_BULK_PRICE: Partial<Record<string, true>> = { "fridge-circle": true };

export const PROMO_LABELS: Record<PromoKind, string> = {
  "tote-bag": "Tote Bags",
  pen: "Pens",
  notebook: "Notebooks & Journals",
  keychain: "Keychains",
  magnet: "Magnets",
  "phone-stand": "Phone Stands",
};

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function perUnitAt(variant: PromoVariant, quantity: number): number {
  if (quantity <= variant.minQty) return variant.priceAtMinQty;
  if (quantity >= BULK_QTY_REFERENCE) return variant.priceAtBulkQty;
  const t = (quantity - variant.minQty) / (BULK_QTY_REFERENCE - variant.minQty);
  return variant.priceAtMinQty + (variant.priceAtBulkQty - variant.priceAtMinQty) * t;
}

export interface PromoQuoteInput {
  kind: PromoKind;
  variantKey: string;
  quantity: number;
}

export interface PromoQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  priceIsEstimate: boolean;
}

export function quotePromo(input: PromoQuoteInput): PromoQuoteResult | QuoteError {
  const { kind, variantKey, quantity } = input;
  const variant = PROMO_VARIANTS[kind]?.find((v) => v.key === variantKey);
  if (!variant) return { error: "Unknown product." };
  if (!Number.isInteger(quantity) || quantity < variant.minQty) {
    return { error: `Minimum order for this item is ${variant.minQty.toLocaleString()}.` };
  }
  const perUnit = perUnitAt(variant, quantity);
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
    priceIsEstimate: (quantity !== variant.minQty && quantity !== BULK_QTY_REFERENCE) || !!UNCONFIRMED_BULK_PRICE[variant.key],
  };
}
