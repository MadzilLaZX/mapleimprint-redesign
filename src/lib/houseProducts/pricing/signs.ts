// Real VistaPrint sign pricing, gathered live from their rendered configurators 2026-10-10. Same
// "real anchor + flagged estimate" technique as stickers.ts/banners.ts — these product pages are
// JS-rendered selector grids (not a static price table), so each kind has one or two confirmed
// anchor points rather than every cell independently verified. Every non-anchor cell is scaled by
// print area from the nearest real anchor (same area-proportional fallback banners.ts's
// addonsFor() and stickers.ts's scaleFromRatioSource() already use) and flagged isEstimate: true.
import { applyHouseMargin } from "./margin";
import type { QuoteError } from "./types";

export type SignKind = "yard" | "rigid" | "window-cling";

export interface SignSize {
  key: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

function sz(widthIn: number, heightIn: number): SignSize {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString());
  return { key: `${widthIn}x${heightIn}`, widthIn, heightIn, label: `${fmt(widthIn)}" x ${fmt(heightIn)}"` };
}

// Real sizes VistaPrint lists for each product (confirmed from the live catalogue — same list
// already documented in houseProducts/catalogue.ts's quoteOnlyInfo before this module existed).
export const SIGN_SIZES: Record<SignKind, SignSize[]> = {
  yard: [sz(9, 12), sz(12, 18), sz(18, 24), sz(18, 30), sz(24, 24), sz(24, 36), sz(48, 72), sz(48, 96)],
  rigid: [sz(11, 17), sz(16, 20), sz(18, 24), sz(22, 28), sz(24, 36), sz(24, 48)],
  "window-cling": [sz(6, 9), sz(9, 12), sz(12, 18), sz(12, 24), sz(16, 20), sz(18, 24), sz(24, 36)],
};

export type SignMaterial = "coroplast" | "foam-board" | "pvc-free-foam" | "rigid-pvc" | "removable-vinyl" | "repositionable-cling";

export const SIGN_MATERIALS: Record<SignKind, { value: SignMaterial; label: string }[]> = {
  yard: [{ value: "coroplast", label: "4mm Corrugated Plastic (Coroplast)" }],
  rigid: [
    { value: "foam-board", label: "5mm PVC Foam Board" },
    { value: "pvc-free-foam", label: "3mm PVC-Free Foam Board" },
    { value: "rigid-pvc", label: "3mm Rigid PVC Plastic" },
  ],
  "window-cling": [
    { value: "removable-vinyl", label: "Removable Window Decal" },
    { value: "repositionable-cling", label: "Repositionable Window Cling" },
  ],
};

// REAL anchor: 18"x24" coroplast yard sign, single-sided, confirmed live on VistaPrint's yard
// signs configurator at qty 1 — $33.99.
const YARD_ANCHOR = { sizeKey: "18x24", price: 33.99 };

// REAL anchors: VistaPrint foam board signs confirmed at two sizes — 18"x24" $28.99, 24"x36"
// $52.99 — giving a genuine (not borrowed) area-to-price ratio for this product, unlike yard
// signs/window clings below which only have one confirmed point each.
const RIGID_ANCHORS: Record<string, number> = { "18x24": 28.99, "24x36": 52.99 };

// REAL anchor: 5"x5" custom-size clear window decal, inside-glass, confirmed live on VistaPrint's
// window decals configurator at qty 1 — $11.90. Window decals price continuously by area on
// VistaPrint's own site (a width/height slider, not a fixed size ladder) — area-proportional
// scaling here isn't a fallback approximation the way it is for yard/rigid signs, it's the same
// pricing MODEL VistaPrint itself uses for this product.
const WINDOW_CLING_ANCHOR = { widthIn: 5, heightIn: 5, price: 11.9 };

