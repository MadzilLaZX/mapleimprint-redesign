// Draft catalogue additions: mugs and drinkware blanks from Joto Imaging Supplies Canada
// (jotoimagingsupplies.ca), imported 2026-10-21 from the owner's own screenshots of each product
// page, taken while logged in to the Mapleimprint dealer account — so every price below is the
// price Joto shows that account, in CAD.
//
// PRICING POLICY FOR THIS FILE (owner's explicit instruction for this initial import): prices are
// copied EXACTLY as Joto shows them — no applyHouseMargin(), no rounding, no derived per-unit
// figures. This differs from jotoBlanksCatalogDraft.ts on purpose; retail markup is a separate,
// later step. Until then these prices equal Maple's dealer cost, so none of these may be
// published as-is.
//
// Bundles: supplierBundlePricing[].sellUnit says what one price buys (a whole case, a whole pack,
// or a single unit), and each tier's totalCad is the price for that whole tier, exactly as Joto
// lists it. startingPrice is the first tier's totalCad (one case/pack/unit), NOT a per-mug price.
//
// Every entry is status: "draft" (hidden from listings; its product URL 404s). Joto SKUs live in
// jotoDrinkwareInternalOnly.ts (never imported by customer-facing code).
//
// Images (owner approved reusing Joto's photos): public/images/products/joto/ — cropped from the
// owner's screenshots (Joto's site blocks automated downloads), carousel arrows painted out,
// upscaled 2x with lanczos3 and lightly sharpened. Placeholder quality; swap in Joto's originals
// when available. Only blank product photos were used — the 6 products whose screenshots show
// only Joto's sample designs (third-party logos/characters) have no image yet.
//
// Held back, not imported: "11oz Sublimation Purple Plated Ceramic Mug" ($149.40, but the page
// doesn't say how many mugs that buys) and "Pearl Coating Sublimation 6oz White..." (only seen in
// the collection grid, name and price cut off).
import type { CatalogueProduct } from "@/lib/products";

const RULE = "house-v1-joto-exact-2026-10-21";

