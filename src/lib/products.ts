// Typed access to the generated product catalogue (src/lib/generated/products.json), produced by
// catalogue-engine/scripts/export-products-for-frontend.mjs from real, live supplier data. This
// file has no database/network dependency — it's a static import, same pattern as constants.ts
// elsewhere in this app. Re-run the export script and rebuild to pick up catalogue changes.

import rawProducts from "./generated/products.json";
import { slugify } from "./slugify";
import { HOUSE_PRODUCTS } from "./houseProducts/catalogue";

export interface ProductImage {
  url: string;
  colourName: string | null;
  imageType: string;
}

export interface ProductPriceTier {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
  /** The source price list's own order total at exactly minQty units — set only on
   *  houseProductKind: "price-list" entries (src/lib/houseProducts/printCatalogue.ts). */
  orderTotal?: number;
}

export interface ProductVariantSummary {
  colourName: string;
  size: string;
}

/** One quantity tier exactly as a supplier's product page lists it. For sellUnit "case"/"pack",
 *  bundleCount is the number of cases/packs; for sellUnit "unit" it's the tier's minimum unit
 *  count. perItemCad is null where the supplier page doesn't state a per-item figure (never
 *  derived by dividing — that would introduce rounding the supplier didn't show). */
export interface SupplierBundleTier {
  bundleCount: number;
  totalItems: number;
  perItemCad: number | null;
  totalCad: number;
}

/** Bundle/quantity pricing in CAD, shaped like the supplier's page (cases/packs/units and their
 *  tiers). Used both for the supplier's exact cost (jotoDrinkwareInternalOnly.ts) and for the
 *  retail price derived from it (CatalogueProduct.bundlePricing). Deliberately a separate field
 *  from priceTiers, which is apparel-specific (the product page adds a design/setup fee on top). */
export interface SupplierBundlePricing {
  /** What one price buys: a whole case, a whole pack, or a single unit. */
  sellUnit: "case" | "pack" | "unit";
  itemsPerBundle: number;
  /** Set when this pricing is only confirmed for one option value (e.g. "11oz"). */
  appliesTo?: string;
  tiers: SupplierBundleTier[];
  /** The supplier's struck-through "Regular Price" for one bundle, when a sale price is shown. */
  regularPriceCad?: number;
}

