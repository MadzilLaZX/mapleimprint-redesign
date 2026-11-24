import { test, expect, type Page } from "@playwright/test";
import { installStudioMocks } from "./studioMocks";

/**
 * Real-browser verification of CanvasStage's pinch-to-zoom/pan gestures, using the Chrome DevTools
 * Protocol's `Input.dispatchTouchEvent` to inject synthetic multi-touch input into a real Chromium
 * instance running the real client-side Konva code.
 *
 * IMPORTANT, per the task that requested this round of work: this is simulated touch input on a
 * desktop/CI Chromium instance (Mobile Chrome Playwright project, Pixel 5 viewport/UA), not a
 * physical touchscreen. CDP-dispatched touch events exercise the same DOM TouchEvent path a real
 * finger would, so they are a meaningful functional check of the gesture-handling CODE, but they
 * cannot verify real-device feel -- gesture timing/inertia, OS-level touch-action enforcement
 * quirks, or iOS Safari's distinct touch/viewport behavior still need physical-device testing.
 * Network layer mocked via installStudioMocks() (no SUPABASE_SERVICE_ROLE_KEY in this sandbox).
 */

type TouchPoint = { x: number; y: number; id: number };
/** Only the one CDP method this file needs -- avoids depending on Playwright's exact internal
 *  CDPSession type, which @playwright/test doesn't re-export. */
type MinimalCdpSession = { send(method: string, params?: Record<string, unknown>): Promise<unknown> };

async function dispatchTouch(
  client: MinimalCdpSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  points: TouchPoint[],
) {
  await client.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })),
  });
}

