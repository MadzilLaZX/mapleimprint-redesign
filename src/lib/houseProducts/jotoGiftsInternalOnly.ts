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
  },];
