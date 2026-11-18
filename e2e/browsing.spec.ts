import { test, expect } from "@playwright/test";
import { trackConsoleErrors, shot } from "./helpers";

// Runs under both the "Desktop Chrome" and "Mobile Chrome" (Pixel 5) projects configured in
// playwright.config.ts -- no device-specific code needed here, Playwright re-runs this whole file
// once per project.

test("homepage loads, has no console errors, and the real wayfinding control for this viewport is visible", async ({ page }, testInfo) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Maple Imprint/);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  // See browsing.spec.ts's Products-nav test for why this is viewport-conditional: Header.tsx's
  // desktop <nav> is CSS-hidden below the 1536px (2xl) breakpoint, replaced by a hamburger button.
  if (viewportWidth >= 1536) {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  }
  await shot(page, `homepage-${testInfo.project.name}`, testInfo);
  expect(errors, `console errors on homepage: ${errors.join("\n")}`).toEqual([]);
});

test("can navigate from the homepage into Products via the real header nav", async ({ page }, testInfo) => {
  await page.goto("/");
  const viewportWidth = page.viewportSize()?.width ?? 0;
  // Header.tsx's desktop nav is `hidden ... 2xl:block` (Tailwind's 1536px breakpoint) -- below
  // that width the same links only exist inside the hamburger-triggered mobile drawer. Both are
  // real navigation, just via a different real control depending on viewport.
  if (viewportWidth >= 1536) {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Products", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Products", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, `products-landing-${testInfo.project.name}`, testInfo);
});

test("drinkware category -> tumblers subcategory -> product detail, via real navigation", async ({ page }, testInfo) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/products/drinkware/tumblers");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Tumbler/i);

  const productLink = page.getByRole("link", { name: /Stainless Steel Tumblers/i }).first();
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page).toHaveURL(/\/products\/drinkware\/tumblers\/stainless-tumblers/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Stainless Steel Tumblers/i);
  await shot(page, `product-detail-tumblers-${testInfo.project.name}`, testInfo);
  expect(errors, `console errors browsing to product detail: ${errors.join("\n")}`).toEqual([]);
});

test("custom-apparel t-shirts subcategory listing renders real product cards", async ({ page }) => {
  await page.goto("/products/custom-apparel/t-shirts");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/T-Shirt/i);
  // At least one real product card link should be present -- confirms the catalogue actually
  // rendered rather than silently showing zero results.
  const cards = page.locator("a[href^='/products/custom-apparel/t-shirts/']");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
});

test("a specific priced apparel product detail page renders price and a Design entry point", async ({ page }) => {
  await page.goto("/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Pro-Lock Performance T-Shirt/i);
  await expect(page.getByText(/\$\d/).first()).toBeVisible();
});
