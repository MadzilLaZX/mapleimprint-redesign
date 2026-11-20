import { test, expect } from "@playwright/test";
import { installStudioMocks } from "./studioMocks";
import { trackConsoleErrors, shot, SYNTHETIC_TEST_IMAGE } from "./helpers";

/** Drives the real Custom Product Studio UI (Konva 2D canvas, real React state, real components)
 *  against a drinkware product. Every Supabase-backed API call is mocked at the network layer
 *  (see studioMocks.ts) -- nothing here writes to live Supabase. */
test.describe("Custom Product Studio", () => {
  test("text editing, resize, image upload, layer reordering (persists across reload), and 2D/3D switching", async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page);
    await installStudioMocks(page, {
      sideType: "mug-wrap",
      productSlug: "stainless-tumblers",
      categorySlug: "drinkware",
      subcategorySlug: "tumblers",
      productName: "Stainless Steel Tumblers",
    });

    await page.goto("/products/drinkware/tumblers/stainless-tumblers");
    await page.getByRole("button", { name: "Customize Your Product" }).click();
    await page.waitForURL(/\/studio\//);
    await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });

    // --- Text editing: add a preset, then genuinely type into the real inline-edit textarea ---
    await page.getByRole("button", { name: "Text" }).click();
    await page.getByRole("button", { name: /add heading/i }).click();
    const editTextarea = page.getByLabel("Edit text");
    await expect(editTextarea).toBeVisible();
    await editTextarea.fill("E2E Test Heading");
    await editTextarea.press("Enter"); // commits (onKeyDown: Enter without Shift -> commit())

    // Confirm the typed edit actually landed in the design model, via the real Layers panel.
    await page.getByRole("button", { name: "Layers" }).click();
    await expect(page.getByRole("button", { name: "E2E Test Heading" })).toBeVisible();
    await shot(page, `studio-text-added-${testInfo.project.name}`, testInfo);

    // --- Resize (text): the real font-size stepper, not a canvas pixel-drag ---
    const fontSizeInput = page.getByLabel("Font size", { exact: true });
    const before = Number(await fontSizeInput.inputValue());
    await page.getByRole("button", { name: "Increase font size" }).click();
    await page.getByRole("button", { name: "Increase font size" }).click();
    // Step size scales with current size (TextToolbar's bumpSize: +1/+2/+5 depending on range) --
    // assert it genuinely grew, not a specific delta.
    await expect(async () => {
      expect(Number(await fontSizeInput.inputValue())).toBeGreaterThan(before);
    }).toPass();

    // --- Image upload: a real synthetic PNG through the real upload handler (network mocked) ---
    await page.getByRole("button", { name: "Uploads" }).click();
    await page.locator('input[type="file"]').first().setInputFiles(SYNTHETIC_TEST_IMAGE);
    // The uploaded image auto-selects itself -- "Fit to area"/"Fill print area" appearing is the
    // real Inspector's PositionAlignControl, rendered for any selected object.
    await expect(page.getByRole("button", { name: "Fill print area" })).toBeVisible({ timeout: 10_000 });
    await shot(page, `studio-image-uploaded-${testInfo.project.name}`, testInfo);

    // --- Resize (image): real Fit/Fill buttons -- also exercises last session's NaN/Infinity
    // guard fix in Inspector.tsx's scaleTo() for real, not just via its unit test. ---
    await page.getByRole("button", { name: "Fill print area" }).click();
    await page.getByRole("button", { name: "Fit to area" }).click();

    // --- Layer ordering: two real objects now exist (text + image). Reorder, wait for the
    // debounced autosave PATCH to actually fire, then reload and confirm the NEW order survived
    // -- this is the real-browser proof for syncZIndexToOrder.ts (fixed last session).
    // The Layers section was already opened earlier (right after adding the text object) and
    // stays open across tool switches -- clicking its header again here would just toggle it
    // closed, not "re-open" it. ---
    const layerRows = page.locator("ul li button.flex-1").filter({ hasText: /./ });
    // Explicit wait for the real condition (both layers actually rendered in the panel) rather
    // than assuming the prior awaits left enough time -- under parallel test-worker contention
    // (multiple browsers competing for CPU), the image layer's React state update can land after
    // this point even though every prior await already resolved, since none of them are actually
    // tied to the Layers list re-rendering. Root-caused via `--workers=1 --repeat-each=6` (6/6
    // pass serialized, confirming the real app is correct) vs. default parallel runs (intermittent
    // failures here) -- a test-timing gap, not an application bug.
    await expect(layerRows).toHaveCount(2);
    const orderBeforeMove = await layerRows.allTextContents();
    expect(orderBeforeMove.length).toBe(2);

    const patchResponse = page.waitForResponse((r) => r.url().includes("/api/studio/") && r.request().method() === "PATCH");
    // Move the bottom layer up one step -- flips the two-item order.
    await page.getByRole("button", { name: "Move up" }).last().click();
    await patchResponse;

    const orderAfterMove = await layerRows.allTextContents();
    expect(orderAfterMove).toEqual([...orderBeforeMove].reverse());

    await page.reload();
    await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });
    // Below the lg breakpoint, InspectorDock (which contains Layers) is `hidden` until something
    // is selected OR the mobile price pill is tapped (see StudioClient.tsx's "Mobile has no
    // permanent price/details panel" comment) -- nothing is selected right after a fresh reload,
    // so the price pill is the real, intended way in on this viewport.
    const isMobileViewport = (page.viewportSize()?.width ?? 0) < 1024;
    if (isMobileViewport) {
      await page.getByRole("button", { name: /Details/ }).click();
    }
    await page.getByRole("button", { name: "Layers" }).click();
    const orderAfterReload = await layerRows.allTextContents();
    expect(orderAfterReload, "layer order must survive a reload, not revert to creation order").toEqual(orderAfterMove);
    // On mobile, the Inspector bottom sheet opened above overlaps the 2D/3D toggle underneath it
    // -- close it first, same as a real customer would tap the sheet's own close button.
    if (isMobileViewport) {
      await page.getByRole("button", { name: "Close details" }).click();
    }

    // --- 2D/3D switching ---
    const toggle3D = page.getByRole("button", { name: "3D", exact: true });
    await expect(toggle3D).toBeVisible();
    await toggle3D.click();
    await expect(toggle3D).toHaveAttribute("aria-pressed", "true");
    await shot(page, `studio-3d-preview-${testInfo.project.name}`, testInfo);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(toggle3D).toHaveAttribute("aria-pressed", "false");

    expect(errors, `console errors during Studio interaction: ${errors.join("\n")}`).toEqual([]);
  });
});
