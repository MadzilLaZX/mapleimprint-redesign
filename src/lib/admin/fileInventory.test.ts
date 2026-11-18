import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFileInventory } from "./fileInventory.ts";
import type { DesignProjectRecord, DesignObjectRecord } from "@/lib/studio/types";

const BUCKET = "design-uploads";

/** Fake Supabase client covering every call shape buildFileInventory uses: two table selects
 *  (.from(table).select(...).in("id", ids)) and the Storage signing call
 *  (.storage.from(bucket).createSignedUrl(path, ttl)). Same inline-fake pattern as every other
 *  *.test.ts in this codebase. `signingBehavior` lets individual tests simulate success/failure
 *  per path without needing a real Storage backend. */
function fakeAdmin(opts: {
  designProjects?: Record<string, { exportStatus: string | null; exportError: string | null; exportedFiles: unknown; previewFiles: unknown }>;
  assets?: Record<string, { originalFileName: string; publicUrl: string; storageBucket: string; storagePath: string; fileSizeBytes: number | null }>;
  signingBehavior?: (bucket: string, path: string) => string | null; // null = signing "fails"
  signCallLog?: { bucket: string; path: string }[];
}) {
  const designProjects = opts.designProjects ?? {};
  const assets = opts.assets ?? {};
  return {
    from(table: string) {
      if (table === "DesignProject") {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => ({
              data: ids.filter((id) => id in designProjects).map((id) => ({ id, ...designProjects[id] })),
            }),
          }),
        };
      }
      if (table === "Asset") {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => ({
              data: ids.filter((id) => id in assets).map((id) => ({ id, ...assets[id] })),
            }),
          }),
        };
      }
      throw new Error(`fakeAdmin: unexpected table "${table}"`);
    },
    storage: {
      from(bucket: string) {
        return {
          createSignedUrl: async (path: string, _ttl: number) => {
            opts.signCallLog?.push({ bucket, path });
            const signed = opts.signingBehavior ? opts.signingBehavior(bucket, path) : `https://project.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=signed-${path}`;
            if (signed === null) return { data: null, error: { message: "simulated signing failure" } };
            return { data: { signedUrl: signed }, error: null };
          },
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function imageObject(overrides: Partial<DesignObjectRecord> = {}): DesignObjectRecord {
  return {
    id: crypto.randomUUID(),
    type: "image",
    assetUrl: null,
    content: null,
    fontFamily: null,
    fontSize: null,
    fill: null,
    normalizedX: 0.1,
    normalizedY: 0.1,
    normalizedWidth: 0.3,
    normalizedHeight: 0.3,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: null,
    letterSpacing: null,
    lineHeight: null,
    curve: null,
    shapeKind: null,
    strokeColor: null,
    strokeWidth: null,
    flipX: false,
    flipY: false,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
    qrDestination: null,
    qrErrorCorrection: null,
    qrForegroundColor: null,
    qrBackgroundColor: null,
    qrDotStyle: null,
    qrCornerStyle: null,
    qrLogoUrl: null,
    qrStylePreset: null,
    qrFrameStyle: null,
    qrLabelText: null,
    qrValidated: null,
    qrAssetId: null,
    ...overrides,
  } as DesignObjectRecord;
}

function snapshot(objects: DesignObjectRecord[]): DesignProjectRecord {
  return {
    id: "design-1",
    productSlug: "test",
    categorySlug: "custom-apparel",
    subcategorySlug: "t-shirts",
    productName: "Test Product",
    brandName: "Test",
    colourName: "Black",
    sizeBreakdown: [],
    totalQuantity: 1,
    productTemplateVersion: "test",
    pricingSnapshot: null,
    mockupImages: {},
    status: "reviewed",
    revision: 1,
    sides: [{ id: "side-1", sideType: "front", printAreaWidth: 12, printAreaHeight: 16, objects }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("a tracked Asset (has storageBucket/storagePath) is served via a signed URL, not its stored publicUrl", async () => {
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", publicUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-1" })]) },
  ]);
  assert.equal(inventory[0].assets.length, 1);
  assert.match(inventory[0].assets[0].url, /\/storage\/v1\/object\/sign\//);
  assert.doesNotMatch(inventory[0].assets[0].url, /\/storage\/v1\/object\/public\//);
});

test("signing failure falls back to the asset's stored plain publicUrl -- never breaks the page", async () => {
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", publicUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
    signingBehavior: () => null,
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-1" })]) },
  ]);
  assert.equal(inventory[0].assets[0].url, "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png");
});

