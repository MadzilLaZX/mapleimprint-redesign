// Real VistaPrint vinyl-banner pricing, gathered live from their configurator 2026-09-25 (see
// project notes for the source pull). Every dollar figure in this file is VistaPrint's own real
// published price — the 30% Maple margin (margin.ts) is applied at quote time only, in
// quoteBanner() below, never baked into these tables, so this data stays auditable against
// VistaPrint's actual listed price if it needs to be re-checked later.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type BannerMaterial =
  | "indoor-13oz"
  | "pvc-free-indoor"
  | "indoor-light-blockout"
  | "outdoor-15oz"
  | "heavy-duty-outdoor-blockout";

export const BANNER_MATERIALS: { value: BannerMaterial; label: string }[] = [
  { value: "indoor-13oz", label: "Indoor (13oz)" },
  { value: "pvc-free-indoor", label: "PVC-Free Indoor (9.1oz)" },
  { value: "indoor-light-blockout", label: "Indoor Light Blockout (12oz)" },
  { value: "outdoor-15oz", label: "Outdoor (15oz)" },
  { value: "heavy-duty-outdoor-blockout", label: "Heavy Duty Outdoor Blockout (18oz)" },
];

export interface BannerSize {
  key: string;
  widthFt: number;
  heightFt: number;
  label: string;
}

function size(widthFt: number, heightFt: number): BannerSize {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString());
  return { key: `${widthFt}x${heightFt}`, widthFt, heightFt, label: `${fmt(widthFt)}' x ${fmt(heightFt)}'` };
}

// The 28 standard sizes, in the order VistaPrint lists them.
export const BANNER_SIZES: BannerSize[] = [
  size(1, 2), size(1.7, 3), size(2.5, 4), size(2.5, 6), size(2.5, 8), size(2.5, 10), size(2.5, 12),
  size(4, 4), size(4, 6), size(4, 8), size(4, 10), size(4, 12), size(4, 16), size(4, 20), size(4, 25), size(4, 30),
  size(6, 10), size(6, 12), size(6, 15), size(6, 20), size(6, 25), size(6, 30),
  size(8, 10), size(8, 12), size(8, 15), size(8, 20), size(8, 25), size(8, 30),
];

