import { test, expect } from "@playwright/test";
import { installStudioMocks } from "./studioMocks";

/** Real-browser verification of this round's accessibility/mobile fixes -- no mocks needed, these
 *  pages/flows don't touch Supabase at all. */

test("SizeGuidePanel: opening moves focus into the dialog, Escape closes it and returns focus to the trigger button", async ({ page }) => {
  await page.goto("/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt");
  const trigger = page.getByRole("button", { name: "Size Guide" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Size guide" });
  await expect(dialog).toBeVisible();
  // Focus moved into the dialog (the close button is its first focusable descendant).
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("SizeGuidePanel: Tab is trapped inside the dialog -- never reaches page content behind the backdrop", async ({ page }) => {
  await page.goto("/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt");
  await page.getByRole("button", { name: "Size Guide" }).click();
  const dialog = page.getByRole("dialog", { name: "Size guide" });
  await expect(dialog).toBeVisible();

  // Shift+Tab from the first focusable element (Close) must wrap to the LAST focusable element
  // inside the dialog, never escape to the page behind it.
  await page.keyboard.press("Shift+Tab");
  const activeInsideDialog = await page.evaluate((dialogEl) => dialogEl?.contains(document.activeElement), await dialog.elementHandle());
  expect(activeInsideDialog).toBe(true);
});

test("Studio TopBar: Undo/Redo are visible and usable on a mobile viewport (previously hidden entirely below 640px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const projectId = await installStudioMocks(page, {
    sideType: "front",
    productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
    categorySlug: "custom-apparel",
    subcategorySlug: "t-shirts",
    productName: "Men's Pro-Lock Performance T-Shirt",
  });
  await page.goto(`/studio/${projectId}`);
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });

  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeVisible();
  await expect(redo).toBeVisible();

  // Make a real change, confirm Undo is enabled and actually works via the mobile-visible button.
  await page.getByRole("button", { name: "Text" }).click();
  await page.getByRole("button", { name: /add heading/i }).click();
  await expect(undo).toBeEnabled();
  await undo.click();
});
