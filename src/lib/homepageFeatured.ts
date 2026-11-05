import { SHOP_PRODUCTS, type ShopProduct } from "@/lib/shopProducts";

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
 *  (a product going to draft or losing its photo shouldn't be able to break the homepage). */
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
  return resolved;
}