// Base price at quantity 1, single-sided, no add-ons. Absent cell = VistaPrint doesn't offer that
// combination (PVC-Free Indoor caps out at 12' long — never offered on the 15'-30' sizes).
export const BANNER_BASE_PRICES: Record<string, Partial<Record<BannerMaterial, number>>> = {
  "1x2": { "indoor-13oz": 6.99, "pvc-free-indoor": 7.99, "indoor-light-blockout": 7.99, "outdoor-15oz": 8.99, "heavy-duty-outdoor-blockout": 11.99 },
  "1.7x3": { "indoor-13oz": 14.99, "pvc-free-indoor": 16.99, "indoor-light-blockout": 17.99, "outdoor-15oz": 20.99, "heavy-duty-outdoor-blockout": 25.99 },
  "2.5x4": { "indoor-13oz": 24.99, "pvc-free-indoor": 27.99, "indoor-light-blockout": 29.99, "outdoor-15oz": 33.99, "heavy-duty-outdoor-blockout": 40.99 },
  "2.5x6": { "indoor-13oz": 29.99, "pvc-free-indoor": 32.99, "indoor-light-blockout": 36.99, "outdoor-15oz": 41.99, "heavy-duty-outdoor-blockout": 51.99 },
  "2.5x8": { "indoor-13oz": 44.99, "pvc-free-indoor": 48.99, "indoor-light-blockout": 54.99, "outdoor-15oz": 61.99, "heavy-duty-outdoor-blockout": 75.99 },
  "2.5x10": { "indoor-13oz": 54.99, "pvc-free-indoor": 59.99, "indoor-light-blockout": 67.99, "outdoor-15oz": 76.99, "heavy-duty-outdoor-blockout": 95.99 },
  "2.5x12": { "indoor-13oz": 64.99, "pvc-free-indoor": 68.99, "indoor-light-blockout": 77.99, "outdoor-15oz": 87.99, "heavy-duty-outdoor-blockout": 107.99 },
  "4x4": { "indoor-13oz": 34.99, "pvc-free-indoor": 38.99, "indoor-light-blockout": 43.99, "outdoor-15oz": 49.99, "heavy-duty-outdoor-blockout": 62.99 },
  "4x6": { "indoor-13oz": 49.99, "pvc-free-indoor": 55.99, "indoor-light-blockout": 60.99, "outdoor-15oz": 68.99, "heavy-duty-outdoor-blockout": 85.99 },
  "4x8": { "indoor-13oz": 69.99, "pvc-free-indoor": 75.99, "indoor-light-blockout": 84.99, "outdoor-15oz": 95.99, "heavy-duty-outdoor-blockout": 118.99 },
  "4x10": { "indoor-13oz": 89.99, "pvc-free-indoor": 96.99, "indoor-light-blockout": 108.99, "outdoor-15oz": 122.99, "heavy-duty-outdoor-blockout": 149.99 },
  "4x12": { "indoor-13oz": 99.99, "pvc-free-indoor": 109.99, "indoor-light-blockout": 121.99, "outdoor-15oz": 138.99, "heavy-duty-outdoor-blockout": 170.99 },
  "4x16": { "indoor-13oz": 129.99, "indoor-light-blockout": 158.99, "outdoor-15oz": 180.99, "heavy-duty-outdoor-blockout": 225.99 },
  "4x20": { "indoor-13oz": 149.99, "indoor-light-blockout": 186.99, "outdoor-15oz": 214.99, "heavy-duty-outdoor-blockout": 269.99 },
  "4x25": { "indoor-13oz": 179.99, "indoor-light-blockout": 223.99, "outdoor-15oz": 256.99, "heavy-duty-outdoor-blockout": 321.99 },
  "4x30": { "indoor-13oz": 199.99, "indoor-light-blockout": 249.99, "outdoor-15oz": 286.99, "heavy-duty-outdoor-blockout": 361.99 },
  "6x10": { "indoor-13oz": 119.99, "pvc-free-indoor": 129.99, "indoor-light-blockout": 147.99, "outdoor-15oz": 167.99, "heavy-duty-outdoor-blockout": 209.99 },
  "6x12": { "indoor-13oz": 144.99, "pvc-free-indoor": 158.99, "indoor-light-blockout": 177.99, "outdoor-15oz": 201.99, "heavy-duty-outdoor-blockout": 250.99 },
  "6x15": { "indoor-13oz": 169.99, "indoor-light-blockout": 209.99, "outdoor-15oz": 239.99, "heavy-duty-outdoor-blockout": 299.99 },
  "6x20": { "indoor-13oz": 199.99, "indoor-light-blockout": 249.99, "outdoor-15oz": 286.99, "heavy-duty-outdoor-blockout": 361.99 },
  "6x25": { "indoor-13oz": 224.99, "indoor-light-blockout": 284.99, "outdoor-15oz": 329.99, "heavy-duty-outdoor-blockout": 418.99 },
  "6x30": { "indoor-13oz": 299.99, "indoor-light-blockout": 371.99, "outdoor-15oz": 425.99, "heavy-duty-outdoor-blockout": 532.99 },
  "8x10": { "indoor-13oz": 149.99, "pvc-free-indoor": 164.99, "indoor-light-blockout": 186.99, "outdoor-15oz": 214.99, "heavy-duty-outdoor-blockout": 269.99 },
  "8x12": { "indoor-13oz": 174.99, "pvc-free-indoor": 194.99, "indoor-light-blockout": 217.99, "outdoor-15oz": 249.99, "heavy-duty-outdoor-blockout": 313.99 },
  "8x15": { "indoor-13oz": 199.99, "indoor-light-blockout": 249.99, "outdoor-15oz": 286.99, "heavy-duty-outdoor-blockout": 361.99 },
  "8x20": { "indoor-13oz": 249.99, "indoor-light-blockout": 315.99, "outdoor-15oz": 364.99, "heavy-duty-outdoor-blockout": 463.99 },
  "8x25": { "indoor-13oz": 349.99, "indoor-light-blockout": 433.99, "outdoor-15oz": 496.99, "heavy-duty-outdoor-blockout": 621.99 },
  "8x30": { "indoor-13oz": 399.99, "indoor-light-blockout": 499.99, "outdoor-15oz": 574.99, "heavy-duty-outdoor-blockout": 723.99 },
};

interface AddonRow {
  grommets: number;
  reinforcedEdges: number;
  windFlaps: number | null;
  doubleSided: Partial<Record<BannerMaterial, number>>; // total price, not a surcharge
}

