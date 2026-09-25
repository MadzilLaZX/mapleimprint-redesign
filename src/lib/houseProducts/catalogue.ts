// Maple's own house-produced products (not sourced from SanMar/S&S) — merged into PRODUCTS in
// src/lib/products.ts. One row per sellable line, not per stock/size (stock/size is an in-page
// configuration choice — ProductCustomizer branches on houseProductKind to render
// BannerConfigurator/PaperProductConfigurator instead of the apparel colour/quantity UI).
//
// priceTiers is deliberately null on every entry here — that's what suppresses the generic
// apparel "Blank $X / Customize from $Y" headline (ProductDetail.tsx) and "Pricing by quantity"
// table (the product-detail page) for free, since both already gate on `priceTiers !== null`.
// These products get their own price display from the house pricing modules instead
// (src/lib/houseProducts/pricing/), since the real pricing is 2-D and doesn't fit that 1-D shape.
// startingPrice is a real computed "from" figure (cheapest real configuration, margin applied)
// for the shop-grid tile only.
import type { CatalogueProduct } from "@/lib/products";
import { applyHouseMargin } from "./pricing/margin";

export const HOUSE_PRODUCTS: CatalogueProduct[] = [
  {
    slug: "vinyl-banner",
    name: "Vinyl Banner",
    brandName: "Maple Imprint",
    categorySlug: "signs-banners",
    subcategorySlug: "vinyl-banners",
    description:
      "Custom vinyl banners printed and finished in Ottawa, from 1'x2' up to 8'x30'. Choose your " +
      "material, add grommets or reinforced edges, and design your artwork right here — the same " +
      "way you'd design a custom t-shirt.",
    images: [{ url: "/images/products/subcategories/signs-banners/vinyl-banners.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: applyHouseMargin(6.99),
    printRuleVersion: "house-v1-vistaprint-2026-09-25",
    houseProductKind: "banner",
  },
  {
    slug: "business-cards",
    name: "Business Cards",
    brandName: "Maple Imprint",
    categorySlug: "business-printing",
    subcategorySlug: "business-cards",
    description:
      "Custom business cards on your choice of 13 paper stocks, single or double-sided. Design " +
      "your card right here, from a first proof to a finished, print-ready file.",
    images: [{ url: "/images/products/subcategories/business-printing/business-cards.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: applyHouseMargin(10.0),
    printRuleVersion: "house-v1-vistaprint-2026-09-25",
    houseProductKind: "business-card",
  },
  {
    slug: "flyers",
    name: "Flyers",
    brandName: "Maple Imprint",
    categorySlug: "business-printing",
    subcategorySlug: "brochures-flyers",
    description:
      "Custom 8.5\" x 11\" flyers on your choice of paper and thickness, single or double-sided. " +
      "Design your flyer right here, from a first draft to a finished, print-ready file.",
    images: [{ url: "/images/products/subcategories/business-printing/brochures-flyers.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: applyHouseMargin(25.99),
    printRuleVersion: "house-v1-vistaprint-2026-09-25",
    houseProductKind: "flyer",
  },
];
