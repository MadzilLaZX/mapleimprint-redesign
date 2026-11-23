import { test, expect } from "@playwright/test";

/** /api/track previously always returned 404 (no backend query at all -- see its own history), and
 *  OrderTrackingForm had no success-path handling even once wired up. Both are fixed now; this
 *  mocks /api/track at the network layer (same convention as quoteMocks.ts/studioMocks.ts) since
 *  the real handler queries live Supabase, which this environment never writes to in e2e tests. */

test("a matching order number + email redirects to that order's real confirmation page", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({ status: 200, json: { reference: "MO-E2ETESTMOCK" } });
  });
  await page.goto("/account/orders");
  await page.getByLabel("Order number").fill("MO-E2ETESTMOCK");
  await page.getByLabel("Email used for the order").fill("customer@example.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await page.waitForURL(/\/order\/MO-E2ETESTMOCK\/confirmation/);
});

test("a non-matching order number + email shows the honest not-found message, not a crash or silent no-op", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({ status: 404, json: { error: "We couldn't find a matching order. Double-check the order number, or contact us for help." } });
  });
  await page.goto("/account/orders");
  await page.getByLabel("Order number").fill("MO-NOTREAL");
  await page.getByLabel("Email used for the order").fill("nobody@example.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText(/couldn't find a matching order/i)).toBeVisible();
  await expect(page).toHaveURL(/\/account\/orders$/);
});

test("a sublimation personalized-engraving gift gets a real Customize entry point into Studio", async ({ page }) => {
  await page.goto("/products/personalized-engraving/kitchen-gifts/sublimation-pot-coaster-bottle-shaped-pack-6");
  await expect(page.getByRole("button", { name: "Customize Your Product" })).toBeVisible();
});

test("a laser-engraving item in the same category correctly stays quote-only -- no Customize button, no template built for that process", async ({ page }) => {
  await page.goto("/products/personalized-engraving/business-gifts/engraving-leather-passport-holder-pack-5");
  await expect(page.getByRole("button", { name: "Customize Your Product" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeVisible();
});

test("a jacket still prices and offers Customize correctly after the jacket/hoodie family split -- the real pricing pipeline, not just a unit test of chartFor()", async ({ page }) => {
  await page.goto("/products/custom-apparel/jackets-outerwear/core365-women-s-prevail-packable-puffer-jacket");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Packable Puffer Jacket/i);
  // A real dollar price, not blank/null -- this is exactly what would break if chartFor() in
  // pricing.ts still fell through to its business-card/flyer/poster "no approved apparel-style
  // print rule" branch for the new "jacket" family.
  await expect(page.getByText(/\$\d/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Increase .* quantity$/ }).first().click();
  await expect(page.getByRole("button", { name: "Customize This Product" })).toBeVisible();
});
