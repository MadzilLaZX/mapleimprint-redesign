import { test, expect } from "@playwright/test";

/** GET /api/studio (the new "saved designs" list, see that route's own comment) is mocked at the
 *  network layer -- same convention as studioMocks.ts, since this environment has no real
 *  SUPABASE_SERVICE_ROLE_KEY/SUPABASE keys configured and the task forbids writing to live
 *  Supabase regardless. The real SavedDesignsPanel component (fetch + render) runs for real. */

test("no saved designs on this browser shows an honest empty state, not a broken/blank panel", async ({ page }) => {
  await page.route("**/api/studio", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: { projects: [] } });
  });
  await page.goto("/account");
  await expect(page.getByText("No designs saved on this browser yet.")).toBeVisible();
});

test("a real saved design renders with its product name and links to the real /studio/[id] editor", async ({ page }) => {
  await page.route("**/api/studio", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      json: {
        projects: [
          {
            id: "e2e-saved-design-1",
            productName: "Men's Pro-Lock Performance T-Shirt",
            colourName: "Black",
            totalQuantity: 24,
            status: "reviewed",
            mockupImages: {},
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
  });
  await page.goto("/account");
  const link = page.getByRole("link", { name: /Pro-Lock Performance T-Shirt/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/studio/e2e-saved-design-1");
  await expect(page.getByText("Approved · ×24")).toBeVisible();
});

test("the other three account panels (Orders, Quotes & proofs, Invoices) remain disabled placeholders -- they genuinely need a real account system, unlike Saved designs", async ({ page }) => {
  await page.route("**/api/studio", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: { projects: [] } });
  });
  await page.goto("/account");
  for (const label of ["Orders", "Quotes & proofs", "Invoices"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  // Sign-in form controls stay disabled -- confirms this round didn't accidentally wire up a fake
  // login alongside the real saved-designs feature.
  await expect(page.getByRole("button", { name: "Sign in (coming soon)" })).toBeDisabled();
});
