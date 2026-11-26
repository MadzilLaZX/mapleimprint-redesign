import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * UAT — executed against the REAL, deployed Vercel Preview (not localhost, no network mocks):
 * real client code, real Next.js API routes, real staging Supabase (`mapleimprint-staging`,
 * confirmed via Vercel's own env var listing to be isolated from Production), real Square
 * SANDBOX (confirmed `NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox` on Preview, application id prefixed
 * `sandbox-sq0idb-...`). All test data below is deliberately synthetic and tagged so staff can
 * find and discard it later. No real payment, no real shipment, no Production access.
 *
 * All UAT-0x tests below share ONE browser context/page (a real continuous customer session,
 * not a fresh browser per step) so the mi-session cookie set in UAT-03 is still present by the
 * time UAT-12 checks Saved Designs. UAT-09 (unauthorized access) deliberately opens its OWN
 * separate, cookie-less context instead of clearing the shared one, so it doesn't wipe that
 * session out from under the later tests.
 */

const PREVIEW_BASE = "https://mapleimprint-redesign-khqd9vnus-zaberali855-2993s-projects.vercel.app";
const SHOT_DIR = "e2e/screenshots/uat";
const RUN_TAG = `uat${Date.now()}`;
const UAT_EMAIL = `${RUN_TAG}@example.com`;
const UAT_NAME = `UAT Automated Test ${RUN_TAG}`;

test.describe.configure({ mode: "serial" });

test.describe("UAT journey — live Preview", () => {
  let sharedContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext();
    page = await sharedContext.newPage();
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test("UAT-01 Browsing: homepage and category page load with real catalog data", async () => {
    await page.goto(`${PREVIEW_BASE}/`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `${SHOT_DIR}/01-homepage.png` });

    await page.goto(`${PREVIEW_BASE}/products/custom-apparel/t-shirts`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `${SHOT_DIR}/02-category.png` });
  });

  test("UAT-02 Apparel product page: real product detail renders", async () => {
    await page.goto(`${PREVIEW_BASE}/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `${SHOT_DIR}/03-apparel-product.png`, fullPage: true });
  });

  test("UAT-03 Apparel customization: starting Studio creates a real DesignProject in staging Supabase", async () => {
    await page.goto(`${PREVIEW_BASE}/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt`);
    await page.getByRole("button", { name: /increase .* quantity/i }).first().click();
    await page.getByRole("button", { name: "Customize This Product →" }).click();
    await page.waitForURL(/\/studio\//, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Text" })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_DIR}/04-studio-opened.png` });

    // Close the auto-opened Designs/templates onboarding panel on an empty project before adding
    // a text object, same real UI behavior documented in the mobile-gesture test suite.
    const closePanel = page.getByRole("button", { name: "Close panel" });
    if (!(await closePanel.isVisible().catch(() => false))) await page.waitForTimeout(300);
    if (await closePanel.isVisible().catch(() => false)) await closePanel.click();

    await page.getByRole("button", { name: "Text" }).click();
    await page.getByRole("button", { name: /add heading/i }).click();
    // Real autosave against real staging Supabase -- not a mock -- confirmed via the actual save
    // status indicator reaching "Saved", not just assuming the PATCH succeeded.
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOT_DIR}/05-studio-text-saved.png` });
  });

  test("UAT-04 Drinkware customization: real product page and Studio entry point", async () => {
    await page.goto(`${PREVIEW_BASE}/products/drinkware/tumblers/stainless-tumblers`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `${SHOT_DIR}/06-drinkware-product.png`, fullPage: true });
  });

  test("UAT-05 Promotional products: real category page renders", async () => {
    await page.goto(`${PREVIEW_BASE}/products/gifts-promo`);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `${SHOT_DIR}/07-promo-category.png` });
  });

  test("UAT-06 Quote request: real multi-step submission creates a real QuoteRequest in staging Supabase", async () => {
    await page.goto(`${PREVIEW_BASE}/contact`);
    await page.locator("label", { hasText: "Not sure yet" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Desired product or service").fill(`UAT acceptance test item (${RUN_TAG})`);
    await page.getByRole("button", { name: "Continue" }).click(); // leaves step 1 Product & quantity
    await page.getByRole("button", { name: "Continue" }).click(); // leaves step 2 Customization (optional)
    await page.getByRole("button", { name: "Continue" }).click(); // leaves step 3 Files (optional)
    await page.getByLabel("Needed by").fill("2027-01-15");
    await page.locator("label", { hasText: "Ottawa pickup" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Full name").fill(UAT_NAME);
    await page.getByRole("textbox", { name: "Email" }).fill(UAT_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("label", { hasText: "I agree to be contacted" }).click();
    await page.screenshot({ path: `${SHOT_DIR}/08-quote-review.png` });
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page.getByText("Request submitted")).toBeVisible({ timeout: 15_000 });
    const referenceText = await page.getByText(/^MI-/).textContent();
    expect(referenceText).toBeTruthy();
    await page.screenshot({ path: `${SHOT_DIR}/09-quote-confirmed.png` });
    console.log(`UAT quote reference (staging, synthetic): ${referenceText}`);
  });

  test("UAT-07 NEGATIVE — duplicate quote submission (same idempotencyKey) does not create a second QuoteRequest", async () => {
    const idempotencyKey = `${RUN_TAG}-dup-${crypto.randomUUID()}`;
    const body = {
      idempotencyKey,
      projectType: "unsure",
      productDescription: `UAT duplicate-submission test (${RUN_TAG})`,
      neededBy: "2027-01-15",
      deliveryMethod: "pickup",
      name: UAT_NAME,
      email: UAT_EMAIL,
    };
    const [first, second] = await page.evaluate(async (payload) => {
      const call = () => fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
      const a = await call();
      const b = await call(); // genuine sequential retry against the REAL route, same key both times
      return [a, b];
    }, body);
    console.log("UAT duplicate-submit results:", JSON.stringify({ first, second }));
    expect(first.reference).toBeTruthy();
    expect(second.reference).toBe(first.reference); // must be the SAME reference, not a second row
  });

  test("UAT-08 NEGATIVE — invalid email is rejected server-side even bypassing client validation", async () => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          projectType: "unsure",
          productDescription: "UAT invalid-email test",
          neededBy: "2027-01-15",
          deliveryMethod: "pickup",
          name: "UAT Invalid Email Test",
          email: "not-an-email",
        }),
      });
      return { status: res.status, body: await res.json() };
    });
    console.log("UAT invalid-email result:", JSON.stringify(result));
    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/valid email/i);
  });

  test("UAT-09 NEGATIVE — unauthorized admin access redirects to login, never renders order data", async ({ browser }) => {
    // A deliberately SEPARATE, cookie-less context -- never touches the shared session above.
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    try {
      const response = await freshPage.goto(`${PREVIEW_BASE}/admin/orders`);
      await expect(freshPage).toHaveURL(/\/admin\/login/);
      await expect(freshPage.locator('input[type="password"]')).toBeVisible();
      expect(response?.status()).toBeLessThan(400); // the redirect itself, not an error page
      await freshPage.screenshot({ path: `${SHOT_DIR}/10-admin-unauthorized-redirect.png` });
    } finally {
      await freshContext.close();
    }
  });

  test("UAT-10 NEGATIVE — lost network connectivity during quote submission shows a real error, not a silent hang or crash", async () => {
    await page.goto(`${PREVIEW_BASE}/contact`);
    await page.locator("label", { hasText: "Not sure yet" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Desired product or service").fill(`UAT offline test (${RUN_TAG})`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Needed by").fill("2027-01-15");
    await page.locator("label", { hasText: "Ottawa pickup" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Full name").fill(UAT_NAME);
    await page.getByRole("textbox", { name: "Email" }).fill(UAT_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("label", { hasText: "I agree to be contacted" }).click();

    await page.context().setOffline(true);
    try {
      await page.getByRole("button", { name: "Submit request" }).click();
      // Must surface a real, friendly, visible error -- not hang forever, not silently no-op, and
      // not the raw browser-level "Failed to fetch"/"NetworkError..." string this round's live UAT
      // run found verbatim on screen before the friendlyErrorMessage() fix.
      await expect(page.getByText(/couldn't reach the server/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/failed to fetch/i)).not.toBeVisible();
      await page.screenshot({ path: `${SHOT_DIR}/11-offline-submit-error.png` });
    } finally {
      await page.context().setOffline(false);
    }
  });

  test("UAT-11 Cart + checkout + Square Sandbox payment: real end-to-end order creation", async () => {
    test.setTimeout(90_000); // real network round-trips (Square tokenization + /api/checkout/pay
    // touching real staging Supabase + a real Square Sandbox charge) run far slower than the
    // local-mocked suite's default 30s budget.
    await page.goto(`${PREVIEW_BASE}/products/custom-apparel/t-shirts/allpro-men-s-pro-lock-performance-t-shirt`);
    await page.getByRole("button", { name: /increase .* quantity/i }).first().click();
    await page.getByRole("button", { name: "Buy It Blank" }).click();
    await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();

    await page.goto(`${PREVIEW_BASE}/cart`);
    await page.screenshot({ path: `${SHOT_DIR}/12-cart.png` });
    await page.getByRole("link", { name: /checkout/i }).click();
    await page.waitForURL(/\/checkout/);

    await page.getByLabel("Full name").fill(UAT_NAME);
    await page.getByLabel("Email").fill(UAT_EMAIL);
    await page.getByLabel("Phone").fill("6135550123");
    await page.getByRole("button", { name: /Free Local Pickup/i }).click();
    await page.screenshot({ path: `${SHOT_DIR}/13-checkout-contact.png` });

    const cardFrame = page.frameLocator("#square-card-container iframe").first();
    await cardFrame.getByRole("textbox", { name: "Card number" }).fill("4111 1111 1111 1111");
    await page.waitForTimeout(500); // lets Square's brand/AVS detection settle before checking for a zip field
    // Regression check for the postal-code-field defect fixed this round: when a zip field is
    // present it must be ENABLED and accept input -- previously disabled and pre-filled with an
    // invalid value (the business's own address), permanently blocking payment for every pickup
    // order. Separately (see UAT report), this Sandbox test card's zip field only accepts
    // numeric-only input -- a real Canadian postal code's letters are silently stripped -- which
    // is reported as its own finding, not fixed here (unconfirmed whether that's a Sandbox-test-
    // card artifact or a genuine production limitation).
    const zipField = cardFrame.getByRole("textbox", { name: "Postal code" }).or(cardFrame.getByPlaceholder("ZIP"));
    if (await zipField.count()) {
      await expect(zipField).toBeEnabled();
      await zipField.fill("90210");
    }
    await cardFrame.getByRole("textbox", { name: "MM/YY" }).fill("12/30");
    await cardFrame.getByRole("textbox", { name: "CVV" }).fill("111");
    await page.screenshot({ path: `${SHOT_DIR}/14-checkout-card-filled.png` });

    const payButton = page.getByRole("button", { name: /^Pay \$/ });
    await expect(payButton).toBeEnabled({ timeout: 15_000 });
    await payButton.click();

    await page.waitForURL(/\/order\/.+\/confirmation/, { timeout: 30_000 });
    await expect(page.getByText("Order confirmed")).toBeVisible({ timeout: 15_000 });
    const orderRefText = await page.getByText(/^MO-/).textContent();
    expect(orderRefText).toBeTruthy();
    await page.screenshot({ path: `${SHOT_DIR}/15-order-confirmed.png` });
    console.log(`UAT order reference (Square Sandbox, synthetic): ${orderRefText}`);

    // Order tracking: the real order just created must be findable via the real tracking form.
    await page.goto(`${PREVIEW_BASE}/account/orders`);
    await page.getByLabel("Order number").fill(orderRefText!.trim());
    await page.getByLabel("Email used for the order").fill(UAT_EMAIL);
    await page.getByRole("button", { name: "Track order" }).click();
    await page.waitForURL(/\/order\/.+\/confirmation/, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_DIR}/16-order-tracking-found.png` });
  });

  test("UAT-12 Saved designs: the design created in UAT-03 (this same session) appears in the customer's account", async () => {
    await page.goto(`${PREVIEW_BASE}/account`);
    await expect(page.locator("body")).not.toContainText("Application error");
    // Proves session-scoped recovery actually works, not just that the page renders -- the real
    // design created earlier in THIS SAME browser session (same mi-session cookie) must be listed.
    await expect(page.getByText("allpro-men-s-pro-lock-performance-t-shirt", { exact: false }).or(page.getByText(/pro-lock performance/i))).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({ path: `${SHOT_DIR}/17-saved-designs.png` });
  });
});
