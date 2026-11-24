import { test, expect } from "@playwright/test";
import { installStudioMocks } from "./studioMocks";

/**
 * Real-browser verification of Studio's behavior when the mobile on-screen keyboard opens.
 * Simulates the keyboard via page.setViewportSize (shrinking the viewport height, which is what
 * the `h-dvh`-based Studio shell actually reacts to) rather than a real OS keyboard -- Playwright
 * has no way to open a genuine mobile keyboard. iOS Safari in particular has its own, different
 * viewport-resize semantics for the keyboard that this cannot verify; see the final report for
 * what still needs physical-device testing. Network layer mocked via installStudioMocks().
 */

test("Studio: shrinking the viewport (simulating the keyboard opening) keeps the text editor visible and the canvas correctly rescaled", async ({
  page,
}) => {
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

  await page.getByRole("button", { name: "Text" }).click();
  await page.getByRole("button", { name: /add heading/i }).click();

  const editor = page.getByLabel("Edit text");
  await expect(editor).toBeVisible();
  const beforeBox = await editor.boundingBox();
  if (!beforeBox) throw new Error("editor not found before resize");

  // Simulates the on-screen keyboard opening -- roughly a real keyboard's typical height on this
  // device class, shrinking the `h-dvh` shell the same way a genuine keyboard-open event would.
  await page.setViewportSize({ width: 390, height: 844 - 320 });
  await page.waitForTimeout(300);

  await expect(editor).toBeVisible();
  const afterBox = await editor.boundingBox();
  if (!afterBox) throw new Error("editor not found after resize");
  const shrunkViewportHeight = 844 - 320;
  expect(afterBox.y).toBeGreaterThanOrEqual(0);
  expect(afterBox.y + afterBox.height).toBeLessThanOrEqual(shrunkViewportHeight);

  // The canvas itself must have genuinely rescaled to the smaller box, not just the overlay --
  // confirms CanvasStage's ResizeObserver reacted to the shrink rather than leaving a stale size.
  const canvasBox = await page.locator("canvas").first().boundingBox();
  if (!canvasBox) throw new Error("canvas not found after resize");
  expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(shrunkViewportHeight + 1);
});