test("an image object with no tracked Asset row (legacy assetUrl only) still gets signed by recovering the path from the URL", async () => {
  const admin = fakeAdmin({});
  const inventory = await buildFileInventory(admin, [
    {
      productName: "Tee",
      quantity: 1,
      designSnapshot: snapshot([imageObject({ assetId: null, assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/legacy.png" })]),
    },
  ]);
  assert.equal(inventory[0].assets.length, 1);
  assert.match(inventory[0].assets[0].url, /\/storage\/v1\/object\/sign\/design-uploads\/sess\/legacy\.png/);
});

test("an assetUrl that doesn't match the expected Supabase shape falls back to the raw URL as-is", async () => {
  const admin = fakeAdmin({});
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: null, assetUrl: "https://example.com/not-supabase.png" })]) },
  ]);
  assert.equal(inventory[0].assets[0].url, "https://example.com/not-supabase.png");
});

test("SECURITY/CORRECTNESS -- the same asset referenced twice (e.g. placed on two sides, or also used as a Designer's Choice reference) de-dupes to one entry with ONE signed URL, not two different tokens for the same file", async () => {
  const log: { bucket: string; path: string }[] = [];
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", publicUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
    signCallLog: log,
  });
  const inventory = await buildFileInventory(admin, [
    {
      productName: "Tee",
      quantity: 1,
      designSnapshot: snapshot([imageObject({ assetId: "asset-1" }), imageObject({ assetId: "asset-1" })]),
      assistanceBrief: { uploadedAssetId: "asset-1" },
    },
  ]);
  assert.equal(inventory[0].assets.length, 1, "the same asset referenced 3 times (twice on canvas, once via assistanceBrief) must still produce exactly one entry");
  // Only one real signing call for this path, even though it was requested 3 times.
  assert.equal(log.filter((c) => c.path === "sess/logo.png").length, 1);
});

test("production (300dpi export) and preview files are both served via signed URLs derived from their stored public URLs", async () => {
  const admin = fakeAdmin({
    designProjects: {
      "proj-1": {
        exportStatus: "READY",
        exportError: null,
        exportedFiles: { front: { pngUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/production-exports/proj-1/front.png", svgUrl: null } },
        previewFiles: { front: { url: "https://project.supabase.co/storage/v1/object/public/design-uploads/preview-exports/proj-1/front.png" } },
      },
    },
  });
  const inventory = await buildFileInventory(admin, [{ productName: "Tee", quantity: 1, designProjectId: "proj-1" }]);
  assert.match(inventory[0].production[0].pngUrl, /\/storage\/v1\/object\/sign\/design-uploads\/production-exports\/proj-1\/front\.png/);
  assert.match(inventory[0].preview[0].url, /\/storage\/v1\/object\/sign\/design-uploads\/preview-exports\/proj-1\/front\.png/);
});

test("SECURITY -- a line with no designProjectId/designSnapshot never pulls in another line's files passed in the same call", async () => {
  const admin = fakeAdmin({
    assets: { "asset-a": { originalFileName: "a.png", publicUrl: "https://x/public/design-uploads/a.png", storageBucket: BUCKET, storagePath: "a.png", fileSizeBytes: 1 } },
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Has design", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-a" })]) },
    { productName: "No design at all", quantity: 1 },
  ]);
  assert.equal(inventory[0].assets.length, 1);
  assert.equal(inventory[1].assets.length, 0, "a line with no design data of its own must never inherit another line's assets");
});