test.describe("Studio canvas: touch gestures (simulated via CDP, Mobile Chrome project)", () => {
  test.skip(({ isMobile }) => !isMobile, "touch gestures only apply to the touch-capable Mobile Chrome project");

  async function openStudio(page: Page) {
    const projectId = await installStudioMocks(page, {
      sideType: "front",
      productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
      categorySlug: "custom-apparel",
      subcategorySlug: "t-shirts",
      productName: "Men's Pro-Lock Performance T-Shirt",
    });
    await page.goto(`/studio/${projectId}`);
    await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });
    await closeActivePanel(page);
  }

  // A brand-new (empty) project auto-opens the Designs/templates onboarding panel, a mobile bottom
  // sheet that overlaps the floating zoom controls and the lower half of the canvas -- waits for it
  // to actually be open (the auto-open effect can fire a beat after mount) before using its own
  // dedicated "Close panel" button, rather than toggling the ToolRail button that opened it (which
  // races the same auto-open effect if clicked too early).
  async function closeActivePanel(page: Page) {
    const closeButton = page.getByRole("button", { name: "Close panel" });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      return;
    }
    // Not open yet (or already closed) -- give the auto-open effect a moment, then check once more.
    await page.waitForTimeout(300);
    if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
  }

  test("two-finger pinch zooms the canvas (reflected in the real zoom-percentage control)", async ({ page }) => {
    await openStudio(page);
    const client = await page.context().newCDPSession(page);
    const zoomReadout = page.getByTitle("Reset to fit");
    await expect(zoomReadout).toHaveText("100%");

    const canvasBox = await page.locator("canvas").first().boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    // Two fingers starting close together near center, spreading apart -- a standard pinch-out
    // (zoom in) gesture. Several intermediate steps, matching how a real touchmove stream arrives.
    const start: [TouchPoint, TouchPoint] = [
      { x: cx - 20, y: cy, id: 0 },
      { x: cx + 20, y: cy, id: 1 },
    ];
    await dispatchTouch(client, "touchStart", start);
    for (const spread of [40, 70, 100, 130]) {
      await dispatchTouch(client, "touchMove", [
        { x: cx - spread, y: cy, id: 0 },
        { x: cx + spread, y: cy, id: 1 },
      ]);
      await page.waitForTimeout(30);
    }
    await dispatchTouch(client, "touchEnd", []);

    const finalText = await zoomReadout.textContent();
    const finalZoom = Number(finalText?.replace("%", ""));
    expect(finalZoom).toBeGreaterThan(100);
    expect(finalZoom).toBeLessThanOrEqual(250); // MAX_ZOOM
  });

  test("one-finger touch on empty canvas background pans the viewport (does not mutate design state)", async ({ page }) => {
    await openStudio(page);
    const client = await page.context().newCDPSession(page);

    // Zoom in first via the real +/- button so there's room to pan (panning is clamped to 0 at
    // fit-to-view, same as the feature is designed to behave).
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByTitle("Reset to fit")).toHaveText("175%");

    const canvas = page.locator("canvas").first();
    // At 175% the canvas now extends past every edge of the viewport (its own boundingBox can
    // report negative x/y) -- a touch point must be chosen from the VIEWPORT, not the oversized
    // canvas element's box, or it can land off-screen and never reach anything. Viewport center is
    // guaranteed to still be on the (now larger-than-viewport) canvas, and on a blank project with
    // no objects it's also guaranteed to be empty background.
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    const startX = viewport.width / 2;
    const startY = viewport.height / 2;

    const transformBefore = await canvas.evaluate((el) => (el.parentElement?.parentElement?.parentElement as HTMLElement | null)?.style.transform ?? "");
    expect(transformBefore).toBe("");

    await dispatchTouch(client, "touchStart", [{ x: startX, y: startY, id: 0 }]);
    await dispatchTouch(client, "touchMove", [{ x: startX + 60, y: startY + 60, id: 0 }]);
    await page.waitForTimeout(100);
    await dispatchTouch(client, "touchEnd", []);
    await page.waitForTimeout(100);

    const transformAfter = await canvas.evaluate((el) => (el.parentElement?.parentElement?.parentElement as HTMLElement | null)?.style.transform ?? "");
    expect(transformAfter).not.toBe("");
    expect(transformAfter).toMatch(/translate\(/);

    // Panning the viewport must never create an undoable design mutation.
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  test("a two-finger pinch starting over an object moves the viewport, never the object itself", async ({ page }) => {
    await openStudio(page);
    const client = await page.context().newCDPSession(page);

    await page.getByRole("button", { name: "Text" }).click();
    await page.getByRole("button", { name: /add heading/i }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    // Close the Text panel (still open from adding the heading above), AND the mobile Inspector
    // "details" sheet that selecting the new heading auto-opens -- both are bottom sheets that
    // cover the lower half of the canvas on this viewport, the second of which would otherwise
    // silently absorb the touch points below instead of the canvas ever receiving them.
    await closeActivePanel(page);
    const closeDetails = page.getByRole("button", { name: "Close details" });
    if (await closeDetails.isVisible().catch(() => false)) await closeDetails.click();
    // Give the panels' exit animation + the canvas's resulting resize a moment to fully settle
    // before measuring canvasBox below, or it can reflect a mid-transition (stale) layout.
    await page.waitForTimeout(500);

    const canvasBox = await page.locator("canvas").first().boundingBox();
    if (!canvasBox) throw new Error("canvas not found");
    // New text is placed centered by default -- pinch starting right at center is highly likely to
    // land on/near the object, which is exactly the case this test needs to exercise.
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    await dispatchTouch(client, "touchStart", [
      { x: cx - 15, y: cy, id: 0 },
      { x: cx + 15, y: cy, id: 1 },
    ]);
    await dispatchTouch(client, "touchMove", [
      { x: cx - 50, y: cy, id: 0 },
      { x: cx + 50, y: cy, id: 1 },
    ]);
    await page.waitForTimeout(100);
    await dispatchTouch(client, "touchEnd", []);
    await page.waitForTimeout(100);

    // Two undoable actions are expected at this point regardless of the pinch gesture -- adding
    // the heading opens its inline text editor, and closing the panels above blurs it, which
    // (correctly, matching every other text edit in this app) commits a second entry on its own.
    // The pinch gesture must add ZERO further entries: if it had also committed an object move,
    // a third click would still be required before Undo disables.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
