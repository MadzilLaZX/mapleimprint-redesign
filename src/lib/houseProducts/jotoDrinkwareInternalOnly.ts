// INTERNAL-ONLY supplier reference data for jotoDrinkwareCatalogDraft.ts — Joto Imaging Supplies
// Canada's own SKU and exact product title for each draft, for reordering and audit. Same
// separation rule as jotoBlanksInternalOnly.ts / engravingInternalOnly.ts: DO NOT import this file
// from jotoDrinkwareCatalogDraft.ts, catalogue.ts, or any customer-facing module.
//
// Source: owner's screenshots of each Joto product page, 2026-10-21, logged in as the Mapleimprint
// dealer account. Product URLs were truncated in the screenshots, so they aren't recorded here
// rather than being guessed.

export interface JotoDrinkwareSupplierRecord {
  /** Matches the slug in jotoDrinkwareCatalogDraft.ts */
  slug: string;
  jotoSku: string;
  jotoTitle: string;
}

export const JOTO_DRINKWARE_SUPPLIER_INTERNAL: JotoDrinkwareSupplierRecord[] = [
  { slug: "sublimation-mug-11oz-white-case-36", jotoSku: "B-MUG-PC-11-EGC", jotoTitle: "Pearl Coating™ 11oz Sublimation White Mug - Case of 36" },
  { slug: "sublimation-mug-15oz-white-case-36", jotoSku: "B-MUG-PC-15-EGC", jotoTitle: "Pearl Coating™ 15oz Sublimation White Mug - Case of 36" },
  { slug: "sublimation-mug-11oz-inner-colour-case-36", jotoSku: "B-MUG-11-BK-EGC", jotoTitle: "Pearl Coating™ 11oz Inner Colored Sublimation Mug - Case of 36" },
  { slug: "sublimation-mug-15oz-inner-colour-case-36", jotoSku: "B-MUG-15-BK-EGC", jotoTitle: "Pearl Coating™ 15oz Inner Colored Sublimation Mug - Case of 36" },
  { slug: "sublimation-mug-15oz-inner-colour-case-6", jotoSku: "CE-MUG-15-BK / CE-MUG-15-RD", jotoTitle: "Pearl Coating™ 15oz Inner Colored Sublimation Mug - Case of 6" },
  // Title says "Case of 48"; the tiers on the same page say 24 mugs per case. Recorded as 24.
  { slug: "sublimation-colour-changing-mug-11oz-case", jotoSku: "B-MUG-CC11-BK", jotoTitle: "Pearl Coating™ 11oz Sublimation Color Changing Mug - Case of 48" },
  { slug: "sublimation-black-mug-white-patch-case-36", jotoSku: "B-MUG-FC11-BLWP-EGC (11oz) / B-MUG-FC15-BLWP-EGC (15oz)", jotoTitle: "Pearl Coating™ Sublimation Black Mug with White Patch - Case of 36" },
  { slug: "sublimation-marble-mug-11oz-case-36", jotoSku: "B-MUG-026-11-PK", jotoTitle: "Pearl Coating™ 11oz Sublimation Ceramic Marble Mug - Case of 36" },
  { slug: "sublimation-bone-china-mug-gold-rim-pack-6", jotoSku: "B-MUG-PC-10-GR", jotoTitle: "Pearl Coating™ Sublimation 10oz Bone China White Mug with Gold Rim and Handle - Pack of 6" },
  { slug: "sublimation-latte-mug-12oz-case-36", jotoSku: "B-MUG-LT-12-EGC", jotoTitle: "Pearl Coating™ 12oz Sublimation Latte White Mug - Case of 36" },
  { slug: "sublimation-latte-mug-17oz-case-24", jotoSku: "B-MUG-LT-17-EGC", jotoTitle: "Pearl Coating™ 17oz Sublimation Latte White Mug - Case of 24" },
  { slug: "sublimation-camp-mug-13oz-beige-ceramic-case-24", jotoSku: "B-MUG-EN-13-BG-EGC", jotoTitle: "Pearl Coating™ 13oz Sublimation Beige Ceramic Camp Enamel Mug - Case of 24" },
  // SKU ends in "-10" although the title says 12oz — recorded as shown.
  { slug: "sublimation-enamel-camp-cup-12oz-pack-12", jotoSku: "B-MUG-EN-10", jotoTitle: "Pearl Coating™ 12oz Sublimation Camp Enamel Cup - Pack of 12" },
  { slug: "sublimation-enamel-camp-cup-17oz-flat-bottom-pack-6", jotoSku: "B-MUG-038-17-WH", jotoTitle: "Pearl Coating™ 17oz/500ml Sublimation Camp Enamel Cup with Flat Bottom - Pack of 6" },
  { slug: "sublimation-stainless-coffee-cup-13oz-lid-pack-5", jotoSku: "B-MUG-10-S30003-WH", jotoTitle: "Pearl Coating™ 13oz/400ml Sublimation Stainless Steel Coffee Cup with Clear Flat Lid & Handle - Pack of 5" },
  { slug: "sublimation-travel-mug-14oz-stainless-pack-6", jotoSku: "B-MUG-SS-WH", jotoTitle: "Pearl Coating™ 14oz White Sublimation Stainless Steel Travel Mug - Pack of 6" },
  { slug: "sublimation-travel-mug-17oz", jotoSku: "B-MUG-TM-WH-17", jotoTitle: "Pearl Coating™ 17oz Sublimation Travel Mug" },
  { slug: "engraving-stainless-mug-10oz-pack-5", jotoSku: "BE-MUG-015-10-BK", jotoTitle: "Engraving 10oz/300ml Powder Coated Stainless Steel Mug - Pack of 5" },
  { slug: "sublimation-mug-starter-pack-11oz-36", jotoSku: "B-MUG-PC-11-SMPLE", jotoTitle: "11oz Sublimation Mugs Starter Pack (36 Mugs in Total)" },
  { slug: "sublimation-mug-starter-pack-15oz-36", jotoSku: "B-MUG-15-SMPLE", jotoTitle: "15Oz Sublimation mug starter pack (36 Mugs in Total)" },
];
