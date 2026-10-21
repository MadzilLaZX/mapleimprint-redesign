// Draft catalogue additions: mugs and drinkware blanks from Joto Imaging Supplies Canada
// (jotoimagingsupplies.ca), imported 2026-10-21 from the owner's own screenshots of each product
// page, taken while logged in to the Mapleimprint dealer account.
//
// PRICING: every price below is RETAIL (CAD) — Joto's exact dealer cost (kept verbatim in
// jotoDrinkwareInternalOnly.ts) marked up with the site's tiered rule (margin.ts markupRateFor:
// <$7 30%, $7–15 25%, $15–25 20%, $25–35 15%, $35+ 10%). Owner's decisions, 2026-10-21: the
// bracket is chosen by the PER-PIECE cost, not the bundle total; sale items are marked up from
// Joto's REGULAR price, not the sale price. Where Joto states a per-piece price, the retail
// per-piece price is rounded to the cent and the tier total is that x the piece count.
//
// Bundles: bundlePricing[].sellUnit says what one price buys (a whole case, a whole pack, or a
// single unit), and each tier's totalCad is the retail price for that whole tier.
// startingPrice is the first tier's totalCad (one case/pack/unit), NOT a per-mug price.
//
// PUBLISHED 2026-10-21 at the owner's request (all 36 entries; no `status` field = published).
// Customers order through BundleConfigurator (option + bundle tier + number of cases/packs);
// checkout reprices server-side via pricing/bundles.ts. Joto SKUs live in
// jotoDrinkwareInternalOnly.ts (never imported by customer-facing code).
//
// Images (owner approved reusing Joto's photos): public/images/products/joto/ — cropped from the
// owner's screenshots (Joto's site blocks automated downloads), carousel arrows painted out,
// upscaled 2x with lanczos3 and lightly sharpened. Placeholder quality; swap in Joto's originals
// when available. Where no blank photo existed, Joto's sample-design photo is used as-is (owner's
// choice); the Olympics-logo travel-mug photo was deliberately not used.
//
// Held back, not imported: "11oz Sublimation Purple Plated Ceramic Mug" ($149.40, but the page
// doesn't say how many mugs that buys) and "Pearl Coating Sublimation 6oz White..." (only seen in
// the collection grid, name and price cut off).
import type { CatalogueProduct } from "@/lib/products";

