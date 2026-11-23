import { test, expect } from "@playwright/test";

/** Full interactive admin-session click-through (login -> view a real PAID order -> click a
 *  fulfillment button) is blocked in this environment: ADMIN_PASSWORD/ADMIN_SESSION_SECRET have no
 *  known value locally (a standing sandbox limitation, not something introduced this round -- see
 *  docs/local-test-environment-setup.md), so no valid staff session can be created without the
 *  real owner's credentials. What IS directly verifiable without those credentials -- and is
 *  exactly the authorization requirement this round asked for -- is that neither the page nor the
 *  new API route are reachable without one. */

test("the new fulfillment API route is unauthorized without a staff session, same as every other /api/admin/ route", async ({ request }) => {
  const res = await request.post("/api/admin/orders/MO-SOMEREFERENCE/fulfillment", {
    data: { toStatus: "IN_PRODUCTION" },
  });
  expect(res.status()).toBe(401);
});

test("the order detail page (where the fulfillment control lives) redirects an unauthenticated visitor to login, never rendering order data", async ({ page }) => {
  await page.goto("/admin/orders/MO-SOMEREFERENCE");
  await page.waitForURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the orders list page also redirects an unauthenticated visitor", async ({ page }) => {
  await page.goto("/admin/orders");
  await page.waitForURL(/\/admin\/login/);
});
