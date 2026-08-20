// Shared shop URL/query-state helpers — used by the server page (filtering/sorting/pagination),
// the filter/sort Links, and the pagination Links, so the query-string shape only lives in one
// place. Every control here is a real crawlable <Link>, not a client onClick handler, so
// filter/sort/page state lives in the URL (bookmarkable, back/forward-safe, indexable).

import type { ShopProduct } from "@/lib/shopProducts";

export const SHOP_PAGE_SIZE = 24;

export type ShopSort = "featured" | "price-asc" | "price-desc";

export const SHOP_SORTS: { value: ShopSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export type ShopSearchParams = {
  category?: string;
  subcategory?: string;
  sort?: string;
  q?: string;
  page?: string;
};

export function parseSort(value: string | undefined): ShopSort {
  return value === "price-asc" || value === "price-desc" ? value : "featured";
}

export function sortProducts(products: ShopProduct[], sort: ShopSort): ShopProduct[] {
  if (sort === "featured") return products;
  const direction = sort === "price-asc" ? 1 : -1;
  return [...products].sort((a, b) => {
    // Unpriced (quote-required) items have no comparable number — always sort them last,
    // regardless of direction, rather than letting them land ambiguously at either end.
    if (a.startingPrice === null && b.startingPrice === null) return 0;
    if (a.startingPrice === null) return 1;
    if (b.startingPrice === null) return -1;
    return (a.startingPrice - b.startingPrice) * direction;
  });
}

export function searchProducts(products: ShopProduct[], query: string): ShopProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

/** Builds a shop URL from the current params with the given overrides applied. Passing `undefined`
 *  for a key removes it. Changing category, subcategory, sort or q always resets page to 1 —
 *  a stale page number from a different filter set would either 404 or silently show page 1's
 *  worth of a completely different list, neither of which is what the user asked for. */
export function buildShopUrl(current: ShopSearchParams, overrides: Partial<ShopSearchParams>): string {
  const next: ShopSearchParams = { ...current, ...overrides };
  const resettingKeys: (keyof ShopSearchParams)[] = ["category", "subcategory", "sort", "q"];
  if (resettingKeys.some((k) => k in overrides)) {
    next.page = undefined;
  }
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.subcategory) params.set("subcategory", next.subcategory);
  if (next.sort && next.sort !== "featured") params.set("sort", next.sort);
  if (next.q) params.set("q", next.q);
  if (next.page && next.page !== "1") params.set("page", next.page);
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}
