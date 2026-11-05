// INTERNAL-ONLY: Joto's exact dealer costs (CAD) and SKUs for jotoGiftsCatalog.ts, copied from the
// owner's screenshots (2026-10-21). DO NOT import from jotoGiftsCatalog.ts, catalogue.ts or any
// customer-facing module.
import type { SupplierBundlePricing } from "@/lib/products";

export const JOTO_GIFTS_COSTS_INTERNAL: { slug: string; jotoSku: string; jotoTitle: string; costPricing: SupplierBundlePricing[] }[] = [
  {
    slug: "sublimation-coaster-cork-square-3-75in-pack-10",
    jotoSku: "B-COASTER-44",
    jotoTitle: "Pearl Coating™ Sublimation Coaster W/Cork Bottom Square 3.75\" x 3.75\" - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 1.5, totalCad: 15 },
          { bundleCount: 2, totalItems: 20, perItemCad: 1.46, totalCad: 29.2 },
          { bundleCount: 6, totalItems: 60, perItemCad: 1.42, totalCad: 85.2 },
          { bundleCount: 10, totalItems: 100, perItemCad: 1.39, totalCad: 139 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-foam-coaster-round-pack-10",
    jotoSku: "B-COASTER-WF",
    jotoTitle: "Foam Round Coasters - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 6.3 },
        ],
      },
    ],
  },
  {
    slug: "engraving-marble-wood-coaster-round-square-pack-4",
    jotoSku: "CE-KTH-CC-MW-RD (Round) / Square",
    jotoTitle: "Engravable Marble Wood Coasters - 4 Pack (Round or Square)",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: null, totalCad: 19.99 },
        ],
      },
    ],
  },
  {
    slug: "engraving-marble-wood-coaster-hexagon-square-pack-4",
    jotoSku: "BE-KTH-001-101151 (Hexagon) / Square",
    jotoTitle: "Engravable Marble Wood Coasters - Pack of 4",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: null, totalCad: 15 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-polymer-coaster-cork-square-pack-10",
    jotoSku: "B-KTH-SC-PC02",
    jotoTitle: "Pearl Coating™ Polymer Coaster w/ Cork, Square 8.9x8.9cm Matte - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 22.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-matte-ceramic-coaster-cork-pack-12",
    jotoSku: "B-KTH-RCC-WC-01 (Round) / Square",
    jotoTitle: "Sublimation Matte Ceramic Coaster With Cork - Pack of 12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 21.72 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-slate-coaster-pack-10",
    jotoSku: "B-SLT-003G",
    jotoTitle: "Pearl Coating™ Sublimation Slate Mug Coaster - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 3.12, totalCad: 31.2 },
          { bundleCount: 3, totalItems: 30, perItemCad: 3.01, totalCad: 90.3 },
          { bundleCount: 6, totalItems: 60, perItemCad: 2.94, totalCad: 176.4 },
          { bundleCount: 8, totalItems: 80, perItemCad: 2.82, totalCad: 225.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-car-coaster-ceramic-pack-10",
    jotoSku: "B-KTH-CC-03",
    jotoTitle: "Pearl Coating™ Sublimation Ceramic Car Mug Coaster - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        regularPriceCad: 15.97,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 9.9 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-pot-coaster-bottle-shaped-pack-6",
    jotoSku: "B-KTH-PH-2",
    jotoTitle: "Pearl Coating™ Sublimation Large Pot Coaster Bottle Shaped - Pack of 6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 3.25, totalCad: 19.5 },
          { bundleCount: 4, totalItems: 24, perItemCad: 3.15, totalCad: 75.6 },
          { bundleCount: 16, totalItems: 96, perItemCad: 3.05, totalCad: 292.8 },
          { bundleCount: 32, totalItems: 192, perItemCad: 2.85, totalCad: 547.2 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-waffle-kitchen-towel-pack-10",
    jotoSku: "B-TWL-010-4060",
    jotoTitle: "Pearl Coating™ Sublimation Polyester Waffle Kitchen Towel 15.7\" x 23.6\" - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 3.95, totalCad: 39.5 },
          { bundleCount: 2, totalItems: 20, perItemCad: 3.83, totalCad: 76.6 },
          { bundleCount: 4, totalItems: 40, perItemCad: 3.72, totalCad: 148.8 },
          { bundleCount: 10, totalItems: 100, perItemCad: 3.53, totalCad: 353 },
        ],
      },
    ],
  },
  {
    slug: "engraving-leather-passport-holder-pack-5",
    jotoSku: "BE-PP-BS-14521 (Blue w/ Silver) and other colours",
    jotoTitle: "Engraving Leather Passport Holder (Blue W/ Silver, 14.5*21cm) - Pack of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        regularPriceCad: 43.8,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 33.45 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mdf-plaque-black-edge-15mm-pack-5",
    jotoSku: "B-MDF-PLB-0507 / -0810 / -1114",
    jotoTitle: "Pearl Coating Sublimation 15mm Black Edge MDF Plaque - 3 Sizes - Packs of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "5\" x 7\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 7.66, totalCad: 38.3 },
          { bundleCount: 3, totalItems: 15, perItemCad: 7.02, totalCad: 105.3 },
          { bundleCount: 5, totalItems: 25, perItemCad: 6.49, totalCad: 162.25 },
          { bundleCount: 10, totalItems: 50, perItemCad: 6, totalCad: 300.1 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "8\" x 10\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 12.67, totalCad: 63.35 },
          { bundleCount: 3, totalItems: 15, perItemCad: 11.61, totalCad: 174.15 },
          { bundleCount: 5, totalItems: 25, perItemCad: 10.72, totalCad: 268 },
          { bundleCount: 10, totalItems: 50, perItemCad: 9.95, totalCad: 497.5 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "11\" x 14\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 33.23, totalCad: 166.14 },
          { bundleCount: 2, totalItems: 10, perItemCad: 25.38, totalCad: 253.8 },
          { bundleCount: 4, totalItems: 20, perItemCad: 23.43, totalCad: 468.6 },
          { bundleCount: 6, totalItems: 30, perItemCad: 21.75, totalCad: 652.5 },
        ],
      },
    ],
  },  // Batch 4 (2026-10-21)
  {
    slug: "engraving-bamboo-cutting-board-wine-bottle-13x7-pack-5",
    jotoSku: "B-KTH-CB-04-3418",
    jotoTitle: "Engravable Wine Bottle Shaped Bamboo Cutting Board 13\" x 7\" - Pack of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        regularPriceCad: 23.75,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 19.95 },
        ],
      },
    ],
  },
  {
    slug: "engraving-bamboo-cutting-board-8x6-pack-5",
    jotoSku: "B-KTH-CB-03-2015",
    jotoTitle: "Engravable Bamboo Cutting Board 8\" x 6\" - Pack of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        regularPriceCad: 29.5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 9.95 },
        ],
      },
    ],
  },
  {
    slug: "engraving-bamboo-cutting-board-13-74x9-74-pack-5",
    jotoSku: "B-KTH-CB-02-3525",
    jotoTitle: "Engravable Bamboo Cutting Board 13.74\" x 9.74\"- Pack of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 6.4, totalCad: 32 },
          { bundleCount: 5, totalItems: 25, perItemCad: 6.21, totalCad: 155.25 },
          { bundleCount: 10, totalItems: 50, perItemCad: 6.02, totalCad: 301 },
          { bundleCount: 50, totalItems: 250, perItemCad: 5.84, totalCad: 1460 },
        ],
      },
    ],
  },
  {
    slug: "engraving-slate-ornament-round-4in-pack-12",
    jotoSku: "BE-SLT-001-4RND",
    jotoTitle: "Engravable 4'' Round Slate Ornament Double Sided - Pack of 12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        regularPriceCad: 21,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 14.28 },
        ],
      },
    ],
  },
  {
    slug: "engraving-slate-ornament-round-3in-pack-12",
    jotoSku: "BE-SLT-001-3RND",
    jotoTitle: "Engravable 3\" Round Slate Ornament Double Sided - Pack of 12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        regularPriceCad: 17.88,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 11.88 },
        ],
      },
    ],
  },
  {
    slug: "engraving-flask-8oz-pu-cover-pack-10",
    jotoSku: "BE-FSK-001-8-BK / Brown",
    jotoTitle: "Engravable 8 oz Stainless Steel Flask with PU Cover - Pack of 10",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 4.5, totalCad: 45 },
          { bundleCount: 5, totalItems: 50, perItemCad: 4.37, totalCad: 218.5 },
          { bundleCount: 10, totalItems: 100, perItemCad: 4.23, totalCad: 423 },
          { bundleCount: 20, totalItems: 200, perItemCad: 4.11, totalCad: 822 },
        ],
      },
    ],
  },
  {
    slug: "engraving-pu-leather-notebook-pack-5",
    jotoSku: "BE-NBK-002-14721",
    jotoTitle: "Engravable PU Leather Notebook - Pack of 5",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 8.76, totalCad: 43.8 },
          { bundleCount: 3, totalItems: 15, perItemCad: 8.26, totalCad: 123.9 },
          { bundleCount: 6, totalItems: 30, perItemCad: 7.82, totalCad: 234.6 },
          { bundleCount: 10, totalItems: 50, perItemCad: 7.3, totalCad: 365 },
        ],
      },
    ],
  },
  {
    slug: "engraving-wiro-plywood-notebook-a5-pack-6",
    jotoSku: "BE-NBK-001-1421",
    jotoTitle: "Engravable Wiro Plywood Cover Notebook A5 - Pack of 6",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 7.31, totalCad: 43.86 },
          { bundleCount: 2, totalItems: 12, perItemCad: 6.9, totalCad: 82.8 },
          { bundleCount: 4, totalItems: 24, perItemCad: 6.53, totalCad: 156.72 },
          { bundleCount: 8, totalItems: 48, perItemCad: 6.09, totalCad: 292.32 },
        ],
      },
    ],
  },
  {
    slug: "engraving-wall-slate-rectangle-20x30cm-pack-12",
    jotoSku: "BE-SLT-001-2030",
    jotoTitle: "Engravable Wall Slate Rectange 20x30cm - Pack of 12",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        regularPriceCad: 47.4,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 32.28 },
        ],
      },
    ],
  },
  {
    slug: "engraving-slate-photo-frame-25x19cm-pack-4",
    jotoSku: "BE-SLT-001-2519",
    jotoTitle: "Engravable Slate Frame 25x19cm - Pack of 4",
    costPricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        regularPriceCad: 19.8,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: null, totalCad: 15.96 },
        ],
      },
    ],
  },
];
