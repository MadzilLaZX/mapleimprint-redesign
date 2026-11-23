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
  assets?: Record<string, { originalFileName: string; storageBucket: string; storagePath: string; fileSizeBytes: number | null }>;
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

test("a tracked Asset (has storageBucket/storagePath) is served via a signed URL", async () => {
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-1" })]) },
  ]);
  assert.equal(inventory[0].assets.length, 1);
  const url = inventory[0].assets[0].url;
  assert.ok(url, "expected a non-null signed URL");
  assert.match(url, /\/storage\/v1\/object\/sign\//);
  assert.doesNotMatch(url, /\/storage\/v1\/object\/public\//);
});

test("sizeBreakdown passes through unchanged -- staff fulfilling an order must see which sizes/quantities to pack, not just a combined line quantity", async () => {
  const admin = fakeAdmin({});
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 5, sizeBreakdown: [{ size: "S", qty: 2 }, { size: "M", qty: 3 }] },
    { productName: "Mug", quantity: 1 }, // no sizeBreakdown at all -- must not throw, must resolve to null
  ]);
  assert.deepEqual(inventory[0].sizeBreakdown, [{ size: "S", qty: 2 }, { size: "M", qty: 3 }]);
  assert.equal(inventory[1].sizeBreakdown, null);
});

test("FAIL-SECURE -- a signing failure returns url: null, NEVER a permanent public URL for sensitive artwork", async () => {
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
    signingBehavior: () => null,
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-1" })]) },
  ]);
  // The file is still LISTED (so a customer/admin doesn't think it vanished) but with no usable
  // URL -- callers render this as "temporarily unavailable," never as a broken/public link.
  assert.equal(inventory[0].assets.length, 1);
  assert.equal(inventory[0].assets[0].url, null);
  assert.equal(inventory[0].assets[0].originalFileName, "logo.png", "the file's existence is still visible even when its URL couldn't be produced");
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
  const url = inventory[0].assets[0].url;
  assert.ok(url);
  assert.match(url, /\/storage\/v1\/object\/sign\/design-uploads\/sess\/legacy\.png/);
});

test("FAIL-SECURE -- an assetUrl that doesn't match the expected Supabase shape (path can't be recovered) returns null, never the raw unparseable URL", async () => {
  const admin = fakeAdmin({});
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: null, assetUrl: "https://example.com/not-supabase.png" })]) },
  ]);
  assert.equal(inventory[0].assets[0].url, null);
});

test("a data: URI assetUrl (Studio's own clipart/graphics library, not a Storage reference) is passed through unchanged, never signed or marked unavailable", async () => {
  const log: { bucket: string; path: string }[] = [];
  const admin = fakeAdmin({ signCallLog: log });
  const dataUri = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
  const inventory = await buildFileInventory(admin, [
    { productName: "Tee", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: null, assetUrl: dataUri })]) },
  ]);
  assert.equal(inventory[0].assets[0].url, dataUri, "a data: URI needs no signing and must never be reported as unavailable");
  assert.equal(log.length, 0, "no Storage call should be made for a data: URI at all");
});

test("SECURITY/CORRECTNESS -- the same asset referenced twice (e.g. placed on two sides, or also used as a Designer's Choice reference) de-dupes to one entry with ONE signed URL, not two different tokens for the same file", async () => {
  const log: { bucket: string; path: string }[] = [];
  const admin = fakeAdmin({
    assets: { "asset-1": { originalFileName: "logo.png", storageBucket: BUCKET, storagePath: "sess/logo.png", fileSizeBytes: 1000 } },
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
  const pngUrl = inventory[0].production[0].pngUrl;
  const previewUrl = inventory[0].preview[0].url;
  assert.ok(pngUrl);
  assert.ok(previewUrl);
  assert.match(pngUrl, /\/storage\/v1\/object\/sign\/design-uploads\/production-exports\/proj-1\/front\.png/);
  assert.match(previewUrl, /\/storage\/v1\/object\/sign\/design-uploads\/preview-exports\/proj-1\/front\.png/);
});

test("FAIL-SECURE -- a production file whose signing fails returns pngUrl: null, never its stored permanent URL", async () => {
  const admin = fakeAdmin({
    designProjects: {
      "proj-1": {
        exportStatus: "READY",
        exportError: null,
        exportedFiles: { front: { pngUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/production-exports/proj-1/front.png", svgUrl: null } },
        previewFiles: {},
      },
    },
    signingBehavior: () => null,
  });
  const inventory = await buildFileInventory(admin, [{ productName: "Tee", quantity: 1, designProjectId: "proj-1" }]);
  assert.equal(inventory[0].production[0].pngUrl, null);
});

test("SECURITY -- a line with no designProjectId/designSnapshot never pulls in another line's files passed in the same call", async () => {
  const admin = fakeAdmin({
    assets: { "asset-a": { originalFileName: "a.png", storageBucket: BUCKET, storagePath: "a.png", fileSizeBytes: 1 } },
  });
  const inventory = await buildFileInventory(admin, [
    { productName: "Has design", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-a" })]) },
    { productName: "No design at all", quantity: 1 },
  ]);
  assert.equal(inventory[0].assets.length, 1);
  assert.equal(inventory[1].assets.length, 0, "a line with no design data of its own must never inherit another line's assets");
});

test("SECURITY/AUTHORIZATION -- signing only ever requests paths that were derived from the lines actually passed in, never an arbitrary/unrelated path", async () => {
  // buildFileInventory has no authorization check of its own -- it trusts `lines` completely (see
  // its own doc comment). This test is the contract that makes that safe in practice: it only
  // ever CALLS createSignedUrl for storage paths that came from data already scoped to the
  // caller-supplied lines (Asset rows looked up by id, or paths parsed from a line's own
  // designSnapshot/exportedFiles) -- never for a path pulled from anywhere else. Asset "asset-b"
  // below is never referenced by any line passed in, so it must never be signed even though its
  // row exists in the (fake) database this call has access to.
  const log: { bucket: string; path: string }[] = [];
  const admin = fakeAdmin({
    assets: {
      "asset-a": { originalFileName: "a.png", storageBucket: BUCKET, storagePath: "owner-a/a.png", fileSizeBytes: 1 },
      "asset-b": { originalFileName: "b.png", storageBucket: BUCKET, storagePath: "owner-b/b.png", fileSizeBytes: 1 },
    },
    signCallLog: log,
  });
  await buildFileInventory(admin, [{ productName: "Only A's line", quantity: 1, designSnapshot: snapshot([imageObject({ assetId: "asset-a" })]) }]);
  assert.ok(log.some((c) => c.path === "owner-a/a.png"));
  assert.ok(!log.some((c) => c.path === "owner-b/b.png"), "asset-b's path must never be signed -- no line referenced it");
});

test("a line with no files at all produces empty assets/production/preview arrays, no signing calls made", async () => {
  const log: { bucket: string; path: string }[] = [];
  const admin = fakeAdmin({ signCallLog: log });
  const inventory = await buildFileInventory(admin, [{ productName: "Blank item", quantity: 1 }]);
  assert.deepEqual(inventory[0].assets, []);
  assert.deepEqual(inventory[0].production, []);
  assert.deepEqual(inventory[0].preview, []);
  assert.equal(log.length, 0);
});
