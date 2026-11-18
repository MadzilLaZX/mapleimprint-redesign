import { test } from "node:test";
import assert from "node:assert/strict";
import { signDesignProjectRecordForClient } from "./signDesignProjectUrls.ts";
import type { DesignProjectRecord, DesignObjectRecord } from "./types.ts";

function fakeAdmin(signingBehavior?: (path: string) => string | null) {
  const log: string[] = [];
  return {
    client: {
      storage: {
        from(_bucket: string) {
          return {
            createSignedUrl: async (path: string, _ttl: number) => {
              log.push(path);
              const signed = signingBehavior ? signingBehavior(path) : `https://project.supabase.co/storage/v1/object/sign/design-uploads/${path}?token=signed`;
              if (signed === null) return { data: null, error: { message: "simulated failure" } };
              return { data: { signedUrl: signed }, error: null };
            },
          };
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    log,
  };
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

function project(objects: DesignObjectRecord[]): DesignProjectRecord {
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
    status: "draft",
    revision: 1,
    sides: [{ id: "side-1", sideType: "front", printAreaWidth: 12, printAreaHeight: 16, objects }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("CANVAS RENDERING -- a real Supabase-hosted assetUrl is replaced with a signed URL", async () => {
  const { client } = fakeAdmin();
  const record = project([imageObject({ assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png" })]);
  const signed = await signDesignProjectRecordForClient(client, record);
  const url = signed.sides[0].objects[0].assetUrl;
  assert.ok(url);
  assert.match(url, /\/storage\/v1\/object\/sign\//);
});

test("CANVAS RENDERING -- qrLogoUrl is ALSO signed, independently of assetUrl", async () => {
  const { client } = fakeAdmin();
  const record = project([
    imageObject({
      type: "qr",
      assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/qr.png",
      qrLogoUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png",
    }),
  ]);
  const signed = await signDesignProjectRecordForClient(client, record);
  const obj = signed.sides[0].objects[0];
  assert.match(obj.assetUrl ?? "", /\/sign\/.*sess\/qr\.png/);
  assert.match(obj.qrLogoUrl ?? "", /\/sign\/.*sess\/logo\.png/);
});

test("a data: URI (Studio's clipart/graphics library) is passed through unchanged, never signed", async () => {
  const { client, log } = fakeAdmin();
  const dataUri = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
  const record = project([imageObject({ assetUrl: dataUri })]);
  const signed = await signDesignProjectRecordForClient(client, record);
  assert.equal(signed.sides[0].objects[0].assetUrl, dataUri);
  assert.equal(log.length, 0);
});

test("FAIL-SECURE -- a signing failure returns null, never the original stored URL (so CanvasStage's existing 'no image -> render nothing' fallback kicks in, not a broken-image icon)", async () => {
  const { client } = fakeAdmin(() => null);
  const record = project([imageObject({ assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png" })]);
  const signed = await signDesignProjectRecordForClient(client, record);
  assert.equal(signed.sides[0].objects[0].assetUrl, null);
});

test("an object with no assetUrl/qrLogoUrl at all (e.g. a text object) is left alone, no signing attempted", async () => {
  const { client, log } = fakeAdmin();
  const record = project([imageObject({ type: "text", assetUrl: null, qrLogoUrl: null, content: "Hello" })]);
  const signed = await signDesignProjectRecordForClient(client, record);
  assert.equal(signed.sides[0].objects[0].assetUrl, null);
  assert.equal(signed.sides[0].objects[0].qrLogoUrl, null);
  assert.equal(log.length, 0);
});

test("does not mutate the input record -- returns a new object/array tree", async () => {
  const { client } = fakeAdmin();
  const record = project([imageObject({ assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png" })]);
  const originalUrl = record.sides[0].objects[0].assetUrl;
  await signDesignProjectRecordForClient(client, record);
  assert.equal(record.sides[0].objects[0].assetUrl, originalUrl, "the original record passed in must be unchanged");
});

test("every non-URL field on each object survives unchanged through signing", async () => {
  const { client } = fakeAdmin();
  const record = project([imageObject({ assetUrl: "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/logo.png", rotation: 42, opacity: 0.5, name: "My Logo" })]);
  const signed = await signDesignProjectRecordForClient(client, record);
  const obj = signed.sides[0].objects[0];
  assert.equal(obj.rotation, 42);
  assert.equal(obj.opacity, 0.5);
  assert.equal(obj.name, "My Logo");
});