// Flat per-size surcharges, sampled at 7 representative sizes spanning the range. Only sampled
// sizes have real add-on pricing; addonsFor() below falls back to the nearest sampled size by
// area for anything else, clearly flagged as an estimate (see addonsFor's comment).
const SAMPLED_ADDON_SIZES: Record<string, AddonRow> = {
  "2.5x4": { grommets: 4.0, reinforcedEdges: 6.0, windFlaps: 4.0, doubleSided: { "indoor-13oz": 48.99, "heavy-duty-outdoor-blockout": 64.99 } },
  "4x8": { grommets: 11.0, reinforcedEdges: 19.0, windFlaps: 11.0, doubleSided: { "indoor-13oz": 140.99, "heavy-duty-outdoor-blockout": 189.99 } },
  "4x12": { grommets: 17.0, reinforcedEdges: 28.0, windFlaps: 17.0, doubleSided: { "indoor-13oz": 203.99, "heavy-duty-outdoor-blockout": 274.99 } },
  "6x15": { grommets: 30.0, reinforcedEdges: 50.0, windFlaps: null, doubleSided: { "indoor-13oz": 359.99, "heavy-duty-outdoor-blockout": 489.99 } },
  "6x20": { grommets: 38.0, reinforcedEdges: 62.0, windFlaps: null, doubleSided: { "indoor-13oz": 436.99, "heavy-duty-outdoor-blockout": 598.99 } },
  "8x20": { grommets: 50.0, reinforcedEdges: 82.0, windFlaps: null, doubleSided: { "indoor-13oz": 562.99, "heavy-duty-outdoor-blockout": 776.99 } },
  "8x30": { grommets: 75.0, reinforcedEdges: 125.0, windFlaps: null, doubleSided: { "indoor-13oz": 873.99, "heavy-duty-outdoor-blockout": 1197.99 } },
};

/** Add-ons were only sampled at 7 of the 28 sizes. For an unsampled size, scale the nearest
 *  sampled size's flat add-on cost by the ratio of print area (grommet/edge cost is roughly
 *  proportional to perimeter/area for a banner, so this is a reasonable estimate) — always an
 *  approximation, never presented as an exact VistaPrint number the way the base price table is. */
function addonsFor(sizeKey: string): { row: AddonRow; isEstimate: boolean } {
  if (SAMPLED_ADDON_SIZES[sizeKey]) return { row: SAMPLED_ADDON_SIZES[sizeKey], isEstimate: false };
  const target = BANNER_SIZES.find((s) => s.key === sizeKey);
  if (!target) return { row: SAMPLED_ADDON_SIZES["4x8"], isEstimate: true };
  const targetArea = target.widthFt * target.heightFt;
  let nearest = "4x8";
  let nearestDiff = Infinity;
  for (const key of Object.keys(SAMPLED_ADDON_SIZES)) {
    const s = BANNER_SIZES.find((s) => s.key === key)!;
    const diff = Math.abs(s.widthFt * s.heightFt - targetArea);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = key;
    }
  }
  const nearestSize = BANNER_SIZES.find((s) => s.key === nearest)!;
  const scale = targetArea / (nearestSize.widthFt * nearestSize.heightFt);
  const base = SAMPLED_ADDON_SIZES[nearest];
  return {
    row: {
      grommets: Math.round(base.grommets * scale * 100) / 100,
      reinforcedEdges: Math.round(base.reinforcedEdges * scale * 100) / 100,
      windFlaps: base.windFlaps === null ? null : Math.round(base.windFlaps * scale * 100) / 100,
      doubleSided: Object.fromEntries(
        Object.entries(base.doubleSided).map(([material, price]) => [material, Math.round(price * scale * 100) / 100]),
      ),
    },
    isEstimate: true,
  };
}

export function grommetsAvailable(material: BannerMaterial): boolean {
  return material !== "pvc-free-indoor";
}
export function reinforcedEdgesAvailable(material: BannerMaterial): boolean {
  return material !== "pvc-free-indoor";
}
export function doubleSidedAvailable(material: BannerMaterial): boolean {
  return material === "indoor-13oz" || material === "heavy-duty-outdoor-blockout";
}
/** Wind flaps: Outdoor/Heavy-Duty-Blockout only, and only on banners 4' tall or under. */
export function windFlapsEligible(material: BannerMaterial, heightFt: number): boolean {
  return (material === "outdoor-15oz" || material === "heavy-duty-outdoor-blockout") && heightFt <= 4;
}

