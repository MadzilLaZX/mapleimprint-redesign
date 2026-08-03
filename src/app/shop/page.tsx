import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { ShopGrid } from "@/components/shop/ShopGrid";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/slugify";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse every Maple Imprint product by category and subcategory, and add items to your cart.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subcategory?: string }>;
}) {
  const params = await searchParams;
  const category = PRODUCT_CATEGORIES.find((c) => c.slug === params.category) ?? null;
  const subcategoryName =
    category?.subcategories.find((s) => slugify(s) === params.subcategory) ?? null;

  const title = subcategoryName ?? category?.name ?? "All Products";
  const description = subcategoryName
    ? `${subcategoryName} from our ${category!.name.toLowerCase()} lineup, ready to customize.`
    : (category?.blurb ?? "Every product across the catalogue, in one place. Add items to your cart, then get a scoped quote.");

  return (
    <>
      <PageHeader eyebrow="Shop" title={title} description={description} />
      <Section tone="canvas">
        <ShopGrid initialCategory={category?.slug ?? null} initialSubcategory={params.subcategory ?? null} />
      </Section>
    </>
  );
}