export interface CatalogueProduct {
  slug: string;
  name: string;
  brandName: string;
  categorySlug: string;
  subcategorySlug: string;
  description: string;
  images: ProductImage[];
  colours: string[];
  sizes: string[];
  variants: ProductVariantSummary[];
  priceTiers: ProductPriceTier[] | null;
  startingPrice: number | null;
  printRuleVersion: string;
  /** Draft/published catalogue state. Absent/undefined = "published" — every one of the site's
   *  existing supplier-sourced and house products has no opinion on this field and behaves exactly
   *  as before. Set to "draft" only for newly-added catalogue rows still pending sample approval,
   *  material verification and pricing review — getProductsByCategory/getProductsBySubcategory
   *  below filter these out of every category/subcategory listing (and therefore the shop grid,
   *  which reads through getProductsBySubcategory via src/lib/shopProducts.ts), and the
   *  product-detail route 404s a draft's own URL directly (see that page) so it's unreachable via
   *  any public path. sitemap.ts doesn't enumerate individual products today, so it needs no
   *  change here. */
  status?: "draft" | "published";
  /** Set only for Maple's own house-produced lines — not sourced from SanMar/S&S.
   *  `priceTiers`/`startingPrice` on these are display-only summaries for the shop tile; the
   *  authoritative per-order price always comes from src/lib/houseProducts/pricing/, since real
   *  pricing here is 2-D or variant-keyed, not the 1-D tier list this field shape represents.
   *  Absent/undefined = today's ordinary supplier product, no behavior change anywhere that
   *  doesn't explicitly check this field. The `drinkware-`/`promo-` prefixed values each map to
   *  one DrinkwareKind/PromoKind in their respective pricing module (see
   *  ProductCustomizer.tsx's branch) — kept as flat string literals rather than a nested type to
   *  match this field's existing convention. */
  houseProductKind?:
    | "banner"
    | "business-card"
    | "postcard"
    | "flyer"
    | "sticker"
    | "label"
    | "poster"
    | "drinkware-mug"
    | "drinkware-tumbler"
    | "drinkware-water-bottle"
    | "drinkware-pint-glass"
    | "promo-tote-bag"
    | "promo-pen"
    | "promo-notebook"
    | "promo-keychain"
    | "promo-magnet"
    | "promo-phone-stand"
    | "promo-coaster"
    | "sign-yard"
    | "sign-rigid"
    | "sign-window-cling"
    | "packaging-product-box"
    | "packaging-mailer-box"
    | "packaging-tissue-paper"
    | "packaging-tape"
    | "quote-only"
    | "price-list";
  /** Set only alongside houseProductKind: "quote-only" — real sourced sizes/materials to display
   *  on the product page even though live per-configuration pricing wasn't reliably found (see
   *  QuoteOnlyConfigurator). Never invented copy; always the same real catalogue facts gathered
   *  for every other house product, just without a price attached. */
  quoteOnlyInfo?: { sizes?: string[]; materials?: string[] };
  /** Set only on houseProductKind: "price-list" entries — the client catalogue's product ID
   *  (e.g. "MI-001") and its print specs, shown on the product page by PriceListConfigurator. */
  catalogueId?: string;
  printSpecs?: { sizeLabel: string; size: string; material?: string; printedSides?: string; finish?: string };
  /** Customer (retail) bundle/quantity pricing, markup already applied — set only on
   *  jotoDrinkwareCatalogDraft.ts entries. The supplier cost it was derived from lives in
   *  jotoDrinkwareInternalOnly.ts. Not read by any UI yet — the bundle/option selector for these
   *  products is a separate, later step. */
  bundlePricing?: SupplierBundlePricing[];
  /** Selectable options confirmed on the supplier page. `values` is empty with a `note` where the
   *  page shows swatches but no names — never guessed. Not read by any UI yet. */
  productOptions?: { name: string; values: string[]; note?: string }[];
  /** Optional design-template metadata, set only on src/lib/houseProducts/engravingCatalogDraft.ts
   *  entries, carried over from the xTool M1 Developer Catalog's "Design templates" sheet for
   *  whenever the personalization-input UI that sheet describes (character-limited customer text
   *  fields, layout/zone rules, text/stroke minimums) actually gets built. No component reads
   *  this field today — it is not wired into ProductCustomizer or any other UI, deliberately out
   *  of scope for this pass. Contains no supplier/cost data (that lives only in
   *  engravingInternalOnly.ts, never imported by any customer-facing file — see that file's own
   *  header for how this was verified). */
  engravingTemplateMeta?: {
    templateId: string;
    customerInputs: string;
    layoutType: string;
    zoneInstructions: string;
    textStrokeRule: string;
    templateStatus: string;
  };
}

// House-produced (Maple's own) products are merged in alongside the supplier-sourced catalogue —
// every existing consumer (getProduct, getProductsBySubcategory, the product-detail page's
// generateStaticParams) picks them up automatically with zero catalogue-engine/supplier-sync
// changes, since CatalogueProduct's shape has no apparel-specific fields baked in.
export const PRODUCTS: CatalogueProduct[] = [...(rawProducts as CatalogueProduct[]), ...HOUSE_PRODUCTS];

export function getProductsBySubcategory(categorySlug: string, subcategorySlug: string): CatalogueProduct[] {
  return PRODUCTS.filter(
    (p) => p.categorySlug === categorySlug && p.subcategorySlug === subcategorySlug && p.status !== "draft",
  );
}

export function getProductsByCategory(categorySlug: string): CatalogueProduct[] {
  return PRODUCTS.filter((p) => p.categorySlug === categorySlug && p.status !== "draft");
}

export function getProduct(categorySlug: string, subcategorySlug: string, productSlug: string): CatalogueProduct | undefined {
  return PRODUCTS.find(
    (p) => p.categorySlug === categorySlug && p.subcategorySlug === subcategorySlug && p.slug === productSlug,
  );
}

/** Alias for the shared slugify() helper (src/lib/slugify.ts) — kept under this name here since
 *  callers in this file's consumers read more clearly as "the subcategory slug", but there's only
 *  one slugify implementation in the app now, not two independently-drifting copies. */
export const subcategorySlugify = slugify;

export function countInSubcategory(categorySlug: string, subcategoryLabel: string): number {
  return getProductsBySubcategory(categorySlug, subcategorySlugify(subcategoryLabel)).length;
}
