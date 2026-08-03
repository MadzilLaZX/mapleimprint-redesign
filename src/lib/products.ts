// Typed access to the generated product catalogue (src/lib/generated/products.json), produced by
// catalogue-engine/scripts/export-products-for-frontend.mjs from real, live supplier data. This
// file has no database/network dependency — it's a static import, same pattern as constants.ts
// elsewhere in this app. Re-run the export script and rebuild to pick up catalogue changes.

import rawProducts from "./generated/products.json";

export interface ProductImage {
  url: string;
  colourName: string | null;
  imageType: string;
}

export interface ProductPriceTier {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}

export interface ProductVariantSummary {
  colourName: string;
  size: string;
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
}

export const PRODUCTS: CatalogueProduct[] = rawProducts as CatalogueProduct[];

export function getProductsBySubcategory(categorySlug: string, subcategorySlug: string): CatalogueProduct[] {
  return PRODUCTS.filter((p) => p.categorySlug === categorySlug && p.subcategorySlug === subcategorySlug);
}

export function getProductsByCategory(categorySlug: string): CatalogueProduct[] {
  return PRODUCTS.filter((p) => p.categorySlug === categorySlug);
}

export function getProduct(categorySlug: string, subcategorySlug: string, productSlug: string): CatalogueProduct | undefined {
  return PRODUCTS.find(
    (p) => p.categorySlug === categorySlug && p.subcategorySlug === subcategorySlug && p.slug === productSlug,
  );
}

/** Product count per subcategory label (e.g. "T-shirts" -> 6), for tile badges. Slugified the
 *  same way the export script derives subcategory slugs from PRODUCT_CATEGORIES labels. */
export function subcategorySlugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

export function countInSubcategory(categorySlug: string, subcategoryLabel: string): number {
  return getProductsBySubcategory(categorySlug, subcategorySlugify(subcategoryLabel)).length;
}
