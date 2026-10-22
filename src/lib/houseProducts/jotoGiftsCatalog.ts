// Joto Imaging Supplies Canada — coasters, kitchen and gift blanks (batch 3, 2026-10-21), from the
// owner's screenshots of the Mapleimprint dealer account. Same rules as jotoDrinkwareCatalogDraft.ts:
// published, retail = Joto cost marked up with margin.ts (bracket by per-piece cost; sale items
// marked up from Joto's regular price), ordered via BundleConfigurator. Exact costs and SKUs live
// in jotoGiftsInternalOnly.ts (never imported by customer-facing code).
//
// Owner's instructions: keep options Joto shows as sold out (Square marble-wood coasters, Heart
// slate coaster); Matte Ceramic Coaster offers both Round and Square. Joto shows one price for
// these, so every option of a product is priced the same.
import type { CatalogueProduct } from "@/lib/products";

const RULE = "house-v1-joto-markup-2026-10-21";
const J = (file: string, colourName: string | null = null) => ({
  url: `/images/products/joto/${file}.webp`,
  colourName,
  imageType: "front",
});

export const JOTO_GIFTS_CATALOGUE: CatalogueProduct[] = [
  {
    slug: "sublimation-coaster-cork-square-3-75in-pack-10",
    name: "Sublimation Hardboard Coaster with Cork Bottom, Square 3.75\" — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "3.75\" x 3.75\" square hardboard coaster with a cork bottom — accent home décor ready for full-colour sublimation. Sold by the pack of 10.",
    images: [
      J("sublimation-coaster-cork-square-3-75in-pack-10-1"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 19.5,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 1.95, totalCad: 19.5 },
          { bundleCount: 2, totalItems: 20, perItemCad: 1.9, totalCad: 38 },
          { bundleCount: 6, totalItems: 60, perItemCad: 1.85, totalCad: 111 },
          { bundleCount: 10, totalItems: 100, perItemCad: 1.81, totalCad: 181 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-foam-coaster-round-pack-10",
    name: "Sublimation Foam Round Coaster 3.5\" — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "3.5\" round absorbent foam coaster — lightweight, soft and cushioned, suitable for sublimation or laser transfer paper. Sold by the pack of 10.",
    images: [
      J("sublimation-foam-coaster-round-pack-10-1"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 8.19,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 8.19 },
        ],
      },
    ],
  },
  {
    slug: "engraving-marble-wood-coaster-round-square-pack-4",
    name: "Engravable Marble & Wood Coaster, Round or Square — Pack of 4",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "Marble and wood coasters with a natural, modern two-tone look — made for laser engraving. Round is 3.9\" (10cm) in diameter. Sold by the pack of 4.",
    images: [
      J("engraving-marble-wood-coaster-round-square-pack-4-1", "Round"),
      J("engraving-marble-wood-coaster-round-square-pack-4-2", "Round"),
      J("engraving-marble-wood-coaster-round-square-pack-4-3", "Round"),
      J("engraving-marble-wood-coaster-round-square-pack-4-4", "Square"),
      J("engraving-marble-wood-coaster-round-square-pack-4-5"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 25.99,
    printRuleVersion: RULE,
    productOptions: [{ name: "Shape", values: ["Round", "Square"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: null, totalCad: 25.99 },
        ],
      },
    ],
  },
  {
    slug: "engraving-marble-wood-coaster-hexagon-square-pack-4",
    name: "Engravable Marble & Wood Coaster, Hexagon or Square — Pack of 4",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "Marble and wood coasters that blend the look of marble with the warmth of wood — a canvas for laser engraving. Sold by the pack of 4.",
    images: [
      J("engraving-marble-wood-coaster-hexagon-square-pack-4-1", "Hexagon"),
      J("engraving-marble-wood-coaster-hexagon-square-pack-4-2", "Square"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 19.5,
    printRuleVersion: RULE,
    productOptions: [{ name: "Shape", values: ["Hexagon", "Square"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: null, totalCad: 19.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-polymer-coaster-cork-square-pack-10",
    name: "Sublimation Polymer Coaster with Cork, Square 8.9cm Matte — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "8.9 x 8.9cm (3.5\") square matte polymer coaster with a cork back, ready for sublimation. Sold by the pack of 10.",
    images: [
      J("sublimation-polymer-coaster-cork-square-pack-10-1"),
      J("sublimation-polymer-coaster-cork-square-pack-10-2"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 29.12,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 29.12 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-matte-ceramic-coaster-cork-pack-12",
    name: "Sublimation Matte Ceramic Coaster with Cork, Round or Square — Pack of 12",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "4.2\" matte ceramic coaster with a cork back, ready for sublimation — available round or square. Sold by the pack of 12.",
    images: [
      J("sublimation-matte-ceramic-coaster-cork-pack-12-1", "Round"),
      J("sublimation-matte-ceramic-coaster-cork-pack-12-2", "Square"),
      J("sublimation-matte-ceramic-coaster-cork-pack-12-3", "Square"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 28.24,
    printRuleVersion: RULE,
    productOptions: [{ name: "Shape", values: ["Round", "Square"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 28.24 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-slate-coaster-pack-10",
    name: "Sublimation Slate Coaster — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "Naturally chiselled-edge slate coaster with a sublimation-ready face — striking with family photos or designs. Round 3.94\", Square 4\" x 4\" or Heart 5.9\". Sold by the pack of 10.",
    images: [
      J("sublimation-slate-coaster-pack-10-1", "Round 3.94\""),
      J("sublimation-slate-coaster-pack-10-2", "Square 4\" x 4\""),
      J("sublimation-slate-coaster-pack-10-3", "Square 4\" x 4\""),
      J("sublimation-slate-coaster-pack-10-4", "Square 4\" x 4\""),
      J("sublimation-slate-coaster-pack-10-5", "Heart 5.9\""),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 40.6,
    printRuleVersion: RULE,
    productOptions: [{ name: "Shape", values: ["Round 3.94\"", "Square 4\" x 4\"", "Heart 5.9\""] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 4.06, totalCad: 40.6 },
          { bundleCount: 3, totalItems: 30, perItemCad: 3.91, totalCad: 117.3 },
          { bundleCount: 6, totalItems: 60, perItemCad: 3.82, totalCad: 229.2 },
          { bundleCount: 8, totalItems: 80, perItemCad: 3.67, totalCad: 293.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-car-coaster-ceramic-pack-10",
    name: "Sublimation Ceramic Car Cup-Holder Coaster — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "coasters",
    description:
      "Ceramic coaster sized for car cup holders, with a finger notch for easy removal — durable and ready for sublimation. Sold by the pack of 10.",
    images: [
      J("sublimation-car-coaster-ceramic-pack-10-1"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 20.76,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 20.76 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-pot-coaster-bottle-shaped-pack-6",
    name: "Sublimation Large Bottle-Shaped Ceramic Pot Coaster — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "kitchen-gifts",
    description:
      "Large bottle-shaped ceramic trivet with a cork back and hanging hole, ready for sublimation. Sold by the pack of 6.",
    images: [
      J("sublimation-pot-coaster-bottle-shaped-pack-6-1"),
      J("sublimation-pot-coaster-bottle-shaped-pack-6-2"),
      J("sublimation-pot-coaster-bottle-shaped-pack-6-3"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 25.38,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 4.23, totalCad: 25.38 },
          { bundleCount: 4, totalItems: 24, perItemCad: 4.1, totalCad: 98.4 },
          { bundleCount: 16, totalItems: 96, perItemCad: 3.97, totalCad: 381.12 },
          { bundleCount: 32, totalItems: 192, perItemCad: 3.71, totalCad: 712.32 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-waffle-kitchen-towel-pack-10",
    name: "Sublimation Polyester Waffle Kitchen Towel 15.7\" x 23.6\" — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "kitchen-gifts",
    description:
      "15.7\" x 23.6\" white polyester waffle-weave kitchen towel, ready for sublimation. Sold by the pack of 10.",
    images: [
      J("sublimation-waffle-kitchen-towel-pack-10-1"),
      J("sublimation-waffle-kitchen-towel-pack-10-2"),
      J("sublimation-waffle-kitchen-towel-pack-10-3"),
      J("sublimation-waffle-kitchen-towel-pack-10-4"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 51.4,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: 5.14, totalCad: 51.4 },
          { bundleCount: 2, totalItems: 20, perItemCad: 4.98, totalCad: 99.6 },
          { bundleCount: 4, totalItems: 40, perItemCad: 4.84, totalCad: 193.6 },
          { bundleCount: 10, totalItems: 100, perItemCad: 4.59, totalCad: 459 },
        ],
      },
    ],
  },
  {
    slug: "engraving-leather-passport-holder-pack-5",
    name: "Engravable Leatherette Passport Holder 14.5 x 21cm — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "business-gifts",
    description:
      "Sturdy leatherette passport holder (14.5 x 21cm open) with card and document pockets — engraves to a contrasting colour. Sold by the pack of 5.",
    images: [
      J("engraving-leather-passport-holder-pack-5-1"),
      J("engraving-leather-passport-holder-pack-5-2"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 54.75,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Blue w/ Silver", "Light Grey", "Mint", "Grey", "White"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 54.75 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mdf-plaque-black-edge-15mm-pack-5",
    name: "Sublimation 15mm Black-Edge MDF Plaque — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "photo-panels",
    description:
      "15mm thick MDF plaque with a white sublimation face and bevelled black edge, keyhole slots on the back for hanging. Choose 5\" x 7\", 8\" x 10\" or 11\" x 14\". Sold by the pack of 5.",
    images: [
      J("sublimation-mdf-plaque-black-edge-15mm-pack-5-1"),
      J("sublimation-mdf-plaque-black-edge-15mm-pack-5-2"),
      J("sublimation-mdf-plaque-black-edge-15mm-pack-5-3"),
      J("sublimation-mdf-plaque-black-edge-15mm-pack-5-4"),
      J("sublimation-mdf-plaque-black-edge-15mm-pack-5-5"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 47.85,
    printRuleVersion: RULE,
    productOptions: [{ name: "Size", values: ["5\" x 7\"", "8\" x 10\"", "11\" x 14\""] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "5\" x 7\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 9.57, totalCad: 47.85 },
          { bundleCount: 3, totalItems: 15, perItemCad: 8.77, totalCad: 131.55 },
          { bundleCount: 5, totalItems: 25, perItemCad: 8.44, totalCad: 211 },
          { bundleCount: 10, totalItems: 50, perItemCad: 7.8, totalCad: 390 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "8\" x 10\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 15.84, totalCad: 79.2 },
          { bundleCount: 3, totalItems: 15, perItemCad: 14.51, totalCad: 217.65 },
          { bundleCount: 5, totalItems: 25, perItemCad: 13.4, totalCad: 335 },
          { bundleCount: 10, totalItems: 50, perItemCad: 12.44, totalCad: 622 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        appliesTo: "11\" x 14\"",
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 38.21, totalCad: 191.05 },
          { bundleCount: 2, totalItems: 10, perItemCad: 29.19, totalCad: 291.9 },
          { bundleCount: 4, totalItems: 20, perItemCad: 28.12, totalCad: 562.4 },
          { bundleCount: 6, totalItems: 30, perItemCad: 26.1, totalCad: 783 },
        ],
      },
    ],
  },];
