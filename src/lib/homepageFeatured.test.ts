import { test } from "node:test";
import assert from "node:assert/strict";
import { getHomepageFeaturedProducts } from "./homepageFeatured.ts";
import { isKnownUnreliableImageHost } from "./shopQuery.ts";

// REGRESSION (2026-11-22): the curated FEATURED_PRODUCT_IDS list used to put every apparel item
// (t-shirt, cap, hoodie, polo -- all S&S/SanMar-sourced, both confirmed-blocked CDNs) ahead of the
// non-apparel ones in hand-picked order, so the homepage's first "Explore what we print" cards were
// guaranteed "Image coming soon" placeholders. getHomepageFeaturedProducts() now runs the same
// sortByImageReliability stable partition /shop and the category pages already use.
test("getHomepageFeaturedProducts: no known-unreliable-image product appears before a reliable one", () => {
  const products = getHomepageFeaturedProducts();
  assert.ok(products.length > 0, "expected at least one resolved featured product against the real catalogue");

  const reliability = products.map((p) => isKnownUnreliableImageHost(p.image));
  const firstUnreliableIndex = reliability.indexOf(true);
  const lastReliableIndex = reliability.lastIndexOf(false);
  if (firstUnreliableIndex !== -1 && lastReliableIndex !== -1) {
    assert.ok(
      lastReliableIndex < firstUnreliableIndex,
      `expected every reliable-image product before every known-unreliable one, got reliability flags: ${JSON.stringify(reliability)}`,
    );
  }
});

test("getHomepageFeaturedProducts: every resolved product has a non-null image (never a broken/missing card)", () => {
  const products = getHomepageFeaturedProducts();
  for (const p of products) {
    assert.ok(p.image, `expected ${p.id} to have a resolved image`);
  }
});
