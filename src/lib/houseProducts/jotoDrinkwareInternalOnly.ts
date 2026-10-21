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
  { slug: "sublimation-mug-11oz-inner-colour-case-36", jotoSku: "B-MUG-11-{BK,BL,LB,GR,LG,PK,RD,OR,YL,GY,PL}-EGC; Light Blue = B-MUG-037-11-LB-EGC", jotoTitle: "Pearl Coating™ 11oz Inner Colored Sublimation Mug - Case of 36" },
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
  { slug: "sublimation-skinny-tumbler-20oz-straw-pack-5", jotoSku: "B-TBR-10-S60001-WH", jotoTitle: "Pearl Coating™ 20oz Sublimation Stainless Steel Tumbler with Straw & Lid - Pack of 5" },
  { slug: "sublimation-glitter-skinny-tumbler-20oz-silver-pack-5", jotoSku: "B-TBR-003-20-SL", jotoTitle: "Pearl Coating™ 20oz/600ml Sublimation Glitter Silver Stainless Steel Silver Skinny Tumbler with Straw & Lid - Pack of 5" },
  { slug: "sublimation-travel-tumbler-40oz-handle-pack-5", jotoSku: "B-TBR-061-40-WH", jotoTitle: "Pearl Coating™ 40oz Sublimation Stainless Steel White Travel Tumbler with Clear Flat Lid & Handle - Pack of 5" },
  { slug: "sublimation-tumbler-20oz-white-pack-5", jotoSku: "B-TBR-SS-WH-20", jotoTitle: "Pearl Coating™ 20oz Sublimation Stainless Steel White Tumbler - Pack of 5" },
  { slug: "sublimation-tumbler-20oz-silver-pack-5", jotoSku: "B-TBR-SS-SL-20", jotoTitle: "Pearl Coating™ 20oz Sublimation Stainless Steel Silver Tumbler - Pack of 5" },
  { slug: "sublimation-tumbler-16oz-silver-pack-6", jotoSku: "B-TBR-SS-SL-16", jotoTitle: "Pearl Coating™ 16oz Sublimation Stainless Steel Tumbler Silver - Pack of 6" },
  { slug: "sublimation-tumbler-20oz-portable-lid-pack-4", jotoSku: "B-TBR-SS-WH-20-PL", jotoTitle: "20oz Sublimation SS White Tumbler with Portable Lid - Pack of 4" },
  { slug: "sublimation-travel-tumbler-25oz-metal-handle-pack-5", jotoSku: "B-TBR-071-25-WH", jotoTitle: "Pearl Coating™ 25oz/750ml Sublimation Stainless Steel Travel Tumbler with Clear Flat Lid & Metal Handle - Pack of 5" },
  { slug: "engraving-skinny-tumbler-20oz-straw-pack-5", jotoSku: "BE-TBR-011-20-BK (Black shown)", jotoTitle: "Engraving 20oz/600ml Stainless Steel Tumbler with Straw & Waterproof Lid - Pack of 5" },
  { slug: "engraving-travel-tumbler-40oz-straw-pack-5", jotoSku: "BE-TBR-012-40-BK / BE-TBR-012-40-WH", jotoTitle: "40oz/1200ml Engraving Stainless Steel Travel Tumbler w/ Straw - Pack of 5" },
  { slug: "sublimation-frosted-glass-skinny-tumbler-20oz-pack-6", jotoSku: "B-MUG-030-20-FR", jotoTitle: "Pearl Coating™ 20oz Sublimation Frosted Glass Skinny Tumbler with Straw & Bamboo Lid - Pack of 6" },
  { slug: "sublimation-frosted-glass-skinny-tumbler-17oz-pack-12", jotoSku: "B-MUG-030-17-FR", jotoTitle: "Pearl Coating™ 17oz Sublimation Glass Skinny Tumbler with Straw and Bamboo lid Frosted - Pack of 12" },
  { slug: "sublimation-glass-can-18oz-bamboo-lid-pack-12", jotoSku: "B-MUG-027-18-FRS / B-MUG-027-18-CLS", jotoTitle: "Pearl Coating™ 18oz Sublimation Glass Can with Bamboo Lid - Pack of 12" },
  { slug: "sublimation-stainless-coffee-cup-12oz-lid-pack-5", jotoSku: "B-MUG-10-S30001-WH", jotoTitle: "Pearl Coating™ 12oz Sublimation Stainless Steel Coffee Cup with Lid - Pack of 5" },
  { slug: "sublimation-pop-lid-bottle-17oz-pack-10", jotoSku: "B-BTL-SS-17-PL", jotoTitle: "Pearl Coating™ 500ml/17oz Pop Lid Stainless Steel Bottle(White) - Pack of 10" },
  { slug: "sublimation-bottle-17oz-cup-lid-pack-5", jotoSku: "B-BTL-099-17-WH", jotoTitle: "Pearl Coating™ 17oz/500ml Stainless Steel Bottle with a Cup Lid Pack of 5" },
];

