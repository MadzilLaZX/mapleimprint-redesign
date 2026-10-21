// Draft catalogue additions: sublimation blanks sourced from Joto Imaging Supplies Canada
// (jotoimagingsupplies.ca), added beyond the original xTool M1 sheet per the owner's explicit
// instruction to pull in Joto's full catalog, not just engraving blanks. Follows the same
// CatalogueProduct shape/draft conventions as printCatalogueDraft.ts / engravingCatalogDraft.ts.
//
// Every entry is `status: "draft"` — hidden from category/subcategory listings, sitemap, and
// 404s at its own product URL (src/lib/products.ts / the product detail route), same as every
// other draft import this session, until the owner reviews and publishes.
//
// Pricing: Joto has no "suggested sell" column (unlike the xTool sheet), so startingPrice here is
// derived with applyHouseMargin() over each item's per-unit blank cost (regular price ÷ pack
// size, not sale price — see jotoBlanksInternalOnly.ts header). Internal cost/pack/source data is
// kept out of this file entirely — see jotoBlanksInternalOnly.ts (same directory, never imported
// by this file or by catalogue.ts).
//
// COVERAGE NOTE: jotoimagingsupplies.ca blocks direct page/API fetches, so this list was built
// from web-search snippets, not a full programmatic catalog pull. It's a representative sample of
// Joto's sublimation-blank range (bookmarks, photo panels/ornaments, pot holders, keychains), not
// their entire catalog. Equipment (heat presses, printers, cutters) and raw supplies (vinyl, DTF
// film, ink, paper) were deliberately excluded — those are production inputs, not finished
// products to sell. License plates, mugs-by-the-case, phone cases, and pet accessories were found
// to exist on the site but had no reliable price snippet, so they were left out rather than
// guessed — see the task report for the full skip list.
import type { CatalogueProduct } from "@/lib/products";
import { applyHouseMargin } from "./pricing/margin";

export const JOTO_BLANKS_CATALOGUE_DRAFT: CatalogueProduct[] = [
  {
    slug: "sublimation-aluminum-bookmark",
    name: "Sublimation aluminum bookmark",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "stationery",
    description: "A full-colour, dye-sublimated aluminum bookmark — durable and printable edge to edge. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(2.49),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-acrylic-photo-panel",
    name: "Sublimation acrylic photo panel",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "photo-panels",
    description: "A full-colour photo printed onto a glossy acrylic panel. Available in 5x7\", 8x10\" and 10x14\" — size confirmed at order.",
    images: [],
    colours: [],
    sizes: ["5x7\"", "8x10\"", "10x14\""],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(8.3),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-aluminum-photo-panel",
    name: "Sublimation aluminum photo panel",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "photo-panels",
    description: "An HD photo printed onto a durable aluminum panel, ready to hang. Starting size 4x6\" — larger sizes up to 20x20\" available, priced on request.",
    images: [],
    colours: [],
    sizes: ["4x6\"", "5x7\"", "8x10\"", "12x18\"", "20x20\""],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(2.85),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-pot-holder-pearl-coating",
    name: "Personalized kitchen pot holder",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "kitchen-gifts",
    description: "A heat-resistant fabric pot holder, full-colour printed with your photo or design. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(4.01),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-pot-holder-craft-express",
    name: "Personalized pot holder with pocket",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "kitchen-gifts",
    description: "A heat-resistant pot holder with a built-in pocket, full-colour printed with your photo or design. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(4.995),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-pot-holder-double-mitts",
    name: "Personalized double oven mitt pot holder",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "kitchen-gifts",
    description: "A long double-mitt style pot holder, full-colour printed with your photo or design. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(5.95),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-keychain-rectangle",
    name: "Sublimation rectangle keychain",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "keychains",
    description: "A white polymer rectangle keychain, full-colour printed on one side. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(1.499),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-keychain-leather",
    name: "Sublimation leather keychain",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "keychains",
    description: "A polyurethane-coated leather keychain, full-colour printed on one side. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(3.15),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-ceramic-ornament",
    name: "Sublimation ceramic ornament",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "ornaments",
    description: "A full-colour, dye-sublimated ceramic ornament. Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(2.39),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
  {
    slug: "sublimation-photo-ornament",
    name: "Sublimation HD photo ornament",
    brandName: "Maple Imprint",
    categorySlug: "personalized-engraving",
    subcategorySlug: "ornaments",
    description: "A full-colour photo ornament, available in five shapes (round, oval, star, heart, snowflake — confirmed at order). Sold individually.",
    images: [],
    colours: [],
    sizes: [],
    variants: [],
    status: "draft",
    priceTiers: null,
    startingPrice: applyHouseMargin(1.88),
    printRuleVersion: "house-v1-joto-2026-10-21",
  },
];