const RULE = "house-v1-joto-exact-2026-10-21";
const J = (file: string, colourName: string | null = null) => ({
  url: `/images/products/joto/${file}.webp`,
  colourName,
  imageType: "front",
});

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
    priceTiers: null,
    startingPrice: 77.22,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 77.22 },
          { bundleCount: 60, totalItems: 2160, perItemCad: 1.82, totalCad: 3931.2 },
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
    images: [
      { url: "/images/products/joto/sublimation-mug-15oz-white-case-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 117,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.25, totalCad: 117 },
          { bundleCount: 2, totalItems: 72, perItemCad: 3.12, totalCad: 224.64 },
          { bundleCount: 5, totalItems: 180, perItemCad: 2.99, totalCad: 538.2 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.73, totalCad: 1965.6 },
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
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-navy.webp", colourName: "Navy", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-blue.webp", colourName: "Blue", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-teal.webp", colourName: "Teal", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-lime-green.webp", colourName: "Lime Green", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-pink.webp", colourName: "Pink", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-red.webp", colourName: "Red", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-orange.webp", colourName: "Orange", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-yellow.webp", colourName: "Yellow", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-grey.webp", colourName: "Grey", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-purple.webp", colourName: "Purple", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-11oz-inner-colour-case-36-light-blue.webp", colourName: "Light Blue", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 105.48,
    printRuleVersion: RULE,
    productOptions: [
      {
        name: "Inner colour",
        values: ["Black", "Navy", "Blue", "Teal", "Lime Green", "Pink", "Red", "Orange", "Yellow", "Grey", "Purple", "Light Blue"],
        note: "Colour names confirmed from Joto's per-colour SKUs. Owner confirmed every colour is the same price.",
      },
    ],
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 2.93, totalCad: 105.48 },
          { bundleCount: 2, totalItems: 72, perItemCad: 2.8, totalCad: 201.6 },
          { bundleCount: 6, totalItems: 216, perItemCad: 2.67, totalCad: 576.72 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.54, totalCad: 1828.8 },
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
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36-navy.webp", colourName: "Navy", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36-blue.webp", colourName: "Blue", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36-pink.webp", colourName: "Pink", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36-red.webp", colourName: "Red", imageType: "front" },
      { url: "/images/products/joto/sublimation-mug-15oz-inner-colour-case-36-yellow.webp", colourName: "Yellow", imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 159.12,
    printRuleVersion: RULE,
    productOptions: [
      {
        name: "Inner colour",
        values: ["Black", "Navy", "Blue", "Pink", "Red", "Yellow"],
        note:
          "Names assigned from Joto's photos/swatches (Joto shows an Orange swatch marked unavailable). " +
          "Owner confirmed every colour is the same price.",
      },
    ],
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 4.42, totalCad: 159.12 },
          { bundleCount: 2, totalItems: 72, perItemCad: 4.29, totalCad: 308.88 },
          { bundleCount: 6, totalItems: 216, perItemCad: 4.03, totalCad: 870.48 },
          { bundleCount: 20, totalItems: 720, perItemCad: 3.84, totalCad: 2764.8 },
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
    priceTiers: null,
    startingPrice: 38.99,
    printRuleVersion: RULE,
    productOptions: [{ name: "Inner colour", values: ["Black", "Red"] }],
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 38.99 },
        ],
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
    priceTiers: null,
    startingPrice: 237.12,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 9.88, totalCad: 237.12 },
          { bundleCount: 2, totalItems: 48, perItemCad: 9.38, totalCad: 450.24 },
          { bundleCount: 6, totalItems: 144, perItemCad: 8.75, totalCad: 1260 },
          { bundleCount: 20, totalItems: 480, perItemCad: 8.45, totalCad: 4056 },
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
    priceTiers: null,
    startingPrice: 124.2,
    printRuleVersion: RULE,
    productOptions: [{ name: "Size", values: ["11oz", "15oz"] }],
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        appliesTo: "11oz",
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.45, totalCad: 124.2 },
          { bundleCount: 6, totalItems: 216, perItemCad: 3.25, totalCad: 702 },
          { bundleCount: 20, totalItems: 720, perItemCad: 2.99, totalCad: 2152.8 },
        ],
      },
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        appliesTo: "15oz",
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 4.94, totalCad: 177.84 },
          { bundleCount: 2, totalItems: 72, perItemCad: 4.81, totalCad: 346.32 },
          { bundleCount: 6, totalItems: 216, perItemCad: 4.62, totalCad: 997.92 },
          { bundleCount: 20, totalItems: 720, perItemCad: 4.23, totalCad: 3045.6 },
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
    priceTiers: null,
    startingPrice: 184.86,
    printRuleVersion: RULE,
    productOptions: [
      { name: "Colour", values: ["Pink", "Blue"], note: "Joto shows a third swatch marked unavailable; names inferred from swatch colour — confirm" },
    ],
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 184.86 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-bone-china-mug-gold-rim-pack-6",
    name: "10oz Bone China Sublimation Mug with Gold Rim & Handle — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Elegant 10oz white bone china mug with a gold rim and gold handle, ready for sublimation. " +
      "Sold by the pack of 6 mugs.",
    images: [
      { url: "/images/products/joto/sublimation-bone-china-mug-gold-rim-pack-6.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 92.1,
    printRuleVersion: RULE,
    // Owner chose to skip Joto's 11oz variant (no price captured) — 10oz only.
    productOptions: [{ name: "Size", values: ["10oz"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        appliesTo: "10oz",
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 92.1 },
        ],
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
    priceTiers: null,
    startingPrice: 143.64,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: 3.99, totalCad: 143.64 },
          { bundleCount: 2, totalItems: 72, perItemCad: 3.8, totalCad: 273.6 },
          { bundleCount: 6, totalItems: 216, perItemCad: 3.5, totalCad: 756 },
          { bundleCount: 20, totalItems: 720, perItemCad: 3.19, totalCad: 2296.8 },
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
    priceTiers: null,
    startingPrice: 109.2,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 4.55, totalCad: 109.2 },
          { bundleCount: 2, totalItems: 48, perItemCad: 4.42, totalCad: 212.16 },
          { bundleCount: 6, totalItems: 144, perItemCad: 4.16, totalCad: 599.04 },
          { bundleCount: 20, totalItems: 480, perItemCad: 3.84, totalCad: 1843.2 },
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
    priceTiers: null,
    startingPrice: 154.08,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "case",
        itemsPerBundle: 24,
        tiers: [
          { bundleCount: 1, totalItems: 24, perItemCad: 6.42, totalCad: 154.08 },
          { bundleCount: 2, totalItems: 48, perItemCad: 6.15, totalCad: 295.2 },
          { bundleCount: 6, totalItems: 144, perItemCad: 5.71, totalCad: 822.24 },
          { bundleCount: 20, totalItems: 480, perItemCad: 5.16, totalCad: 2476.8 },
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
    priceTiers: null,
    startingPrice: 71.4,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: 5.95, totalCad: 71.4 },
          { bundleCount: 4, totalItems: 48, perItemCad: 5.82, totalCad: 279.36 },
          { bundleCount: 8, totalItems: 96, perItemCad: 5.65, totalCad: 542.4 },
          { bundleCount: 20, totalItems: 240, perItemCad: 5.46, totalCad: 1310.4 },
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
    images: [
      { url: "/images/products/joto/sublimation-enamel-camp-cup-17oz-flat-bottom-pack-6.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 43.38,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 7.23, totalCad: 43.38 },
          { bundleCount: 2, totalItems: 12, perItemCad: 6.83, totalCad: 81.96 },
          { bundleCount: 4, totalItems: 24, perItemCad: 6.46, totalCad: 155.04 },
          { bundleCount: 8, totalItems: 48, perItemCad: 6.02, totalCad: 288.96 },
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
      { url: "/images/products/joto/sublimation-stainless-coffee-cup-13oz-lid-pack-5-o1.webp", colourName: null, imageType: "front" },
      { url: "/images/products/joto/sublimation-stainless-coffee-cup-13oz-lid-pack-5.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 81.5,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 16.3, totalCad: 81.5 },
          { bundleCount: 2, totalItems: 10, perItemCad: 15.38, totalCad: 153.8 },
          { bundleCount: 4, totalItems: 20, perItemCad: 14.55, totalCad: 291 },
          { bundleCount: 8, totalItems: 40, perItemCad: 13.58, totalCad: 543.2 },
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
    images: [
      { url: "/images/products/joto/sublimation-travel-mug-14oz-stainless-pack-6.webp", colourName: null, imageType: "front" },
      { url: "/images/products/joto/sublimation-travel-mug-14oz-stainless-pack-6-alt.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 65.46,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 10.91, totalCad: 65.46 },
          { bundleCount: 4, totalItems: 24, perItemCad: 10.9, totalCad: 261.6 },
          { bundleCount: 11, totalItems: 66, perItemCad: 10.53, totalCad: 694.98 },
          { bundleCount: 20, totalItems: 120, perItemCad: 10.16, totalCad: 1219.2 },
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
    images: [
      { url: "/images/products/joto/sublimation-travel-mug-17oz.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 13.31,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "unit",
        itemsPerBundle: 1,
        tiers: [
          { bundleCount: 1, totalItems: 1, perItemCad: 13.31, totalCad: 13.31 },
          { bundleCount: 24, totalItems: 24, perItemCad: 13.14, totalCad: 315.36 },
          { bundleCount: 48, totalItems: 48, perItemCad: 12.96, totalCad: 622.08 },
          { bundleCount: 120, totalItems: 120, perItemCad: 12.61, totalCad: 1513.2 },
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
    priceTiers: null,
    startingPrice: 68.45,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Black", "White"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 13.69, totalCad: 68.45 },
          { bundleCount: 3, totalItems: 15, perItemCad: 13.27, totalCad: 199.05 },
          { bundleCount: 5, totalItems: 25, perItemCad: 12.88, totalCad: 322 },
          { bundleCount: 10, totalItems: 50, perItemCad: 12.49, totalCad: 624.5 },
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
    images: [
      { url: "/images/products/joto/sublimation-mug-starter-pack-11oz-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 116.99,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 116.99 },
        ],
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
    images: [
      { url: "/images/products/joto/sublimation-mug-starter-pack-15oz-36.webp", colourName: null, imageType: "front" },
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 181.99,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 36,
        tiers: [
          { bundleCount: 1, totalItems: 36, perItemCad: null, totalCad: 181.99 },
        ],
      },
    ],
  },

  // --- Batch 2 (2026-10-21): tumblers, glassware, bottles --------------------------------------
  {
    slug: "sublimation-skinny-tumbler-20oz-straw-pack-5",
    name: "20oz Stainless Steel Sublimation Tumbler with Straw & Lid — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "20oz white stainless steel skinny tumbler with a removable slide-close plastic lid and a stainless steel " +
      "straw. For hot or cold drinks; sublimate with shrink sleeves and a convection oven. Sold by the pack of 5.",
    images: [J("sublimation-skinny-tumbler-20oz-straw-pack-5")],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 77.8,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 15.56, totalCad: 77.8 },
          { bundleCount: 2, totalItems: 10, perItemCad: 14.94, totalCad: 149.4 },
          { bundleCount: 5, totalItems: 25, perItemCad: 13.69, totalCad: 342.25 },
          { bundleCount: 15, totalItems: 75, perItemCad: 13.06, totalCad: 979.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-glitter-skinny-tumbler-20oz-silver-pack-5",
    name: "20oz Glitter Silver Sublimation Skinny Tumbler with Straw & Lid — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "20oz (600ml) stainless steel skinny tumbler with a sparkling silver glitter finish, straw and lid, ready " +
      "for sublimation. Sold by the pack of 5.",
    images: [
      J("sublimation-glitter-skinny-tumbler-20oz-silver-pack-5", "Silver"),
      J("sublimation-glitter-skinny-tumbler-20oz-silver-pack-5-design", "Silver"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 84.95,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Silver"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 84.95 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-tumbler-40oz-handle-pack-5",
    name: "40oz White Stainless Steel Sublimation Travel Tumbler with Handle — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "40oz (1200ml) white stainless steel travel tumbler with a clear flat lid, straw and comfortable handle, " +
      "ready for sublimation. Sold by the pack of 5.",
    images: [J("sublimation-travel-tumbler-40oz-handle-pack-5")],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 81.2,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 16.24, totalCad: 81.2 },
          { bundleCount: 2, totalItems: 10, perItemCad: 14.99, totalCad: 149.9 },
          { bundleCount: 4, totalItems: 20, perItemCad: 14.36, totalCad: 287.2 },
          { bundleCount: 12, totalItems: 60, perItemCad: 13.74, totalCad: 824.4 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-white-pack-5",
    name: "20oz White Stainless Steel Sublimation Tumbler — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "20oz double-wall vacuum-insulated white stainless steel tumbler with a plastic lid (the lid does not close), " +
      "ready for sublimation. Its shape is not suited to full-wrap designs in a convection oven. Sold by the pack of 5.",
    images: [
      J("sublimation-tumbler-20oz-white-pack-5"),
      J("sublimation-tumbler-20oz-white-pack-5-o1"),
      J("sublimation-tumbler-20oz-white-pack-5-o2"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 83.2,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 16.64, totalCad: 83.2 },
          { bundleCount: 3, totalItems: 15, perItemCad: 16.26, totalCad: 243.9 },
          { bundleCount: 5, totalItems: 25, perItemCad: 15.99, totalCad: 399.75 },
          { bundleCount: 10, totalItems: 50, perItemCad: 15.53, totalCad: 776.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-silver-pack-5",
    name: "20oz Silver Stainless Steel Sublimation Tumbler — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "20oz double-wall vacuum-insulated silver stainless steel tumbler with a plastic lid (the lid does not close), " +
      "ready for sublimation. Its shape is not suited to full-wrap designs in a convection oven. Sold by the pack of 5.",
    images: [
      J("sublimation-tumbler-20oz-silver-pack-5"),
      J("sublimation-tumbler-20oz-silver-pack-5-o1"),
      J("sublimation-tumbler-20oz-silver-pack-5-o2"),
      J("sublimation-tumbler-20oz-silver-pack-5-o3"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 83.2,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 16.64, totalCad: 83.2 },
          { bundleCount: 3, totalItems: 15, perItemCad: 16.26, totalCad: 243.9 },
          { bundleCount: 5, totalItems: 25, perItemCad: 15.99, totalCad: 399.75 },
          { bundleCount: 10, totalItems: 50, perItemCad: 15.53, totalCad: 776.5 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-16oz-silver-pack-6",
    name: "16oz Silver Stainless Steel Sublimation Tumbler — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "16oz silver stainless steel tumbler with a black flip lid — a durable, reusable alternative to disposable " +
      "cups that keeps drinks hot or cold. Sublimate with a 17oz latte mug wrap on a mug press. Sold by the pack of 6.",
    images: [
      J("sublimation-tumbler-16oz-silver-pack-6-o1", "Silver"),
      J("sublimation-tumbler-16oz-silver-pack-6-o2", "Silver"),
      J("sublimation-tumbler-16oz-silver-pack-6-o3", "Silver"),
      J("sublimation-tumbler-16oz-silver-pack-6-o4", "Silver"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 91.68,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Silver"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: 15.28, totalCad: 91.68 },
          { bundleCount: 2, totalItems: 12, perItemCad: 14.84, totalCad: 178.08 },
          { bundleCount: 4, totalItems: 24, perItemCad: 14.38, totalCad: 345.12 },
          { bundleCount: 12, totalItems: 72, perItemCad: 13.71, totalCad: 987.12 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-tumbler-20oz-portable-lid-pack-4",
    name: "20oz White Stainless Steel Sublimation Tumbler with Portable Lid — Pack of 4",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "20oz double-wall vacuum-insulated white stainless steel tumbler with a portable straw lid and carry strap, " +
      "ready for sublimation. Its shape is not suited to full-wrap designs in a convection oven. Sold by the pack of 4.",
    images: [
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o1"),
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o2"),
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o3"),
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o4"),
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o5"),
      J("sublimation-tumbler-20oz-portable-lid-pack-4-o6"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 69.96,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 4,
        tiers: [
          { bundleCount: 1, totalItems: 4, perItemCad: 17.49, totalCad: 69.96 },
          { bundleCount: 2, totalItems: 8, perItemCad: 16.24, totalCad: 129.92 },
          { bundleCount: 6, totalItems: 24, perItemCad: 14.99, totalCad: 359.76 },
          { bundleCount: 10, totalItems: 40, perItemCad: 14.74, totalCad: 589.6 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-travel-tumbler-25oz-metal-handle-pack-5",
    name: "25oz Stainless Steel Sublimation Travel Tumbler with Metal Handle — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description:
      "25oz (750ml) white stainless steel travel tumbler with a clear flat lid and a metal handle, ready for " +
      "sublimation. Sold by the pack of 5.",
    images: [J("sublimation-travel-tumbler-25oz-metal-handle-pack-5-o1")],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 92.7,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 92.7 },
        ],
      },
    ],
  },
  {
    slug: "engraving-skinny-tumbler-20oz-straw-pack-5",
    name: "20oz Powder-Coated Stainless Steel Engraving Tumbler with Straw — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "engraved-personalized",
    description:
      "20oz (600ml) double-wall 304 stainless steel skinny tumbler with a powder-coated finish, straw and waterproof " +
      "flip lid — made for laser engraving. Fits most car cup holders. Hand wash recommended. Sold by the pack of 5.",
    images: [
      J("engraving-skinny-tumbler-20oz-straw-pack-5-black", "Black"),
      J("engraving-skinny-tumbler-20oz-straw-pack-5-o1"),
      J("engraving-skinny-tumbler-20oz-straw-pack-5-white-o1", "White"),
      J("engraving-skinny-tumbler-20oz-straw-pack-5-mint-green-o1", "Mint Green"),
      J("engraving-skinny-tumbler-20oz-straw-pack-5-royal-blue-o1", "Royal Blue"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 60.95,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Black", "White", "Mint Green", "Royal Blue"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: 12.19, totalCad: 60.95 },
          { bundleCount: 3, totalItems: 15, perItemCad: 11.83, totalCad: 177.45 },
          { bundleCount: 5, totalItems: 25, perItemCad: 11.46, totalCad: 286.5 },
          { bundleCount: 10, totalItems: 50, perItemCad: 11.13, totalCad: 556.5 },
        ],
      },
    ],
  },
  {
    slug: "engraving-travel-tumbler-40oz-straw-pack-5",
    name: "40oz Powder-Coated Stainless Steel Engraving Travel Tumbler with Straw — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "engraved-personalized",
    description:
      "40oz (1200ml) double-wall vacuum-insulated powder-coated stainless steel travel tumbler with handle, lid and " +
      "straw — made for laser engraving or printing. Sold by the pack of 5.",
    images: [
      J("engraving-travel-tumbler-40oz-straw-pack-5-black", "Black"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-black-o1", "Black"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-black-o2", "Black"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-white-o2", "White"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-white-o1", "White"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-white-o3", "White"),
      J("engraving-travel-tumbler-40oz-straw-pack-5-white-o4", "White"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 79.69,
    printRuleVersion: RULE,
    productOptions: [{ name: "Colour", values: ["Black", "White"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 79.69 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-frosted-glass-skinny-tumbler-20oz-pack-6",
    name: "20oz Frosted Glass Sublimation Skinny Tumbler with Straw & Bamboo Lid — Pack of 6",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "glassware",
    description:
      "20oz frosted glass skinny tumbler with a bamboo lid and straw — an eco-friendly, on-the-go glass ready for " +
      "sublimation. Sold by the pack of 6.",
    images: [
      J("sublimation-frosted-glass-skinny-tumbler-20oz-pack-6-o1"),
      J("sublimation-frosted-glass-skinny-tumbler-20oz-pack-6-o2"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 32.76,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 6,
        tiers: [
          { bundleCount: 1, totalItems: 6, perItemCad: null, totalCad: 32.76 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-frosted-glass-skinny-tumbler-17oz-pack-12",
    name: "17oz Frosted Glass Sublimation Skinny Tumbler with Straw & Bamboo Lid — Pack of 12",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "glassware",
    description:
      "17oz (500ml) frosted glass skinny tumbler with a straw and bamboo lid, ready for sublimation. Sold by the " +
      "pack of 12.",
    images: [J("sublimation-frosted-glass-skinny-tumbler-17oz-pack-12-o1")],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 90.48,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 90.48 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-glass-can-18oz-bamboo-lid-pack-12",
    name: "18oz Sublimation Glass Can with Bamboo Lid — Pack of 12",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "glassware",
    description:
      "18oz (550ml) glass can with a bamboo lid and straw — the perfect size for iced coffee or tea. Available " +
      "frosted or clear. Not dishwasher or microwave safe. Sold by the pack of 12.",
    images: [
      J("sublimation-glass-can-18oz-bamboo-lid-pack-12-frosted-o1", "Frosted"),
      J("sublimation-glass-can-18oz-bamboo-lid-pack-12-frosted-o2", "Frosted"),
      J("sublimation-glass-can-18oz-bamboo-lid-pack-12-clear-o1", "Clear"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 70.2,
    printRuleVersion: RULE,
    productOptions: [{ name: "Finish", values: ["Frosted", "Clear"] }],
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        appliesTo: "Frosted",
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 70.2 },
        ],
      },
      {
        sellUnit: "pack",
        itemsPerBundle: 12,
        appliesTo: "Clear",
        tiers: [
          { bundleCount: 1, totalItems: 12, perItemCad: null, totalCad: 70.2 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-stainless-coffee-cup-12oz-lid-pack-5",
    name: "12oz Stainless Steel Sublimation Coffee Cup with Lid — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "12oz white stainless steel coffee cup with a handle and clear lid — great for outdoor enthusiasts. Approx. " +
      "4\" tall (without lid) x 3.5\" wide. Ready for sublimation. Sold by the pack of 5.",
    images: [
      J("sublimation-stainless-coffee-cup-12oz-lid-pack-5-o2"),
      J("sublimation-stainless-coffee-cup-12oz-lid-pack-5-o1"),
      J("sublimation-stainless-coffee-cup-12oz-lid-pack-5-o3"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 79.56,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 79.56 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-pop-lid-bottle-17oz-pack-10",
    name: "17oz White Stainless Steel Sublimation Pop-Lid Bottle — Pack of 10",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "bottles",
    description:
      "17oz (500ml) white stainless steel bottle with a push-button pop-up lid, ready for full-wrap sublimation. " +
      "Sold by the pack of 10.",
    images: [
      J("sublimation-pop-lid-bottle-17oz-pack-10"),
      J("sublimation-pop-lid-bottle-17oz-pack-10-o1"),
      J("sublimation-pop-lid-bottle-17oz-pack-10-o2"),
    ],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 171.88,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 10,
        tiers: [
          { bundleCount: 1, totalItems: 10, perItemCad: null, totalCad: 171.88 },
        ],
      },
    ],
  },
  {
    slug: "sublimation-bottle-17oz-cup-lid-pack-5",
    name: "17oz Stainless Steel Sublimation Bottle with Cup Lid — Pack of 5",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "bottles",
    description:
      "17oz (500ml) double-wall white stainless steel flask with a lid that doubles as a cup, ready for " +
      "sublimation. Keeps drinks hot or cold for longer. Sold by the pack of 5.",
    images: [J("sublimation-bottle-17oz-cup-lid-pack-5"), J("sublimation-bottle-17oz-cup-lid-pack-5-o1")],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: 82.81,
    printRuleVersion: RULE,
    bundlePricing: [
      {
        sellUnit: "pack",
        itemsPerBundle: 5,
        tiers: [
          { bundleCount: 1, totalItems: 5, perItemCad: null, totalCad: 82.81 },
        ],
      },
    ],
  },
];