// Joto's exact dealer pricing (CAD) as shown to the Mapleimprint account, copied verbatim from the
// owner's screenshots — the cost basis that jotoDrinkwareCatalogDraft.ts's retail bundlePricing was
// derived from with applyHouseMargin rules (bracket by per-piece cost; sale items marked up from
// regularPriceCad). Internal only, never shown to customers.
import type { SupplierBundlePricing } from "@/lib/products";

export const JOTO_DRINKWARE_COSTS_INTERNAL: { slug: string; costPricing: SupplierBundlePricing[] }[] = [
  {
    slug: "sublimation-mug-11oz-white-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        regularPriceCad: 59.4,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 1.45, totalCad: 52.2 },
          { bundleCount: 60, totalItems: 2160, perItemCad: 1.4, totalCad: 3024 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-white-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.5, totalCad: 90 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.4, totalCad: 172.8 },
          { bundleCount: 5, totalItems: 180, perItemCad: 2.3, totalCad: 414 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.1, totalCad: 1512 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-11oz-inner-colour-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.25, totalCad: 81 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.15, totalCad: 154.8 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.05, totalCad: 442.8 },
          { bundleCount: 20, totalItems: 720, perItemCad: 1.95, totalCad: 1404 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-inner-colour-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.4, totalCad: 122.4 },
          { bundleCount: 2, totalItems: 72, perItemCad: 3.3, totalCad: 237.6 },
          { bundleCount: 6, totalItems: 216, perItemCad: 3.1, totalCad: 669.6 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.95, totalCad: 2124 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-inner-colour-case-6",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 29.99 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-colour-changing-mug-11oz-case",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 7.9, totalCad: 189.6 },
          { bundleCount: 2, totalItems: 48, perItemCad: 7.5, totalCad: 360 },
          { bundleCount: 6, totalItems: 144, perItemCad: 7, totalCad: 1008 },
          { bundleCount: 20, totalItems: 480, perItemCad: 6.5, totalCad: 3120 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-black-mug-white-patch-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        appliesTo: "11oz",
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.65, totalCad: 95.4 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.5, totalCad: 540 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.3, totalCad: 1656 },
        ],
      },
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        appliesTo: "15oz",
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.8, totalCad: 136.8 },
          { bundleCount: 2, totalItems: 72, perItemCad: 3.7, totalCad: 266.4 },
          { bundleCount: 6, totalItems: 216, perItemCad: 3.55, totalCad: 766.8 },
          { bundleCount: 20, totalItems: 720, perItemCad: 3.25, totalCad: 2340 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-marble-mug-11oz-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        regularPriceCad: 142.2,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 41.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-bone-china-mug-gold-rim-pack-6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        appliesTo: "10oz",
        regularPriceCad: 73.68,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 41.7 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-latte-mug-12oz-case-36",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.07, totalCad: 110.52 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.92, totalCad: 210.24 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.69, totalCad: 581.04 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.45, totalCad: 1764 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-latte-mug-17oz-case-24",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 3.5, totalCad: 84 },
          { bundleCount: 2, totalItems: 48, perItemCad: 3.4, totalCad: 163.2 },
          { bundleCount: 6, totalItems: 144, perItemCad: 3.2, totalCad: 460.8 },
          { bundleCount: 20, totalItems: 480, perItemCad: 2.95, totalCad: 1416 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-camp-mug-13oz-beige-ceramic-case-24",
    costPricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 4.94, totalCad: 118.56 },
          { bundleCount: 2, totalItems: 48, perItemCad: 4.73, totalCad: 227.04 },
          { bundleCount: 6, totalItems: 144, perItemCad: 4.39, totalCad: 632.16 },
          { bundleCount: 20, totalItems: 480, perItemCad: 3.97, totalCad: 1905.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-enamel-camp-cup-12oz-pack-12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: 4.58, totalCad: 54.96 },
          { bundleCount: 4, totalItems: 48, perItemCad: 4.48, totalCad: 215.04 },
          { bundleCount: 8, totalItems: 96, perItemCad: 4.35, totalCad: 417.6 },
          { bundleCount: 20, totalItems: 240, perItemCad: 4.2, totalCad: 1008 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-enamel-camp-cup-17oz-flat-bottom-pack-6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 5.56, totalCad: 33.37 },
          { bundleCount: 2, totalItems: 12, perItemCad: 5.25, totalCad: 63 },
          { bundleCount: 4, totalItems: 24, perItemCad: 4.97, totalCad: 119.28 },
          { bundleCount: 8, totalItems: 48, perItemCad: 4.63, totalCad: 222.24 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-stainless-coffee-cup-13oz-lid-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 13.04, totalCad: 65.2 },
          { bundleCount: 2, totalItems: 10, perItemCad: 12.3, totalCad: 123 },
          { bundleCount: 4, totalItems: 20, perItemCad: 11.64, totalCad: 232.8 },
          { bundleCount: 8, totalItems: 40, perItemCad: 10.86, totalCad: 434.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-mug-14oz-stainless-pack-6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 8.73, totalCad: 52.38 },
          { bundleCount: 4, totalItems: 24, perItemCad: 8.72, totalCad: 209.28 },
          { bundleCount: 11, totalItems: 66, perItemCad: 8.42, totalCad: 555.72 },
          { bundleCount: 20, totalItems: 120, perItemCad: 8.13, totalCad: 975.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-mug-17oz",
    costPricing: [
      {
        sellUnit: "unit",
        itemsPerBundle: 1,
        tiers: [
          { bundleCount: 1, totalItems: 1, perItemCad: 10.65, totalCad: 10.65 },
          { bundleCount: 24, totalItems: 24, perItemCad: 10.51, totalCad: 252.24 },
          { bundleCount: 48, totalItems: 48, perItemCad: 10.37, totalCad: 497.76 },
          { bundleCount: 120, totalItems: 120, perItemCad: 10.09, totalCad: 1210.8 },
        ],
      },
    ],
  },
  {
    slug: "engraving-stainless-mug-10oz-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 10.95, totalCad: 54.75 },
          { bundleCount: 3, totalItems: 15, perItemCad: 10.62, totalCad: 159.3 },
          { bundleCount: 5, totalItems: 25, perItemCad: 10.3, totalCad: 257.5 },
          { bundleCount: 10, totalItems: 50, perItemCad: 9.99, totalCad: 499.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-starter-pack-11oz-36",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 89.99 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-starter-pack-15oz-36",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 139.99 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-skinny-tumbler-20oz-straw-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 12.45, totalCad: 62.25 },
          { bundleCount: 2, totalItems: 10, perItemCad: 11.95, totalCad: 119.5 },
          { bundleCount: 5, totalItems: 25, perItemCad: 10.95, totalCad: 273.75 },
          { bundleCount: 15, totalItems: 75, perItemCad: 10.45, totalCad: 783.75 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-glitter-skinny-tumbler-20oz-silver-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        regularPriceCad: 67.96,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 24.75 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-tumbler-40oz-handle-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 12.99, totalCad: 64.95 },
          { bundleCount: 2, totalItems: 10, perItemCad: 11.99, totalCad: 119.9 },
          { bundleCount: 4, totalItems: 20, perItemCad: 11.49, totalCad: 229.8 },
          { bundleCount: 12, totalItems: 60, perItemCad: 10.99, totalCad: 659.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-white-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 13.31, totalCad: 66.55 },
          { bundleCount: 3, totalItems: 15, perItemCad: 13.01, totalCad: 195.15 },
          { bundleCount: 5, totalItems: 25, perItemCad: 12.79, totalCad: 319.75 },
          { bundleCount: 10, totalItems: 50, perItemCad: 12.42, totalCad: 621 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-silver-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 13.31, totalCad: 66.55 },
          { bundleCount: 3, totalItems: 15, perItemCad: 13.01, totalCad: 195.15 },
          { bundleCount: 5, totalItems: 25, perItemCad: 12.79, totalCad: 319.75 },
          { bundleCount: 10, totalItems: 50, perItemCad: 12.42, totalCad: 621 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-16oz-silver-pack-6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 12.22, totalCad: 73.32 },
          { bundleCount: 2, totalItems: 12, perItemCad: 11.87, totalCad: 142.44 },
          { bundleCount: 4, totalItems: 24, perItemCad: 11.5, totalCad: 276 },
          { bundleCount: 12, totalItems: 72, perItemCad: 10.97, totalCad: 789.84 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-portable-lid-pack-4",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: 13.99, totalCad: 55.96 },
          { bundleCount: 2, totalItems: 8, perItemCad: 12.99, totalCad: 103.92 },
          { bundleCount: 6, totalItems: 24, perItemCad: 11.99, totalCad: 287.76 },
          { bundleCount: 10, totalItems: 40, perItemCad: 11.79, totalCad: 471.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-tumbler-25oz-metal-handle-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 77.25 },
        ],
      },
    ],
  },
  {
    slug: "engraving-skinny-tumbler-20oz-straw-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 9.75, totalCad: 48.75 },
          { bundleCount: 3, totalItems: 15, perItemCad: 9.46, totalCad: 141.9 },
          { bundleCount: 5, totalItems: 25, perItemCad: 9.17, totalCad: 229.25 },
          { bundleCount: 10, totalItems: 50, perItemCad: 8.9, totalCad: 445 },
        ],
      },
    ],
  },
  {
    slug: "engraving-travel-tumbler-40oz-straw-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        regularPriceCad: 63.75,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 58.2 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-frosted-glass-skinny-tumbler-20oz-pack-6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        regularPriceCad: 25.2,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 20 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-frosted-glass-skinny-tumbler-17oz-pack-12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        regularPriceCad: 69.6,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 42 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-glass-can-18oz-bamboo-lid-pack-12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        appliesTo: "Frosted",
        regularPriceCad: 54,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 41.88 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        appliesTo: "Clear",
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 54 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-stainless-coffee-cup-12oz-lid-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 63.65 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-pop-lid-bottle-17oz-pack-10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 137.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-bottle-17oz-cup-lid-pack-5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 66.25 },
        ],
      },
    ],
  },
];
