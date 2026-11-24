import { test, expect } from "@playwright/test";

/** Real-browser verification of QuoteWizard's draft-recovery feature -- no mocks needed, nothing
 *  here ever calls POST /api/quote (the discard/resume flow never reaches submission), so no
 *  Supabase write is attempted. */

test("QuoteWizard: a reload offers to resume an in-progress draft, and Resume restores the step and fields", async ({ page }) => {
  await page.goto("/contact"); // defaults to the "quote" tab, step 0

  // The radio input itself is visually sr-only (RadioCardGroup renders a custom visible circle
  // over it) -- clicking the label it's wrapped in is what a real pointer click actually hits.
  await page.locator("label", { hasText: "Custom apparel" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Product and quantity" })).toBeVisible();

  const description = "Embroidered polos for the e2e test suite";
  await page.getByLabel("Desired product or service").fill(description);
  // Autosave fires from a React effect on every data change -- give it a tick before reloading.
  await page.waitForTimeout(200);

  await page.reload();
  await expect(page.getByText("You have an unfinished quote request.")).toBeVisible();

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("You have an unfinished quote request.")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Product and quantity" })).toBeVisible();
  await expect(page.getByLabel("Desired product or service")).toHaveValue(description);
});

test("QuoteWizard: Discard clears the draft permanently, not just for the current page view", async ({ page }) => {
  await page.goto("/contact");
  await page.locator("label", { hasText: "Signs & banners" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Desired product or service").fill("Discard-me banner project");
  await page.waitForTimeout(200);

  await page.reload();
  await expect(page.getByText("You have an unfinished quote request.")).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("You have an unfinished quote request.")).not.toBeVisible();
  // Back to a blank step 0 -- discarding didn't silently resume it either.
  await expect(page.getByRole("heading", { name: "What's this project for?" })).toBeVisible();

  // The discard really persisted -- a second reload must not resurrect the same draft.
  await page.reload();
  await expect(page.getByText("You have an unfinished quote request.")).not.toBeVisible();
});

test("QuoteWizard: an empty, untouched wizard never offers to resume a no-op draft", async ({ page }) => {
  await page.goto("/contact");
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByText("You have an unfinished quote request.")).not.toBeVisible();
});
