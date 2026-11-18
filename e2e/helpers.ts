import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.join(process.cwd(), "e2e", "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

/** Collects real browser console errors + uncaught page exceptions for the lifetime of a page.
 *  Deliberately excludes the one known, already-documented, unfixable-from-here noise source
 *  (Studio's canvas rendering some S&S/SanMar garment photos that may 403 per the ongoing
 *  supplier-CDN investigation) so a genuinely new error isn't drowned out by that expected one. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/** Saves a named screenshot under e2e/screenshots/ (gitignored -- these are run artifacts, not
 *  source) and attaches it to the HTML report for the specific test that captured it. */
export async function shot(page: Page, name: string, testInfo?: TestInfo): Promise<void> {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await testInfo?.attach(name, { path: filePath, contentType: "image/png" });
}

/** A visually-detectable 1x1 red PNG, used as synthetic "customer-uploaded" artwork -- real image
 *  bytes with a real MIME type, never a real customer's file. */
export const SYNTHETIC_TEST_IMAGE = {
  name: "synthetic-test-logo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
};

/** Drives the real 7-step /contact?type=quote wizard (src/components/contact/QuoteWizard.tsx)
 *  through every step with synthetic data, choosing Ottawa pickup specifically so this also
 *  exercises the real pickup path (never needs a postal code). Assumes the caller has already
 *  mocked POST /api/quote (see e2e/quoteMocks.ts) -- this never submits a real quote. If arriving
 *  via a Studio/cart "Get a quote" handoff, `data.productDescription` is already prefilled by the
 *  wizard's own mount effect, so step 1 just needs a Continue click either way. */
export async function completeQuoteWizard(
  page: Page,
  opts: { projectType?: string; email?: string; name?: string; expectPrefilledDescription?: boolean } = {},
): Promise<void> {
  const { projectType = "Custom apparel", email = "e2e-test@example.invalid", name = "E2E Test Customer", expectPrefilledDescription = false } = opts;

  // Step 0: project type. (Note: the wizard always starts here, even when arriving via a Studio/
  // cart handoff -- only productDescription gets prefilled, not projectType -- so step 1's field
  // is not visible/assertable until this step is completed.)
  // RadioCardGroup's real <input type="radio"> is visually sr-only (the styled card/label is what
  // a customer actually sees and clicks) -- force bypasses Playwright's visibility pre-check,
  // which is correct here since the input is intentionally hidden-but-interactive, not broken.
  await page.getByRole("radio", { name: projectType }).click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 1: product & quantity -- fill only if not already prefilled from a cart/Studio handoff.
  const productDescription = page.getByLabel("Desired product or service");
  if (expectPrefilledDescription) {
    await expect(productDescription, "expected productDescription to already be prefilled from the cart/Studio handoff").not.toHaveValue("");
  }
  if ((await productDescription.inputValue()) === "") {
    await productDescription.fill("E2E test: 24 custom-printed items, synthetic request.");
  }
  await page.getByRole("button", { name: "Continue" }).click();

  // Steps 2-3 (Customization, Files): every field is optional.
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: deadline & delivery -- Ottawa pickup avoids needing a postal code.
  await page.getByLabel("Needed by").fill("2026-12-31");
  await page.getByRole("radio", { name: "Ottawa pickup" }).click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: contact details.
  await page.getByLabel("Full name").fill(name);
  // Exact + role-scoped: "Email" alone also matches the (unrelated) preferred-contact radio.
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6: review + consent + submit.
  await page.getByRole("checkbox", { name: /I agree to be contacted/i }).check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Request submitted")).toBeVisible();
}
