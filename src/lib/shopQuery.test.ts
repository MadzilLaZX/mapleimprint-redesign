import { test } from "node:test";
import assert from "node:assert/strict";
import { sortProducts, isKnownUnreliableImageHost, sortByImageReliability, partitionByPriceAvailability, searchProducts, buildShopUrl } from "./shopQuery.ts";
import type { ShopProduct } from "./shopProducts.ts";

// REGRESSION, found via a real diagnosis of a "the whole Shop grid shows placeholders" report:
// the default "featured" sort previously preserved pure catalogue import order, which happened
// to put every S&S-sourced product (currently confirmed blocked by their own Cloudflare CDN --
// see this file's own isKnownUnreliableImageHost() comment) before any SanMar-sourced one for
// /shop?category=custom-apparel -- the first 24 products (one full page) were 100% S&S, 0%
// SanMar, confirmed by rendering that exact page against a local dev server. Not a code bug in
// the sense of "wrong output" (every individual image attempt and fallback was already correct),
// but a real, fixable presentation problem: a customer's first screenful was guaranteed to be
// all placeholders regardless of how many working photos existed elsewhere in the same category.

function fixtureProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: "test-id",
    name: "Test Product",
    categorySlug: "custom-apparel",
    categoryName: "Custom Apparel",
    subcategorySlug: "t-shirts",
    subcategoryName: "T-Shirts",
    image: null,
    defaultColour: null,
    href: "/products/custom-apparel/t-shirts/test",
    startingPrice: 10,
    priceUnit: "unit",
    ...overrides,
  };
}

test("INVESTIGATION (2026-11-18): ATC Group apparel is SanMar-sourced, not S&S -- correctly classified as reliable", () => {
  // Raised when ATC-branded products dominated a real /products/custom-apparel/t-shirts page's
  // first screenful and still showed "Image coming soon": verified directly against the real
  // generated catalogue (src/lib/generated/products.json) that EVERY sampled ATC-branded t-shirt
  // (brandName "ATC(tm) EuroSpun(r)", etc.) has its image hosted on media.sanmarcanada.com, NOT
  // cdn.ssactivewear.com -- SanMar distributes multiple brands (ATC, Port & Company, Gildan,
  // L3xxx/S3xxx/Y3xxx style-numbered lines, ...), so "ATC" is a BRAND sold through SanMar, not a
  // separate supplier. Confirmed live: every one of the actual rendered first-24 image URLs for
  // that exact page (pulled from the real next build's pre-rendered static HTML, not just dev
  // mode) returned a real HTTP 200 from media.sanmarcanada.com. The catalogue mapping, the
  // rendered URL, and this classification are all correct -- there was no bug to fix here. This
  // test locks in that correct state so a future change can't silently misclassify this host or
  // break the ATC->SanMar mapping without a visible test failure.
  const sampleAtcSanMarUrls = [
    "https://media.sanmarcanada.com/catalog/product/a/t/atc0822_form_front_athleticgreyblackcamo_022019.jpg",
    "https://media.sanmarcanada.com/catalog/product/a/t/atc8000_form_front_athleticgrey_042015.jpg",
    "https://media.sanmarcanada.com/catalog/product/a/t/atc1000_form-front_aquatic-blue_2024_cil.jpg",
  ];
  for (const url of sampleAtcSanMarUrls) {
    assert.equal(isKnownUnreliableImageHost(url), false, `expected ${url} to be classified as reliable (SanMar-hosted)`);
  }

  // The sort must put these ATC/SanMar products ahead of an S&S one in "featured" order, exactly
  // as the real page's behavior confirmed.
  const atcProduct = fixtureProduct({ id: "atc", image: sampleAtcSanMarUrls[0] });
  const ssProduct = fixtureProduct({ id: "ss", image: "https://cdn.ssactivewear.com/Images/Color/102738_f_fm.jpg" });
  const result = sortProducts([ssProduct, atcProduct], "featured");
  assert.deepEqual(result.map((p) => p.id), ["atc", "ss"]);
});

test("isKnownUnreliableImageHost: true for the confirmed-blocked S&S CDN host, false for SanMar and local/null", () => {
  assert.equal(isKnownUnreliableImageHost("https://cdn.ssactivewear.com/Images/Color/102738_f_fm.jpg"), true);
  assert.equal(isKnownUnreliableImageHost("https://media.sanmarcanada.com/catalog/product/1/0/108085_black.jpg"), false);
  assert.equal(isKnownUnreliableImageHost("/images/subcategory/t-shirts.jpg"), false);
  assert.equal(isKnownUnreliableImageHost(null), false);
});

