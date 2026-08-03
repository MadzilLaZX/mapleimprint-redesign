import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/slugify";

export type ShopProduct = {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  subcategoryName: string;
  image: string;
};

// One representative product per real subcategory photo we have. There's no
// per-SKU catalogue or pricing model yet (see PROJECT_NOTES.md), so this is
// the honest grain of detail available today — a subcategory *is* the
// product until real variants/pricing exist.
export const SHOP_PRODUCTS: ShopProduct[] = PRODUCT_CATEGORIES.flatMap((cat) =>
  cat.subcategories.map((sub) => {
    const subSlug = slugify(sub);
    return {
      id: `${cat.slug}-${subSlug}`,
      name: sub,
      categorySlug: cat.slug,
      categoryName: cat.name,
      subcategorySlug: subSlug,
      subcategoryName: sub,
      image: `/images/products/subcategories/${cat.slug}/${subSlug}.jpg`,
    };
  }),
);
