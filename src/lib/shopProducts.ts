import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/slugify";
import { getProductsBySubcategory } from "@/lib/products";

export type ShopProduct = {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  subcategoryName: string;
  image: string;
  href: string;
  /** Price at the lowest quantity tier, from the client's own print-cost chart — null when no
   *  real catalogue product exists for this subcategory yet (not a guess, an honest "not priced"). */
  startingPrice: number | null;
};

// Where real catalogue data exists (currently: T-shirts, imported from S&S — see
// catalogue-engine/PHASE_3_TSHIRTS.md), each real product gets its own tile with a real price.
// Everywhere else, there's still no per-SKU catalogue, so a subcategory *is* the product, same as
// before — one representative tile, no price shown (never fabricated).
export const SHOP_PRODUCTS: ShopProduct[] = PRODUCT_CATEGORIES.flatMap((cat) =>
  cat.subcategories.flatMap((sub) => {
    const subSlug = slugify(sub);
    const realProducts = getProductsBySubcategory(cat.slug, subSlug);

    if (realProducts.length > 0) {
      return realProducts.map((p) => ({
        id: `${cat.slug}-${subSlug}-${p.slug}`,
        name: p.name,
        categorySlug: cat.slug,
        categoryName: cat.name,
        subcategorySlug: subSlug,
        subcategoryName: sub,
        image: p.images[0]?.url ?? `/images/products/subcategories/${cat.slug}/${subSlug}.jpg`,
        href: `/products/${cat.slug}/${subSlug}/${p.slug}`,
        startingPrice: p.startingPrice,
      }));
    }

    return [
      {
        id: `${cat.slug}-${subSlug}`,
        name: sub,
        categorySlug: cat.slug,
        categoryName: cat.name,
        subcategorySlug: subSlug,
        subcategoryName: sub,
        image: `/images/products/subcategories/${cat.slug}/${subSlug}.jpg`,
        href: `/products/${cat.slug}`,
        startingPrice: null,
      },
    ];
  }),
);