test("REGRESSION: 'featured' sort surfaces products with a reliable image before known-unreliable ones, without reordering within either group", () => {
  const reliable1 = fixtureProduct({ id: "reliable-1", image: "https://media.sanmarcanada.com/a.jpg" });
  const unreliable1 = fixtureProduct({ id: "unreliable-1", image: "https://cdn.ssactivewear.com/a.jpg" });
  const unreliable2 = fixtureProduct({ id: "unreliable-2", image: "https://cdn.ssactivewear.com/b.jpg" });
  const reliable2 = fixtureProduct({ id: "reliable-2", image: "https://media.sanmarcanada.com/b.jpg" });
  const noImage = fixtureProduct({ id: "no-image", image: null });

  // Deliberately ordered worst-case: every unreliable-image product appears before every
  // reliable one in catalogue order -- exactly the real-world scenario that was found.
  const input = [unreliable1, unreliable2, reliable1, reliable2, noImage];
  const result = sortProducts(input, "featured");

  // Reliable (+ no-image, which isn't "known unreliable") first, in their original relative
  // order; unreliable ones last, also in their original relative order -- a stable partition,
  // not a full re-sort.
  assert.deepEqual(result.map((p) => p.id), ["reliable-1", "reliable-2", "no-image", "unreliable-1", "unreliable-2"]);
});

test("REGRESSION: price-asc/price-desc sorts are NOT affected by image reliability -- an explicit price sort stays exactly price order", () => {
  const cheapButUnreliable = fixtureProduct({ id: "cheap-unreliable", image: "https://cdn.ssactivewear.com/a.jpg", startingPrice: 5 });
  const expensiveButReliable = fixtureProduct({ id: "expensive-reliable", image: "https://media.sanmarcanada.com/a.jpg", startingPrice: 50 });

  const ascending = sortProducts([expensiveButReliable, cheapButUnreliable], "price-asc");
  assert.deepEqual(ascending.map((p) => p.id), ["cheap-unreliable", "expensive-reliable"]);

  const descending = sortProducts([cheapButUnreliable, expensiveButReliable], "price-desc");
  assert.deepEqual(descending.map((p) => p.id), ["expensive-reliable", "cheap-unreliable"]);
});

test("quote-required (unpriced) products still always come after every priced product, regardless of image reliability", () => {
  const quoteRequired = fixtureProduct({ id: "quote-required", startingPrice: null, image: "https://media.sanmarcanada.com/a.jpg" });
  const pricedButUnreliableImage = fixtureProduct({ id: "priced-unreliable", startingPrice: 10, image: "https://cdn.ssactivewear.com/a.jpg" });

  const result = sortProducts([quoteRequired, pricedButUnreliableImage], "featured");
  assert.deepEqual(result.map((p) => p.id), ["priced-unreliable", "quote-required"]);
});

test("existing partitionByPriceAvailability/searchProducts/buildShopUrl behavior is unchanged", () => {
  const priced = fixtureProduct({ id: "p", startingPrice: 10 });
  const unpriced = fixtureProduct({ id: "u", startingPrice: null });
  const { priced: p, quoteRequired: q } = partitionByPriceAvailability([priced, unpriced]);
  assert.deepEqual(p.map((x) => x.id), ["p"]);
  assert.deepEqual(q.map((x) => x.id), ["u"]);

  assert.deepEqual(searchProducts([fixtureProduct({ id: "a", name: "Red Shirt" })], "red").map((x) => x.id), ["a"]);
  assert.equal(buildShopUrl({}, { category: "custom-apparel" }), "/shop?category=custom-apparel");
});

test("sortByImageReliability: works over any shape via its getImageUrl accessor, not just ShopProduct -- used by the static /products/[category]/[subcategory] pages, which have a different item shape (CatalogueProduct)", () => {
  const items = [
    { id: "unreliable", coverUrl: "https://cdn.ssactivewear.com/a.jpg" },
    { id: "reliable", coverUrl: "https://media.sanmarcanada.com/a.jpg" },
    { id: "no-cover", coverUrl: null },
  ];
  const result = sortByImageReliability(items, (item) => item.coverUrl);
  assert.deepEqual(result.map((x) => x.id), ["reliable", "no-cover", "unreliable"]);
});

test("sortByImageReliability: does not mutate the input array", () => {
  const items = [{ id: "a", img: "https://cdn.ssactivewear.com/a.jpg" }, { id: "b", img: null }];
  const original = [...items];
  sortByImageReliability(items, (x) => x.img);
  assert.deepEqual(items, original);
});
