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
import { quoteSticker } from "./pricing/stickers";
import { quoteLabel } from "./pricing/labels";
import { quotePoster } from "./pricing/posters";
import { quoteDrinkware } from "./pricing/drinkware";
import { quotePromo } from "./pricing/promo";
import { isQuoteError } from "./pricing/types";

/** Pulls a real "from" unit price out of a quote function at its cheapest realistic configuration,
 *  for the shop-grid tile — same role applyHouseMargin(rawPrice) plays for banner/card/flyer above,
 *  just computed through the real quote function instead of a bare constant since these newer
 *  modules don't expose one flat "cheapest" number directly. */
function fromPrice<T extends { unitPriceCents: number }>(quote: T | { error: string }): number {
  if (isQuoteError(quote)) return 0;
  return quote.unitPriceCents / 100;
}

export const HOUSE_PRODUCTS: CatalogueProduct[] = [
  {
    slug: "vinyl-banner",
    name: "Vinyl Banner",
    brandName: "Maple Imprint",
    categorySlug: "signs-banners",
    subcategorySlug: "vinyl-banners",
    description:
      "Custom vinyl banners printed and finished in Ottawa, from 1'x2' up to 30' on the long side — " +
      "horizontal for storefronts and stages, vertical for poles and doorways. Choose your " +
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

  // --- Stickers & Labels ---------------------------------------------------------------------
  {
    slug: "die-cut-stickers",
    name: "Die-Cut Stickers",
    brandName: "Maple Imprint",
    categorySlug: "stickers-labels",
    subcategorySlug: "die-cut",
    description:
      "Stickers cut precisely to your artwork's outline, not a fixed square or circle — from 2\" up " +
      "to 5\" on the long edge, on white plastic, white paper, clear plastic or holographic stock. " +
      "Design your shape right here.",
    images: [{ url: "/images/products/subcategories/stickers-labels/die-cut.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteSticker({ shape: "die-cut", sizeKey: "2x2", material: "white-plastic", quantity: 10 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "sticker",
  },
  {
    slug: "kiss-cut-stickers",
    name: "Kiss-Cut Stickers",
    brandName: "Maple Imprint",
    categorySlug: "stickers-labels",
    subcategorySlug: "kiss-cut",
    description:
      "Individual stickers on an easy-peel backing — square, circle, rectangle or oval, in white " +
      "plastic, white paper, clear plastic, gold foil, silver foil or holographic. Design yours right here.",
    images: [{ url: "/images/products/subcategories/stickers-labels/kiss-cut.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteSticker({ shape: "square", sizeKey: "1.5x1.5", material: "white-plastic", quantity: 10 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "sticker",
  },
  {
    slug: "product-labels-sheets",
    name: "Product Labels (Sheets)",
    brandName: "Maple Imprint",
    categorySlug: "stickers-labels",
    subcategorySlug: "sheets",
    description:
      "Multiple labels per 8.5\"x11\" sheet, in rounded rectangle, circle, oval, rounded square or a " +
      "custom die-cut shape — built for product packaging and jars. Tell us your size, shape and " +
      "quantity and we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/subcategories/stickers-labels/sheets.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      sizes: ["1\"x1\"", "1\"x2\"", "1\"x3\"", "1.5\"x1.5\"", "2\"x2\"", "2\"x3\"", "2.5\"x2.5\"", "3\"x3\"", "3\"x4\"", "3\"x5\"", "4\"x4\"", "4\"x6\"", "5\"x5\"", "and more — 18 sizes total"],
      materials: ["Rounded rectangle", "Circle", "Oval", "Rounded square", "Custom die-cut shape", "Water-resistant plastic available"],
    },
  },
  {
    slug: "roll-labels",
    name: "Custom Roll Labels",
    brandName: "Maple Imprint",
    categorySlug: "stickers-labels",
    subcategorySlug: "roll-labels",
    description:
      "Circle, square or rounded-square paper labels on a roll — built for applicators and " +
      "high-volume packaging runs, from 1\"x1\" up to 5\"x5\". Design yours right here.",
    images: [{ url: "/images/products/subcategories/stickers-labels/sheets.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteLabel({ sizeKey: "1x1", material: "white-paper", format: "multi-column-roll", quantity: 1000 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "label",
  },

  // --- Posters (Business Printing) ------------------------------------------------------------
  {
    slug: "posters",
    name: "Posters",
    brandName: "Maple Imprint",
    categorySlug: "business-printing",
    subcategorySlug: "posters",
    description:
      "Custom posters from 8.5\"x11\" up to 36\"x48\", horizontal or vertical. Design yours right " +
      "here and see it sized next to a real person before you order.",
    images: [{ url: "/images/products/subcategories/business-printing/posters.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePoster({ sizeKey: "8.5x11", quantity: 1 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "poster",
  },

  // --- Signs (Signs & Banners) -----------------------------------------------------------------
  {
    slug: "yard-signs",
    name: "Yard Signs",
    brandName: "Maple Imprint",
    categorySlug: "signs-banners",
    subcategorySlug: "outdoor-signs",
    description:
      "Corrugated plastic yard signs for real estate, elections and events — 19 real sizes from " +
      "5\"x18\" up to 48\"x96\", with wire or plastic stake mounting. Tell us your size, quantity and " +
      "mounting option and we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/subcategories/signs-banners/outdoor-signs.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      sizes: ["9\"x12\"", "12\"x18\"", "18\"x24\"", "18\"x30\"", "24\"x24\"", "24\"x36\"", "48\"x72\"", "48\"x96\"", "and more — 19 sizes total"],
      materials: ["4mm corrugated plastic (coroplast)", "weather/fade/UV-resistant", "optional scratch-resistant glossy coating", "wire or plastic stake mounting"],
    },
  },
  {
    slug: "rigid-signs",
    name: "Rigid & Foam Board Signs",
    brandName: "Maple Imprint",
    categorySlug: "signs-banners",
    subcategorySlug: "indoor-signs",
    description:
      "Foam board, PVC, aluminum composite, acrylic or wood signs for storefronts, offices and " +
      "trade shows, up to 24\"x48\". Tell us your size, material and quantity and we'll send a firm " +
      "quote within one business day.",
    images: [{ url: "/images/products/subcategories/signs-banners/indoor-signs.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      sizes: ["11\"x17\"", "16\"x20\"", "18\"x24\"", "22\"x28\"", "24\"x36\"", "24\"x48\"", "custom sizes available"],
      materials: ["5mm PVC foam board", "3mm PVC-free foam", "3mm/6mm rigid PVC plastic", "aluminum composite", "acrylic", "plywood/MDF"],
    },
  },
  {
    slug: "window-clings-decals",
    name: "Window Clings & Decals",
    brandName: "Maple Imprint",
    categorySlug: "signs-banners",
    subcategorySlug: "decals",
    description:
      "Removable window decals, repositionable window clings, wall decals and floor decals. Tell us " +
      "your size and surface and we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/subcategories/signs-banners/decals.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      materials: [
        "Removable vinyl window decals (semi-permanent, inside/outside glass)",
        "Repositionable PVC window clings",
        "One-way-vision perforated window vinyl",
        "Wall decals (drywall)",
        "Floor decals",
      ],
    },
  },

  // --- Drinkware -------------------------------------------------------------------------------
  {
    slug: "ceramic-mugs",
    name: "Ceramic Mugs",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "mugs",
    description:
      "Custom ceramic coffee mugs from 11oz to 16oz, dishwasher and microwave safe. Design yours " +
      "right here.",
    images: [{ url: "/images/products/subcategories/drinkware/mugs.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteDrinkware({ kind: "mug", variantKey: "12oz", quantity: 36 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "drinkware-mug",
  },
  {
    slug: "stainless-tumblers",
    name: "Stainless Steel Tumblers",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    description: "Custom insulated tumblers from 14oz to 40oz. Design yours right here.",
    images: [{ url: "/images/products/subcategories/drinkware/tumblers.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteDrinkware({ kind: "tumbler", variantKey: "14oz", quantity: 25 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "drinkware-tumbler",
  },
  {
    slug: "insulated-water-bottles",
    name: "Insulated Water Bottles",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "bottles",
    description: "Custom sports and insulated water bottles from 20oz to 27oz. Design yours right here.",
    images: [{ url: "/images/products/subcategories/drinkware/bottles.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteDrinkware({ kind: "water-bottle", variantKey: "20oz", quantity: 100 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "drinkware-water-bottle",
  },
  {
    slug: "pint-glasses",
    name: "Pint Glasses",
    brandName: "Maple Imprint",
    categorySlug: "drinkware",
    subcategorySlug: "glassware",
    description: "Custom pint, frosted and pilsner glasses from 16oz to 20oz. Design yours right here.",
    images: [{ url: "/images/products/drinkware.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quoteDrinkware({ kind: "pint-glass", variantKey: "16oz-pint", quantity: 6 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "drinkware-pint-glass",
  },

  // --- Gifts & Promotional Products --------------------------------------------------------------
  {
    slug: "tote-bags",
    name: "Tote Bags",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "bags",
    description: "Custom non-woven polypropylene tote bags, screen printed with your logo. Design yours right here.",
    images: [{ url: "/images/products/gifts-promo.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "tote-bag", variantKey: "non-woven", quantity: 50 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-tote-bag",
  },
  {
    slug: "promotional-pens",
    name: "Promotional Pens",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "stationery",
    description: "Custom ballpoint pens — wrap-print, metal-engraved or metallic finish. Design yours right here.",
    images: [{ url: "/images/products/subcategories/gifts-promo/stationery.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "pen", variantKey: "wrap-ballpoint", quantity: 50 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-pen",
  },
  {
    slug: "notebooks-journals",
    name: "Notebooks & Journals",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "stationery",
    description: "Custom notebooks and journals — A5 softcover, classic journal or spiral-bound. Design yours right here.",
    images: [{ url: "/images/products/subcategories/gifts-promo/stationery.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "notebook", variantKey: "a5-softcover", quantity: 25 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-notebook",
  },
  {
    slug: "keychains",
    name: "Keychains",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "keychains",
    description: "Custom engraved metal carabiner keychains. Design yours right here.",
    images: [{ url: "/images/products/gifts-promo.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "keychain", variantKey: "carabiner", quantity: 50 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-keychain",
  },
  {
    slug: "custom-magnets",
    name: "Custom Magnets",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "magnets",
    description: "Custom fridge magnets and jumbo power clip magnets. Design yours right here.",
    images: [{ url: "/images/products/subcategories/gifts-promo/magnets.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "magnet", variantKey: "power-clip", quantity: 18 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-magnet",
  },
  {
    slug: "phone-stands",
    name: "Phone Stands",
    brandName: "Maple Imprint",
    categorySlug: "gifts-promo",
    subcategorySlug: "tech-accessories",
    description: "Custom foldable and slim adjustable phone stands. Design yours right here.",
    images: [{ url: "/images/products/gifts-promo.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: fromPrice(quotePromo({ kind: "phone-stand", variantKey: "slim-adjustable", quantity: 25 })),
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "promo-phone-stand",
  },

  // --- Packaging ---------------------------------------------------------------------------------
  {
    slug: "custom-product-boxes",
    name: "Custom Product Boxes",
    brandName: "Maple Imprint",
    categorySlug: "packaging",
    subcategorySlug: "product-boxes",
    description:
      "Reverse tuck and lock-bottom product boxes on 19pt coated white paperboard, matte, soft-touch " +
      "or gloss finish. Tell us your size and quantity and we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/business-printing.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      materials: ["19pt coated white paperboard", "Matte, Soft Touch or Gloss finish", "Reverse tuck (73 sizes) or lock-bottom (18 sizes)"],
    },
  },
  {
    slug: "mailer-shipping-boxes",
    name: "Mailer & Shipping Boxes",
    brandName: "Maple Imprint",
    categorySlug: "packaging",
    subcategorySlug: "mailer-shipping-boxes",
    description:
      "Custom mailer boxes, full-print inside and out, from 5\"x3\"x1.5\" up to 14\"x12\"x5\" — " +
      "starting around $13. Tell us your size and quantity and we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/business-printing.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: {
      sizes: ["5\"x3\"x1.5\"", "6\"x4\"x3\"", "8\"x6\"x3\"", "9\"x7\"x2.25\"", "12\"x10\"x4\"", "14\"x12\"x5\"", "and more — 13 sizes total"],
      materials: ["1/16\" white E-flute cardboard, 32 ECT", "all-over or logo print, inside/outside/both"],
    },
  },
  {
    slug: "custom-tissue-paper",
    name: "Custom Tissue Paper",
    brandName: "Maple Imprint",
    categorySlug: "packaging",
    subcategorySlug: "tissue-paper",
    description:
      "Branded tissue paper for gift wrapping and unboxing. Tell us your quantity and we'll send a " +
      "firm quote within one business day.",
    images: [{ url: "/images/products/business-printing.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: { materials: ["White or Kraft", "10#, 18# or 30# weight", "single-sided print"] },
  },
  {
    slug: "packaging-tape",
    name: "Custom Packaging Tape",
    brandName: "Maple Imprint",
    categorySlug: "packaging",
    subcategorySlug: "packaging-tape",
    description:
      "Branded poly packaging tape, 2.81\" wide, in 165ft or 330ft rolls. Tell us your quantity and " +
      "we'll send a firm quote within one business day.",
    images: [{ url: "/images/products/business-printing.jpg", colourName: null, imageType: "front" }],
    colours: [],
    sizes: [],
    variants: [],
    priceTiers: null,
    startingPrice: null,
    printRuleVersion: "house-v1-vistaprint-2026-10-06",
    houseProductKind: "quote-only",
    quoteOnlyInfo: { materials: ["Clear or white plastic", "165ft or 330ft roll", "logo-repeat spacing from 3\" to 12\""] },
  },
];
