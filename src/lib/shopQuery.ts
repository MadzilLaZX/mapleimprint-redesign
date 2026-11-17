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

/** Hosts CONFIRMED (not assumed) to reject direct/hotlinked image requests -- verified via a
 *  live, read-only request returning `HTTP 403` / Cloudflare error code 1009 from
 *  cdn.ssactivewear.com on 2026-11-17, the same supplier-side block documented in
 *  `docs/launch-checklist-final-2026-11-12.md` and `next.config.ts`'s own `images.unoptimized`
 *  comment. Used ONLY to influence /shop's default "featured" sort order (see
 *  `isKnownUnreliableImageHost` below) -- it does not skip rendering the real image, fake a
 *  substitute photo, or touch anything about how the request is actually made. The catalogue's
 *  natural import order happens to cluster this supplier's products together, which meant the
 *  entire first page of `/shop?category=custom-apparel` could be 100% S&S-sourced images with
 *  zero chance of a real photo loading -- confirmed by rendering that exact page locally and
 *  finding 24/24 first-page images on this host. Surfacing products with a likely-to-load image
 *  first means a customer sees at least some real photos before any placeholder, without ever
 *  pretending the blocked ones have loaded.
 *
 *  Remove an entry once that supplier's CDN access is actually resolved -- don't leave it here
 *  "just in case." An individual image gets treated as reliable automatically, with no code
 *  change needed here, the moment `resolveHostedImage()` resolves it to a real rehosted override
 *  in `imageManifest.json` (that resolution already happens before `ShopProduct.image` is ever
 *  set -- see `shopProducts.ts`), since this function only ever sees the final, already-resolved
 *  URL. */
const KNOWN_UNRELIABLE_IMAGE_HOSTS = ["cdn.ssactivewear.com"];

export function isKnownUnreliableImageHost(url: string | null): boolean {
  if (!url) return false;
  return KNOWN_UNRELIABLE_IMAGE_HOSTS.some((host) => url.includes(host));
}

/** Stable partition (never reorders within either group) used by both /shop's "featured" sort
 *  and the static /products/[category]/[subcategory] listing pages -- one shared implementation
 *  so the two surfaces can't drift into different image-reliability behavior. `getImageUrl`
 *  exists because the two callers' item shapes differ (ShopProduct.image vs a resolved
 *  CatalogueProduct cover image) and neither should have to conform to the other's shape just to
 *  share this. */
export function sortByImageReliability<T>(items: T[], getImageUrl: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => Number(isKnownUnreliableImageHost(getImageUrl(a))) - Number(isKnownUnreliableImageHost(getImageUrl(b))));
}

export function parseSort(value: string | undefined): ShopSort {
  return value === "price-asc" || value === "price-desc" ? value : "featured";
}

/** Priced (checkout-ready) items always come before quote-required ones — a customer should never
 *  have to scroll past "Quote required" cards to reach products they can actually buy right now.
 *  Generic over any item with a `startingPrice`, so both the live /shop listing (ShopProduct) and
 *  the statically-built /products/[category]/[subcategory] pages (CatalogueProduct) can share the
 *  exact same rule instead of drifting into two different implementations. */
export function partitionByPriceAvailability<T extends { startingPrice: number | null }>(items: T[]): {
  priced: T[];
  quoteRequired: T[];
} {
  return {
    priced: items.filter((p) => p.startingPrice !== null),
    quoteRequired: items.filter((p) => p.startingPrice === null),
  };
}

/** Priced products first (see partitionByPriceAvailability above); the requested sort is applied
 *  only as the secondary key, within each group. Used by every /shop listing (category, search,
 *  sort, pagination all flow through here) so the rule holds across the whole surface.
 *
 *  Within "featured" (the default -- what a customer sees with no sort/search applied, including
 *  the very first page load of any category) specifically: products with a likely-to-load image
 *  come before ones from a known-unreliable host (see isKnownUnreliableImageHost() above) --
 *  Array.prototype.sort's guaranteed stability means this never reorders within either group, it
 *  only interleaves the two groups so the first screenful isn't all placeholders purely because
 *  of catalogue import order. A customer explicitly sorting by price gets exactly that order --
 *  this reordering is deliberately NOT applied there, since overriding an explicit price sort
 *  with an image-reliability tiebreaker would defeat the point of asking for it. */
export function sortProducts(products: ShopProduct[], sort: ShopSort): ShopProduct[] {
  const { priced, quoteRequired } = partitionByPriceAvailability(products);
  let sortedPriced: ShopProduct[];
  if (sort === "featured") {
    sortedPriced = sortByImageReliability(priced, (p) => p.image);
  } else {
    const direction = sort === "price-asc" ? 1 : -1;
    sortedPriced = [...priced].sort((a, b) => (a.startingPrice! - b.startingPrice!) * direction);
  }
  return [...sortedPriced, ...quoteRequired];
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
