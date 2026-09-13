import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { ShopGrid } from "@/components/shop/ShopGrid";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ShopSearchInput } from "@/components/shop/ShopSearchInput";
import { ShopPagination } from "@/components/shop/ShopPagination";
import { SHOP_PRODUCTS } from "@/lib/shopProducts";
import { PRODUCT_CATEGORIES, SITE_URL } from "@/lib/constants";
import { slugify } from "@/lib/slugify";
import {
  SHOP_PAGE_SIZE,
  parseSort,
  sortProducts,
  searchProducts,
  buildShopUrl,
  type ShopSearchParams,
} from "@/lib/shopQuery";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const category = PRODUCT_CATEGORIES.find((c) => c.slug === params.category) ?? null;
  const subcategoryName = category?.subcategories.find((s) => slugify(s) === params.subcategory) ?? null;
  const title = subcategoryName ?? category?.name ?? "Shop";

  // Sort/search are different *views* of the same underlying list, not distinct content — point
  // their canonical back at the clean category/subcategory URL (page 1, no sort, no query) so
  // search engines don't index every sort-order/search-term permutation as separate pages. A page
  // number alone IS distinct content (different products), so it stays self-canonical.
  const hasNoiseParams = Boolean(params.q) || (params.sort && params.sort !== "featured");
  const canonicalPath = hasNoiseParams
    ? buildShopUrl({ category: params.category, subcategory: params.subcategory }, {})
    : buildShopUrl(params, {});

  return {
    title,
    description: subcategoryName
      ? `${subcategoryName} from our ${category!.name.toLowerCase()} lineup, ready to customize.`
      : (category?.blurb ?? "Browse every Maple Imprint product by category, ready to customize."),
    alternates: { canonical: `${SITE_URL}${canonicalPath}` },
    // Sort/search views add no unique value for search engines beyond the base category page —
    // keep them out of the index entirely rather than relying on canonical alone to suppress them.
    robots: hasNoiseParams ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const params = await searchParams;
  const category = PRODUCT_CATEGORIES.find((c) => c.slug === params.category) ?? null;
  const subcategoryName = category?.subcategories.find((s) => slugify(s) === params.subcategory) ?? null;
  const sort = parseSort(params.sort);

  let filtered = SHOP_PRODUCTS.filter((p) => {
    if (params.category && p.categorySlug !== params.category) return false;
    if (params.subcategory && p.subcategorySlug !== params.subcategory) return false;
    return true;
  });
  filtered = searchProducts(filtered, params.q ?? "");
  filtered = sortProducts(filtered, sort);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / SHOP_PAGE_SIZE));
  const requestedPage = Number(params.page ?? "1");
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
  const pageProducts = filtered.slice((currentPage - 1) * SHOP_PAGE_SIZE, currentPage * SHOP_PAGE_SIZE);

  const title = subcategoryName ?? category?.name ?? "All Products";
  const description = subcategoryName
    ? `${subcategoryName} from our ${category!.name.toLowerCase()} lineup, ready to customize.`
    : (category?.blurb ?? "Every product across the catalogue, in one place. Choose one to customize and get a scoped price.");

  return (
    <>
      <PageHeader eyebrow="Shop" title={title} description={description} />
      <Section tone="canvas">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <ShopFilters params={params} sort={sort} />
          <ShopSearchInput key={params.q ?? ""} params={params} />
        </div>

        <Container className="mt-6 px-0">
          <p className="text-sm text-muted">
            {totalCount} product{totalCount === 1 ? "" : "s"}
            {totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}
          </p>
        </Container>

        <ShopGrid
          products={pageProducts}
          gridKey={`${params.category ?? "all"}-${params.subcategory ?? "all"}-${sort}-${params.q ?? ""}-${currentPage}`}
        />

        <ShopPagination current={currentPage} totalPages={totalPages} params={params} />
      </Section>
    </>
  );
}
