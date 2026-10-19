// Tiered MARKUP over VistaPrint's real published retail price (the `basePrice` every caller
// passes in), applied transparently at quote time — never baked into the lookup tables in
// banners.ts/businessCards.ts/flyers.ts/etc., so the base data there always stays auditable
// against VistaPrint's own listed price. Matches the existing taxProvider.ts/shippingProvider.ts
// "swappable, loudly-commented provider" convention: change the table below, no caller changes.
//
// --- 2026-10-19 pricing policy: tiered MARKUP by cost bracket (replaces the old flat 30%) ---
// This is MARKUP, not margin — price = cost * (1 + rate), explicitly NOT cost / (1 - rate). Do
// not "fix" this to margin math by analogy with catalogue-engine's own 40% rule (see that file's
// 2026-09-24 correction note) — that correction was for a DIFFERENT, unrelated rule that this
// business explicitly specified as a margin target; this one was explicitly specified as markup.
// Bracket is selected by `basePrice` itself (the cost/reference price being marked up), with each
// tier's upper bound exclusive and the tier's own lower bound inclusive, so every real number
// lands in exactly one bracket with no gap or overlap:
//   basePrice <  7            -> 30%
//    7 <= basePrice <  15     -> 25%
//   15 <= basePrice <  25     -> 20%
//   25 <= basePrice <  35     -> 15%
//   basePrice >= 35           -> 10%
// (The business's own brief also listed "above $50: 10%" as a separate line from "above $35:
// 10%" — same rate, confirmed redundant, not a sixth bracket.)
const MARKUP_TIERS: { belowOrAt: number | null; rate: number }[] = [
  { belowOrAt: 7, rate: 0.3 },
  { belowOrAt: 15, rate: 0.25 },
  { belowOrAt: 25, rate: 0.2 },
  { belowOrAt: 35, rate: 0.15 },
  { belowOrAt: null, rate: 0.1 }, // null = no upper bound, catches basePrice >= 35
];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The markup rate that applies to a given base (cost/reference) price — exported separately from
 *  applyHouseMargin so callers that need to show/log the rate itself (not just the marked-up
 *  price) don't have to reverse-engineer it from the output. */
export function markupRateFor(basePrice: number): number {
  for (const tier of MARKUP_TIERS) {
    if (tier.belowOrAt === null || basePrice < tier.belowOrAt) return tier.rate;
  }
  // Unreachable (the last tier's belowOrAt is always null), but keeps this total for TypeScript.
  return MARKUP_TIERS[MARKUP_TIERS.length - 1].rate;
}

export function applyHouseMargin(basePrice: number): number {
  return round2(basePrice * (1 + markupRateFor(basePrice)));
}