// Quantity discount: real data exists for only 2 of 28 size/material combos (both Outdoor,
// single-sided, no add-ons), sampled at qty 1/2/5/10/20/25/50/100. Both curves show a very similar
// shape, so they're averaged into one canonical curve here and applied uniformly to every size and
// material. This IS an approximation — flagged loudly wherever it's used — not a real per-size
// VistaPrint number the way BANNER_BASE_PRICES is.
const QTY_DISCOUNT_CURVE: { qty: number; multiplier: number }[] = [
  { qty: 1, multiplier: 1 },
  { qty: 2, multiplier: 0.9474 },
  { qty: 5, multiplier: 0.9276 },
  { qty: 10, multiplier: 0.9074 },
  { qty: 20, multiplier: 0.8999 },
  { qty: 25, multiplier: 0.8967 },
  { qty: 50, multiplier: 0.8782 },
  { qty: 100, multiplier: 0.8598 },
];

/** Interpolated approximation, not a real per-quantity VistaPrint figure beyond the 8 sampled
 *  points — see QTY_DISCOUNT_CURVE's comment. Holds flat beyond qty 100 rather than continuing to
 *  extrapolate a discount that was never actually observed. */
export function bannerQuantityMultiplier(qty: number): number {
  if (qty <= 1) return 1;
  const curve = QTY_DISCOUNT_CURVE;
  if (qty >= curve[curve.length - 1].qty) return curve[curve.length - 1].multiplier;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (qty >= a.qty && qty <= b.qty) {
      const t = (qty - a.qty) / (b.qty - a.qty);
      return a.multiplier + (b.multiplier - a.multiplier) * t;
    }
  }
  return 1;
}

export interface BannerQuoteInput {
  sizeKey: string;
  material: BannerMaterial;
  quantity: number;
  grommets?: boolean;
  reinforcedEdges?: boolean;
  windFlaps?: boolean;
  doubleSided?: boolean;
}

export interface BannerQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  lineItems: { label: string; cents: number }[];
  quantityDiscountIsEstimate: boolean;
  addonsAreEstimate: boolean;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function quoteBanner(input: BannerQuoteInput): BannerQuoteResult | QuoteError {
  const { sizeKey, material, quantity } = input;
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Invalid quantity." };
  const sizeDef = BANNER_SIZES.find((s) => s.key === sizeKey);
  if (!sizeDef) return { error: "Unknown banner size." };
  const basePrice = BANNER_BASE_PRICES[sizeKey]?.[material];
  if (basePrice === undefined) return { error: "This material isn't available at this size." };

  const lineItems: { label: string; cents: number }[] = [];
  let unitPrice = basePrice;
  lineItems.push({ label: `${sizeDef.label} banner (${material})`, cents: toCents(basePrice) });

  const { row: addons, isEstimate: addonsAreEstimate } = addonsFor(sizeKey);

  if (input.doubleSided) {
    if (!doubleSidedAvailable(material)) return { error: "Double-sided isn't available in this material." };
    const doubleSidedTotal = addons.doubleSided[material];
    if (doubleSidedTotal === undefined) return { error: "Double-sided pricing isn't available for this combination." };
    unitPrice = doubleSidedTotal;
    lineItems[0] = { label: `${sizeDef.label} banner, double-sided (${material})`, cents: toCents(doubleSidedTotal) };
  } else {
    if (input.grommets) {
      if (!grommetsAvailable(material)) return { error: "Grommets aren't available in this material." };
      unitPrice += addons.grommets;
      lineItems.push({ label: "Grommets", cents: toCents(addons.grommets) });
    }
    if (input.reinforcedEdges) {
      if (!reinforcedEdgesAvailable(material)) return { error: "Reinforced edges aren't available in this material." };
      unitPrice += addons.reinforcedEdges;
      lineItems.push({ label: "Reinforced edges", cents: toCents(addons.reinforcedEdges) });
    }
    if (input.windFlaps) {
      if (!windFlapsEligible(material, sizeDef.heightFt) || addons.windFlaps === null) {
        return { error: "Wind flaps aren't available for this size/material." };
      }
      unitPrice += addons.windFlaps;
      lineItems.push({ label: "Wind flaps", cents: toCents(addons.windFlaps) });
    }
  }

  const qtyMultiplier = bannerQuantityMultiplier(quantity);
  const perUnitAfterDiscount = unitPrice * qtyMultiplier;
  const subtotal = perUnitAfterDiscount * quantity;

  return {
    unitPriceCents: toCents(applyHouseMargin(perUnitAfterDiscount)),
    totalCents: toCents(applyHouseMargin(subtotal)),
    lineItems: lineItems.map((li) => ({ ...li, cents: toCents(applyHouseMargin(li.cents / 100)) })),
    quantityDiscountIsEstimate: quantity > 1,
    addonsAreEstimate,
  };
}
