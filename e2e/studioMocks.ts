import type { Page } from "@playwright/test";

/** Mocks every Supabase-backed Studio API route at the browser network layer, so a real-browser
 *  Studio test exercises the ACTUAL client-side React/Konva/Three.js code for real, while never
 *  sending a real request to Supabase -- this environment's .env.local has no
 *  SUPABASE_SERVICE_ROLE_KEY/SUPABASE keys configured at all, and the task explicitly forbids
 *  writing to live Supabase regardless. Route interception happens in the browser before the
 *  request reaches the dev server, so the real Next.js route handlers never run for these calls.
 *
 *  Shapes here match the real route handlers exactly (src/app/api/studio/**\/route.ts) as of
 *  2026-11-18 -- see src/lib/studio/types.ts for the full DesignProjectRecord contract. */

const PROJECT_ID = "e2e-test-project";

export interface MockProjectOptions {
  /** "mug-wrap" (drinkware -- requiresQuote, routes Approve straight to the Quote wizard) or
   *  "front" (apparel -- has real priceTiers, routes Approve into the real cart). */
  sideType: "mug-wrap" | "front";
  productSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  productName: string;
}

function emptyProjectRecord(opts: MockProjectOptions, objects: unknown[] = []) {
  const dims = opts.sideType === "mug-wrap" ? { printAreaWidth: 8, printAreaHeight: 3.3 } : { printAreaWidth: 12, printAreaHeight: 16 };
  return {
    id: PROJECT_ID,
    productSlug: opts.productSlug,
    categorySlug: opts.categorySlug,
    subcategorySlug: opts.subcategorySlug,
    productName: opts.productName,
    brandName: "Maple Imprint",
    colourName: "Test Colour",
    sizeBreakdown: [{ size: "One size", qty: 24 }],
    totalQuantity: 24,
    productTemplateVersion: "e2e-test",
    pricingSnapshot: {
      unitBasePrice: 12,
      designFee: 0,
      chartFirstLocationCost: 4,
      chartAdditionalLocationCost: 2,
      quantity: 24,
      total: (12 + 4) * 24,
      printRuleVersion: "e2e-test",
    },
    mockupImages: {},
    status: "draft",
    revision: 0,
    sides: [{ id: "side-1", sideType: opts.sideType, ...dims, objects }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Installs all the route mocks and returns the project id the test should navigate to
 *  (`/studio/${id}`). Objects saved via PATCH are kept in memory for the lifetime of the test so a
 *  reload (GET) reflects whatever was last autosaved -- this is what makes the "persists into
 *  cart/quote" and "layer order survives a reload" assertions meaningful rather than trivially
 *  true. */
export async function installStudioMocks(page: Page, opts: MockProjectOptions): Promise<string> {
  const savedObjectsBySide: Record<string, unknown[]> = {};

  await page.route("**/api/studio", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ json: { id: PROJECT_ID } });
  });

  await page.route(`**/api/studio/${PROJECT_ID}`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      const record = emptyProjectRecord(opts);
      record.sides[0].objects = savedObjectsBySide[opts.sideType] ?? [];
      await route.fulfill({ json: record });
      return;
    }
    if (method === "PATCH") {
      const body = route.request().postDataJSON() as { sides?: { sideType: string; objects: Record<string, unknown>[] }[] };
      for (const side of body.sides ?? []) {
        // The real PATCH payload deliberately omits `id` (StudioClient.tsx strips it before
        // sending -- new DesignObject rows get a fresh DB-generated id on insert). The real
        // server's next GET returns those real ids; this mock must do the same instead of
        // echoing the id-less objects back verbatim, or React sees duplicate/undefined keys for
        // every object on the next render (confirmed: without this, Chromium logs real "Each
        // child in a list should have a unique key prop" warnings from CanvasStage and
        // LayersPanel -- a mock-fidelity bug, not an app bug).
        savedObjectsBySide[side.sideType] = side.objects.map((o) => ({ ...o, id: crypto.randomUUID() }));
      }
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.continue();
  });

  await page.route(`**/api/studio/${PROJECT_ID}/freeze`, async (route) => {
    const record = emptyProjectRecord(opts);
    record.sides[0].objects = savedObjectsBySide[opts.sideType] ?? [];
    await route.fulfill({ json: { frozenRevision: 1, designSnapshot: record } });
  });

  await page.route(`**/api/studio/${PROJECT_ID}/locations`, async (route) => {
    await route.fulfill({ json: { ok: true } });
  });

  // Returns a real, tiny, local static asset as the "uploaded" image URL -- genuinely loadable by
  // the browser (so natural-size/aspect-ratio logic runs for real) without depending on any
  // external network call or real Supabase Storage write.
  await page.route("**/api/studio/upload", async (route) => {
    await route.fulfill({
      json: { url: "/images/products/subcategories/drinkware/tumblers.jpg", assetId: "e2e-mock-asset-id" },
    });
  });

  return PROJECT_ID;
}

export { PROJECT_ID as MOCK_STUDIO_PROJECT_ID };
