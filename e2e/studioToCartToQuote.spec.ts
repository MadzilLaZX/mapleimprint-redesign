import { test, expect } from "@playwright/test";
import { installStudioMocks } from "./studioMocks";
import { installQuoteMocks } from "./quoteMocks";
import { trackConsoleErrors, shot, completeQuoteWizard } from "./helpers";

/** Verifies a customized design actually survives Studio -> Cart -> Checkout (for a priced
 *  apparel product -- a real resolvable price means the cart's real next step is checkout, not a
 *  quote) and Studio -> Quote directly (for drinkware, which has no automated print price and
 *  routes straight to Request a Quote by design -- see StudioClient.tsx's `requiresQuote`, this
 *  is real intended behavior, not a bug being worked around here). */

test("apparel: Studio design -> real cart (correct name/qty/price) -> real checkout order summary", async ({ page }, testInfo) => {
  const errors = trackConsoleErrors(page);
  await installStudioMocks(page, {
    sideType: "front",
    productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
    categorySlug: "custom-apparel",
    subcategorySlug: "t-shirts",
    productName: "Men's Pro-Lock Performance T-Shirt",
  });

  await page.goto("/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt");
  // ProductCustomizer gates "Customize This Shirt" on at least one sized quantity > 0.
  await page.getByRole("button", { name: /^Increase .* quantity$/ }).first().click();
  await page.getByRole("button", { name: "Customize This Shirt" }).click();
  await page.waitForURL(/\/studio\//);
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Text" }).click();
  await page.getByRole("button", { name: /add heading/i }).click();
  await page.getByLabel("Edit text").press("Enter");
  await shot(page, `apparel-studio-designed-${testInfo.project.name}`, testInfo);

  // TopBar's "Review" transitions into ReviewPanel, which has the real Approve button -- Review
  // and Approve are two distinct real steps, not one click.
  await page.getByRole("button", { name: "Review", exact: true }).click();
  // Approve & add to cart -- real addItem() call, no mocking needed (cart is pure localStorage).
  await page.getByRole("button", { name: "Approve & add to cart" }).click();
  await expect(page.getByText("Added to Cart")).toBeVisible({ timeout: 10_000 });

  await page.goto("/cart");
  await expect(page.getByText("Men's Pro-Lock Performance T-Shirt")).toBeVisible();
  await expect(page.getByText("Qty 24")).toBeVisible();
  await expect(page.getByText("CUSTOM DESIGN")).toBeVisible();
  // Real price, recomputed server-side at checkout time (never trusted from the client) -- here
  // just confirming the cart UI shows a non-zero estimate for the custom line, not $0/blank.
  await expect(page.getByText(/\$\d/).first()).toBeVisible();
  await shot(page, `cart-with-custom-design-${testInfo.project.name}`, testInfo);

  // This specific item has a real resolvable price (a Studio design on a priced apparel product),
  // so the cart's real next step is "Proceed to checkout" (real Square payment), not "Get a
  // quote" -- that CTA only appears for quote-required lines (see the separate drinkware test
  // below, which genuinely is requiresQuote and does take that path). Confirming the design
  // survives into checkout's order summary -- WITHOUT touching the Square payment form at all,
  // per the task's "do not make real payments" constraint -- is the real equivalent here.
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  // On mobile, the order summary is a collapsed accordion by default (real, intentional UX, not a
  // bug, see OrderSummary.tsx's `lg:hidden` mobile toggle) -- expand it before checking the line
  // item is in there.
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole("button", { name: /Order Summary/ }).click();
  }
  // OrderSummary.tsx always mounts BOTH its desktop (CSS-hidden below lg) and mobile layouts --
  // once the mobile accordion above is expanded, the product name genuinely exists in the DOM
  // twice at once. Scope to the one that's actually visible for this viewport.
  await expect(page.getByText("Men's Pro-Lock Performance T-Shirt").filter({ visible: true })).toBeVisible();
  await shot(page, `checkout-with-custom-design-${testInfo.project.name}`, testInfo);

  expect(errors, `console errors in Studio->Cart->Checkout: ${errors.join("\n")}`).toEqual([]);
});

test("drinkware: Studio design -> Approve routes directly to Request a Quote (requiresQuote, no cart step) -- documents real intended behavior", async ({ page }) => {
  await installStudioMocks(page, {
    sideType: "mug-wrap",
    productSlug: "stainless-tumblers",
    categorySlug: "drinkware",
    subcategorySlug: "tumblers",
    productName: "Stainless Steel Tumblers",
  });
  await installQuoteMocks(page);

  await page.goto("/products/drinkware/tumblers/stainless-tumblers");
  await page.getByRole("button", { name: "Customize Your Product" }).click();
  await page.waitForURL(/\/studio\//);
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Text" }).click();
  await page.getByRole("button", { name: /add heading/i }).click();
  await page.getByLabel("Edit text").press("Enter");

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Approve & Request a Quote" }).click();
  // No cart step for drinkware -- goes straight to the quote wizard, by design.
  await expect(page).toHaveURL(/\/contact\?type=quote/, { timeout: 10_000 });

  // expectPrefilledDescription: the real assertion that the Studio design actually persisted into
  // the quote flow (checked once step 1's field is reachable -- step 0 always shows first).
  await completeQuoteWizard(page, { projectType: "Custom apparel", expectPrefilledDescription: true });
});
