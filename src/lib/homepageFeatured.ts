import { SHOP_PRODUCTS, type ShopProduct } from "@/lib/shopProducts";
import { sortByImageReliability } from "@/lib/shopQuery";

// Hand-curated homepage "Explore what we print" rail — deliberately alternates product families
// (apparel / headwear / drinkware / print / promo / stickers) rather than defaulting to a row of
// t-shirts. Resolved against the real SHOP_PRODUCTS catalogue below, never duplicated here — this
// list only names WHICH real products to feature and in what order; name/price/image/slug all
// come from the single source of truth. To change what's featured later, edit this array only.
const FEATURED_PRODUCT_IDS: string[] = [
  "custom-apparel-t-shirts-allpro-men-s-pro-lock-performance-t-shirt",
  "hats-accessories-caps-columbia-bora-bora-booney",
  "drinkware-mugs-sublimation-mug-11oz-white-case-36",
  "custom-apparel-hoodies-sweatshirts-adidas-men-s-ultimate365-elevated-hoodie",
  "stickers-labels-roll-labels-roll-labels",
  "custom-apparel-polos-adidas-men-s-performance-polo",
  "drinkware-tumblers-stainless-tumblers",
  "business-printing-business-cards-standard-business-cards",
  "gifts-promo-bags-tote-bags",
  "business-printing-posters-posters",
];

const MAX_FEATURED = 12;

/** Resolves the curated ID list against the real catalogue, silently dropping anything that no
 *  longer resolves, has no photo, or has no valid price — never renders a broken/missing card
 *  (a product going to draft or losing its photo shouldn't be able to break the homepage).
 *
 *  FIX (2026-11-22): this curated list previously kept its hand-picked order verbatim, which put
 *  every apparel item (t-shirt, cap, hoodie, polo) first — all four sourced from the confirmed-
 *  blocked S&S/SanMar CDNs (see shopQuery.ts's KNOWN_UNRELIABLE_IMAGE_HOSTS) — so visiting the
 *  homepage showed "Image coming soon" for the first 2 cards and 4 of the first 6, right below the
 *  hero, before a customer ever saw a real photo. The exact same `sortByImageReliability` stable
 *  partition already used by /shop and the static category/subcategory pages is applied here too,
 *  so the curated family-mix is preserved (nothing added, removed, or reordered within either
 *  group) while reliable-photo products surface first. */
export function getHomepageFeaturedProducts(): ShopProduct[] {
  const byId = new Map(SHOP_PRODUCTS.map((p) => [p.id, p]));
  const resolved: ShopProduct[] = [];
  for (const id of FEATURED_PRODUCT_IDS) {
    const product = byId.get(id);
    if (!product) continue;
    if (!product.image) continue;
    resolved.push(product);
    if (resolved.length >= MAX_FEATURED) break;
  }
  return sortByImageReliability(resolved, (p) => p.image);
}