const MATERIAL_MULTIPLIER: Partial<Record<SignMaterial, number>> = {
  "pvc-free-foam": 1.08, // PVC-free runs a modest premium on comparable Maple/VistaPrint products (see banners.ts's pvc-free-indoor delta)
  "rigid-pvc": 1.35, // rigid PVC plastic is a heavier-duty material than foam board — estimate, not sourced per-size
  "repositionable-cling": 0.95, // clings use thinner film than decals — estimate
};

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function areaOf(s: SignSize): number {
  return s.widthIn * s.heightIn;
}

function basePriceFor(kind: SignKind, sizeKey: string): { price: number; isEstimate: boolean } | undefined {
  const sizes = SIGN_SIZES[kind];
  const target = sizes.find((s) => s.key === sizeKey);
  if (!target) return undefined;

  if (kind === "yard") {
    if (sizeKey === YARD_ANCHOR.sizeKey) return { price: YARD_ANCHOR.price, isEstimate: false };
    const anchor = sizes.find((s) => s.key === YARD_ANCHOR.sizeKey)!;
    return { price: YARD_ANCHOR.price * (areaOf(target) / areaOf(anchor)), isEstimate: true };
  }

  if (kind === "rigid") {
    if (RIGID_ANCHORS[sizeKey] !== undefined) return { price: RIGID_ANCHORS[sizeKey], isEstimate: false };
    // Scale from the nearer of the two real anchors by area.
    const anchorKeys = Object.keys(RIGID_ANCHORS);
    let nearestKey = anchorKeys[0];
    let nearestDiff = Infinity;
    for (const key of anchorKeys) {
      const s = sizes.find((x) => x.key === key)!;
      const diff = Math.abs(areaOf(s) - areaOf(target));
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestKey = key;
      }
    }
    const nearestSize = sizes.find((x) => x.key === nearestKey)!;
    return { price: RIGID_ANCHORS[nearestKey] * (areaOf(target) / areaOf(nearestSize)), isEstimate: true };
  }

  // window-cling: continuous area-based pricing from the one real anchor.
  const anchorArea = WINDOW_CLING_ANCHOR.widthIn * WINDOW_CLING_ANCHOR.heightIn;
  const isAnchor = target.widthIn === WINDOW_CLING_ANCHOR.widthIn && target.heightIn === WINDOW_CLING_ANCHOR.heightIn;
  return { price: WINDOW_CLING_ANCHOR.price * (areaOf(target) / anchorArea), isEstimate: !isAnchor };
}

// No real bulk-quantity curve was found for any of these three products (same situation
// stickers.ts documents) — pricing is linear per unit above the single confirmed qty-1 anchor,
// the safe (never-under-prices-Maple's-margin) direction rather than fabricating a discount shape.
const MIN_QTY: Record<SignKind, number> = { yard: 1, rigid: 1, "window-cling": 1 };

export interface SignQuoteInput {
  kind: SignKind;
  sizeKey: string;
  material: SignMaterial;
  quantity: number;
}

export interface SignQuoteResult {
  unitPriceCents: number;
  totalCents: number;
  isEstimate: boolean;
}

export function quoteSign(input: SignQuoteInput): SignQuoteResult | QuoteError {
  const { kind, sizeKey, material, quantity } = input;
  const minQty = MIN_QTY[kind];
  if (!Number.isInteger(quantity) || quantity < minQty) return { error: `Minimum order is ${minQty}.` };
  if (!SIGN_MATERIALS[kind].some((m) => m.value === material)) return { error: "This material isn't available for this sign type." };
  const base = basePriceFor(kind, sizeKey);
  if (!base) return { error: "Unknown size." };
  const materialMultiplier = MATERIAL_MULTIPLIER[material] ?? 1;
  const perUnit = base.price * materialMultiplier;
  return {
    unitPriceCents: toCents(applyHouseMargin(perUnit)),
    totalCents: toCents(applyHouseMargin(perUnit * quantity)),
    isEstimate: base.isEstimate || materialMultiplier !== 1,
  };
}

export const SIGN_LABELS: Record<SignKind, string> = {
  yard: "Yard Signs",
  rigid: "Rigid & Foam Board Signs",
  "window-cling": "Window Clings & Decals",
};
