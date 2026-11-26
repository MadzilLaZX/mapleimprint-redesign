import { test, expect } from "@playwright/test";
import type { CartItem } from "@/components/cart/CartProvider";

/** Verifies the cart page's free-shipping PREVIEW messaging at the exact $300.00 CAD boundary.
 *  This is pure client-side (localStorage) logic -- no Chit Chats call involved -- so it's safe
 *  and deterministic to test with a synthetic, directly-seeded cart line rather than hunting for a
 *  real catalogue item whose price happens to land exactly on the boundary. Mirrors the server's
 *  own fix: the threshold is inclusive (>=), not strictly-greater-than. See
 *  chitChatsShippingProvider.test.ts and checkoutTotalConsistency.test.ts for the authoritative,
 *  server-side equivalent of these same three boundary cases. */

const STORAGE_KEY = "mi-cart";

function syntheticLine(startingPrice: number): CartItem[] {
  return [
    {
      id: "synthetic-free-shipping-boundary-test",
      name: "Synthetic Boundary Test Item",
      image: "",
      categorySlug: "custom-apparel",
      categoryName: "Custom Apparel",
      quantity: 1,
      startingPrice,
    },
  ];
}

async function seedCartAndVisit(page: import("@playwright/test").Page, startingPrice: number) {
  await page.addInitScript(
    ([key, items]) => window.localStorage.setItem(key as string, JSON.stringify(items)),
    [STORAGE_KEY, syntheticLine(startingPrice)],
  );
  await page.goto("/cart");
  await expect(page.getByText("Synthetic Boundary Test Item")).toBeVisible();
}

test("$299.99 subtotal: cart shows the 'add $0.01 more' message, not the free-shipping message", async ({ page }) => {
  await seedCartAndVisit(page, 299.99);
  await expect(page.getByText(/Add \$0\.01 more to qualify for free shipping/)).toBeVisible();
  await expect(page.getByText(/qualifies for free Canada-wide shipping/)).toHaveCount(0);
});

test("exactly $300.00 subtotal: cart shows the free-shipping qualifies message (inclusive threshold)", async ({ page }) => {
  await seedCartAndVisit(page, 300.0);
  await expect(page.getByText(/qualifies for free Canada-wide shipping/)).toBeVisible();
  await expect(page.getByText(/Add \$.*more to qualify/)).toHaveCount(0);
});

test("$300.01 subtotal: cart shows the free-shipping qualifies message", async ({ page }) => {
  await seedCartAndVisit(page, 300.01);
  await expect(page.getByText(/qualifies for free Canada-wide shipping/)).toBeVisible();
});

test("the 'add more' message uses inclusive wording ('$300.00 or more'), not the old strictly-greater-than 'over $300.00'", async ({ page }) => {
  await seedCartAndVisit(page, 100);
  await expect(page.getByText(/orders of \$300\.00 or more/)).toBeVisible();
  await expect(page.getByText(/orders over \$300\.00/)).toHaveCount(0);
});
