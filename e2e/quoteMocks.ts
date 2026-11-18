import type { Page } from "@playwright/test";

/** Mocks POST /api/quote at the browser network layer -- the real handler writes a QuoteRequest/
 *  QuoteRequestLine row to Supabase (src/app/api/quote/route.ts), which this environment has no
 *  configured credentials for and which the task explicitly forbids regardless. Intercepting here
 *  means the real request never reaches the dev server, so no quote is ever actually submitted,
 *  while the real QuoteWizard UI (every field, step, and validation rule) still runs for real. */
export async function installQuoteMocks(page: Page, opts: { unattachedDesignLines?: string[] } = {}): Promise<void> {
  await page.route("**/api/quote", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      json: {
        reference: "MI-E2ETEST-MOCK01",
        ...(opts.unattachedDesignLines ? { unattachedDesignLines: opts.unattachedDesignLines } : {}),
      },
    });
  });
}