export const JOTO_DRINKWARE_CATALOGUE_DRAFT: CatalogueProduct[] = [
  // --- Ceramic mugs ---------------------------------------------------------------------------
  {
    slug: "sublimation-mug-11oz-white-case-36",
    name: "11oz Sublimation White Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Classic 11oz white ceramic mug with a bright, super-white gloss coating for vivid full-colour prints. " +
      "Approx. 3.75\" tall x 3.25\" wide. Microwave and dishwasher safe. Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-mug-11oz-white-case-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 52.2,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        regularPriceCad: 59.4,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 1.45, totalCad: 52.2 },
          { bundleCount: 60, totalItems: 2160, perItemCad: 1.4, totalCad: 3024.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-white-case-36",
    name: "15oz Sublimation White Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Large 15oz white ceramic mug with a glossy sublimation coating for bright, full-colour designs. " +
      "Sold by the case of 36 mugs.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 90.0,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.5, totalCad: 90.0 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.4, totalCad: 172.8 },
          { bundleCount: 5, totalItems: 180, perItemCad: 2.3, totalCad: 414.0 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.1, totalCad: 1512.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-11oz-inner-colour-case-36",
    name: "11oz Inner Colour Sublimation Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "11oz white ceramic mug with a coloured interior and matching handle, ready for full-colour sublimation. " +
      "Dishwasher and microwave safe, lead and cadmium free, FDA compliant. Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36.webp", colourName: "Black", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 81.0,
    printRuleVersion: RULE,
    productOptions: [
      {
        name: "Inner colour",
        values: ["Black", "Navy", "Blue", "Teal", "Pink", "Red", "Orange", "Lime Green", "Grey", "Light Grey", "Aqua"],
        note:
          "Joto's swatches are unlabelled, so names were assigned from each swatch's colour. Joto also shows a " +
          "Light Green swatch marked unavailable. Owner confirmed every colour is the same price.",
      },
    ],
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.25, totalCad: 81.0 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.15, totalCad: 154.8 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.05, totalCad: 442.8 },
          { bundleCount: 20, totalItems: 720, perItemCad: 1.95, totalCad: 1404.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-inner-colour-case-36",
    name: "15oz Inner Colour Sublimation Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Large 15oz white ceramic mug with a coloured interior and matching handle, ready for full-colour sublimation. " +
      "Microwave and dishwasher safe, lead and cadmium free, FDA compliant. Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36.webp", colourName: "Black", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 122.4,
    printRuleVersion: RULE,
    productOptions: [
      {
        name: "Inner colour",
        values: ["Black", "Navy", "Blue", "Pink", "Red", "Yellow"],
        note:
          "Joto's swatches are unlabelled, so names were assigned from each swatch's colour. Joto also shows an " +
          "Orange swatch marked unavailable. Owner confirmed every colour is the same price.",
      },
    ],
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.4, totalCad: 122.4 },
          { bundleCount: 2, totalItems: 72, perItemCad: 3.3, totalCad: 237.6 },
          { bundleCount: 6, totalItems: 216, perItemCad: 3.1, totalCad: 669.6 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.95, totalCad: 2124.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-mug-15oz-inner-colour-case-6",
    name: "15oz Inner Colour Sublimation Mug — Case of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Large 15oz white ceramic mug with a coloured interior and matching handle, ready for full-colour sublimation. " +
      "Microwave and dishwasher safe, lead and cadmium free, FDA compliant. Sold by the case of 6 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-6-black.webp", colourName: "Black", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-6-red.webp", colourName: "Red", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 29.99,
    printRuleVersion: RULE,
    productOptions: [{ name: "Inner colour", values: ["Black", "Red"] }],
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 6,
        tiers: [{ bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 29.99 }],
      },
    ],
  },
  {
    slug: "sublimation-colour-changing-mug-11oz-case",
    name: "11oz Colour-Changing Sublimation Mug — Case",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "11oz heat-sensitive ceramic mug: black when cold, revealing your full-colour photo or design when filled " +
      "with a hot drink. Approx. 3.67\" tall x 3.5\" wide. Sold by the case.",
    images: [
      { url: "/images/products/joto/sublimation-colour-changing-mug-11oz-case.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 189.6,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        // Joto's title says "Case of 48" but every tier says 24 mugs per case (and 24 x $7.90 =
        // $189.60), so the tiers are recorded as shown — pending owner confirmation.
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 7.9, totalCad: 189.6 },
          { bundleCount: 2, totalItems: 48, perItemCad: 7.5, totalCad: 360.0 },
          { bundleCount: 6, totalItems: 144, perItemCad: 7.0, totalCad: 1008.0 },
          { bundleCount: 20, totalItems: 480, perItemCad: 6.5, totalCad: 3120.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-black-mug-white-patch-case-36",
    name: "Black Sublimation Mug with White Patch — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Black ceramic mug with a white sublimation patch for your design. Patch approx. 7.75\" x 3.125\" (11oz) " +
      "or 8.11\" x 3.82\" (15oz). Dishwasher and microwave safe, lead and cadmium free, FDA compliant. " +
      "Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-black-mug-white-patch-case-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 95.4,
    printRuleVersion: RULE,
    productOptions: [{ name: "Size", values: ["11oz", "15oz"] }],
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        appliesTo: "11oz",
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.65, totalCad: 95.4 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.5, totalCad: 540.0 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.3, totalCad: 1656.0 },
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
          { bundleCount: 20, totalItems: 720, perItemCad: 3.25, totalCad: 2340.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-marble-mug-11oz-case-36",
    name: "11oz Marble Sublimation Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "11oz ceramic mug with marbling inside and out, ready for sublimation. Each mug's marbling is unique. " +
      "Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-marble-mug-11oz-case-36.webp", colourName: null, imageType: "front" },
      { url: "/images/products/joto/sublimation-marble-mug-11oz-case-36-blue.webp", colourName: "Blue", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 41.4,
    printRuleVersion: RULE,
    productOptions: [
      { name: "Colour", values: ["Pink", "Blue"], note: "Joto shows a third swatch marked unavailable; names inferred from swatch colour — confirm" },
    ],
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        regularPriceCad: 142.2,
        tiers: [{ bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 41.4 }],
      },
    ],
  },
  {
    slug: "sublimation-bone-china-mug-gold-rim-pack-6",
    name: "Bone China Sublimation Mug with Gold Rim & Handle — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Elegant white bone china mug with a gold rim and gold handle, ready for sublimation. Available in 10oz " +
      "and 11oz, each with a different handle shape. Sold by the pack of 6 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-bone-china-mug-gold-rim-pack-6.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 41.7,
    printRuleVersion: RULE,
    productOptions: [{ name: "Size", values: ["10oz", "11oz"], note: "11oz price not captured yet" }],
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        appliesTo: "10oz",
        regularPriceCad: 73.68,
        tiers: [{ bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 41.7 }],
      },
    ],
  },
  {
    slug: "sublimation-latte-mug-12oz-case-36",
    name: "12oz Sublimation Latte Mug — Case of 36",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Tapered 12oz white ceramic latte mug for sublimation — approx. 4\" tall, 3.5\" across the top and 2.5\" at " +
      "the base. Sold by the case of 36 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-latte-mug-12oz-case-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 110.52,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.07, totalCad: 110.52 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.92, totalCad: 210.24 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.69, totalCad: 581.04 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.45, totalCad: 1764.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-latte-mug-17oz-case-24",
    name: "17oz Sublimation Latte Mug — Case of 24",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Tall 17oz white ceramic latte mug for sublimation — approx. 6\" tall, 3.5\" across the top and 2.5\" at the " +
      "base. Dishwasher and microwave safe, lead and cadmium free, FDA compliant. Sold by the case of 24 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-latte-mug-17oz-case-24.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 84.0,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 3.5, totalCad: 84.0 },
          { bundleCount: 2, totalItems: 48, perItemCad: 3.4, totalCad: 163.2 },
          { bundleCount: 6, totalItems: 144, perItemCad: 3.2, totalCad: 460.8 },
          { bundleCount: 20, totalItems: 480, perItemCad: 2.95, totalCad: 1416.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-camp-mug-13oz-beige-ceramic-case-24",
    name: "13oz Beige Ceramic Camp Mug — Case of 24",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "13oz speckled beige ceramic camp-style mug with a dark rim, impact resistant, ready for sublimation. " +
      "Approx. 3.5\" tall x 3.25\" wide. Requires a mug wrap and convection oven to print. Sold by the case of 24 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-camp-mug-13oz-beige-ceramic-case-24.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 118.56,
    printRuleVersion: RULE,
    supplierBundlePricing: [
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

  // --- Enamel camp cups -----------------------------------------------------------------------
  {
    slug: "sublimation-enamel-camp-cup-12oz-pack-12",
    name: "12oz Sublimation Enamel Camp Cup — Pack of 12",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "12oz white enamel camp cup with a steel rim — impact resistant, great for camping and outdoor use. " +
      "Approx. 3.1\" tall x 3.4\" wide. Sold by the pack of 12 cups.",
    images: [
      { url: "/images/products/joto/sublimation-enamel-camp-cup-12oz-pack-12.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 54.96,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: 4.58, totalCad: 54.96 },
          { bundleCount: 4, totalItems: 48, perItemCad: 4.48, totalCad: 215.04 },
          { bundleCount: 8, totalItems: 96, perItemCad: 4.35, totalCad: 417.6 },
          { bundleCount: 20, totalItems: 240, perItemCad: 4.2, totalCad: 1008.0 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-enamel-camp-cup-17oz-flat-bottom-pack-6",
    name: "17oz Sublimation Enamel Camp Cup with Flat Bottom — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "17oz (500ml) white enamel camp cup with a steel rim and a stable flat bottom, ready for sublimation. " +
      "Sold by the pack of 6 cups.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 33.37,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 5.56, totalCad: 33.37 },
          { bundleCount: 2, totalItems: 12, perItemCad: 5.25, totalCad: 63.0 },
          { bundleCount: 4, totalItems: 24, perItemCad: 4.97, totalCad: 119.28 },
          { bundleCount: 8, totalItems: 48, perItemCad: 4.63, totalCad: 222.24 },
        ],
      },
    ],
  },

  // --- Stainless steel mugs & travel mugs -----------------------------------------------------
  {
    slug: "sublimation-stainless-coffee-cup-13oz-lid-pack-5",
    name: "13oz Stainless Steel Sublimation Coffee Cup with Lid & Handle — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "13oz (400ml) white stainless steel coffee cup with a handle and clear flat lid, ready for sublimation. " +
      "Durable and rust resistant. Sold by the pack of 5 cups.",
    images: [
      { url: "/images/products/joto/sublimation-stainless-coffee-cup-13oz-lid-pack-5.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 65.2,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 13.04, totalCad: 65.2 },
          { bundleCount: 2, totalItems: 10, perItemCad: 12.3, totalCad: 123.0 },
          { bundleCount: 4, totalItems: 20, perItemCad: 11.64, totalCad: 232.8 },
          { bundleCount: 8, totalItems: 40, perItemCad: 10.86, totalCad: 434.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-mug-14oz-stainless-pack-6",
    name: "14oz White Stainless Steel Sublimation Travel Mug — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "14oz white stainless steel travel mug with a lid, tapered at the bottom to fit most cup holders. " +
      "Ready for sublimation. Sold by the pack of 6 mugs.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 52.38,
    printRuleVersion: RULE,
    supplierBundlePricing: [
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
    name: "17oz Sublimation Travel Mug",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "17oz stainless steel travel mug with a handle and a sublimatable white plastic insert for your design. " +
      "Fits a car cup holder. Sold individually, with quantity discounts.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 10.65,
    printRuleVersion: RULE,
    supplierBundlePricing: [
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
    name: "10oz Powder-Coated Stainless Steel Engraving Mug — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "engraved-personalized",
    description:
      "10oz (300ml) double-wall 304 stainless steel mug with a powder-coated finish, handle and clear lid — " +
      "made for laser engraving. Sold by the pack of 5 mugs.",
    images: [
      { url: "/images/products/joto/engraving-stainless-mug-10oz-pack-5.webp", colourName: null, imageType: "front" },
      { url: "/images/products/joto/engraving-stainless-mug-10oz-pack-5-white.webp", colourName: "White", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 54.75,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Black", "White"] }],
    supplierBundlePricing: [
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

  // --- Starter / sample packs -----------------------------------------------------------------
  {
    slug: "sublimation-mug-starter-pack-11oz-36",
    name: "11oz Sublimation Mug Starter Pack (36 Mugs)",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "A mixed pack of 36 assorted 11oz sublimation mugs in different coatings and colours — ideal for testing " +
      "prints and showing customers options before ordering in bulk. Sold as one pack.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 89.99,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [{ bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 89.99 }],
      },
    ],
  },
  {
    slug: "sublimation-mug-starter-pack-15oz-36",
    name: "15oz Sublimation Mug Starter Pack (36 Mugs)",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "A mixed pack of 36 assorted 15oz sublimation mugs with different inner colours and handles — ideal for " +
      "testing prints and showing customers options before ordering in bulk. Sold as one pack.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: 139.99,
    printRuleVersion: RULE,
    supplierBundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [{ bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 139.99 }],
      },
    ],
  },
];
