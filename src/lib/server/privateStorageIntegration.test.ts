// Integration tests against an ISOLATED Supabase instance ONLY -- same hard-refuse-production
// posture as src/lib/studio/dbIntegration.test.ts (not run by `npm test` or any automatic/CI path,
// and REFUSES to run against the known production project URL even if someone points
// LOCAL_SUPABASE_URL at it by mistake). Written because the private-bucket cutover review
// (docs/private-bucket-cutover.md) could only verify signing behavior against a FAKE Storage
// client -- this file exercises the real @supabase/supabase-js Storage API (real upload, real
// createSignedUrl, real fetch of the signed URL, real expiry) against a real bucket.
//
// IMPORTANT -- this alone is not enough to actually run these tests. Two things are missing from
// version control that a fresh `supabase start` instance will NOT have, confirmed while writing
// this file:
//
//   1. The DesignProject/DesignSide/DesignObject/Asset BASE TABLES have no CREATE TABLE anywhere
//      in this repo -- supabase/migrations/001_design_freeze.sql's own header comment says they
//      were created "via the SQL editor... no migration tooling in this repo runs this
//      automatically." Every numbered migration in supabase/migrations/ is an ALTER against
//      tables assumed to already exist. A bare `supabase start` + `supabase migration up` will
//      fail outright (ALTER TABLE on a table that doesn't exist) -- this is a pre-existing gap,
//      not something introduced by this round.
//   2. The `design-uploads` BUCKET and its storage.objects RLS policy (the
//      `(storage.foldername(name))[1] = x-mi-session header` rule referenced in
//      exportDesign.ts's own comment) are ALSO dashboard-only -- no SQL for either exists in this
//      repo.
//
// Real owner steps to get an isolated instance that can actually run this file:
//   1. Install Docker Desktop (or Podman) -- confirmed NOT installed in the environment this was
//      written in (`npx supabase start` fails with "docker: command not found").
//   2. `npx supabase init`, then **`npx supabase db pull`** against the real project (requires
//      `npx supabase link` with a database password from Project Settings > Database) -- this is
//      the standard Supabase-CLI way to capture a schema that was never checked in, and will
//      produce a migration file containing the real DesignProject/DesignSide/DesignObject/Asset
//      definitions. Review the pulled file before trusting it; don't run it against anything but
//      a local instance.
//   3. `npx supabase start`, then `npx supabase db reset` to apply the pulled schema + every file
//      already in supabase/migrations/.
//   4. In the local Supabase Studio (http://127.0.0.1:54323), create a bucket named
//      `design-uploads`, mark it PRIVATE, and add a storage.objects policy equivalent to
//      production's folder-scoped rule above (INSERT/SELECT where the first path segment equals
//      the caller's own session). Without this policy, the cross-session parts of this file would
//      pass for the wrong reason (no policy to violate) -- there is currently no SQL to copy this
//      from verbatim, so reproduce it by hand from the dashboard's existing policy text.
//   5. Run:
//        LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
//        LOCAL_SUPABASE_SERVICE_ROLE_KEY=<service_role key supabase start printed> \
//        RUN_LOCAL_STORAGE_INTEGRATION_TESTS=1 \
//        node --import ./scripts/register-test-alias-loader.mjs --test src/lib/server/privateStorageIntegration.test.ts
//
// Everything created here (storage objects + the one DesignProject/DesignSide/DesignObject/
// QuoteRequest/QuoteRequestLine tree used for the export/quote-attachment scenario) is synthetic
// and deleted in an `after` hook regardless of pass/fail.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSignedAssetUrl,
  extractStoragePathFromAnyKnownUrl,
  normalizeToStableStorageUrl,
  resolveSecureAssetUrl,
} from "./signedStorageUrl.ts";

const PRODUCTION_SUPABASE_URL = "https://ovqkwedpwmuusnijbxro.supabase.co";
const BUCKET = "design-uploads";
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = Boolean(localUrl) && Boolean(localKey) && process.env.RUN_LOCAL_STORAGE_INTEGRATION_TESTS === "1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: SupabaseClient<any, any, any>;
const uploadedPaths: string[] = [];
const createdDesignProjectIds: string[] = [];
const createdQuoteRequestIds: string[] = [];

before(() => {
  if (!hasCredentials) return;
  // Hard safety guard, not just documentation -- same pattern as dbIntegration.test.ts's own
  // `before()`. Refuses to run real Storage writes against the real project even if someone
  // mis-sets these env vars.
  if (localUrl === PRODUCTION_SUPABASE_URL || localUrl!.includes("ovqkwedpwmuusnijbxro")) {
    throw new Error(
      "LOCAL_SUPABASE_URL points at the production project -- refusing to run write tests against it. " +
        "Use a local `supabase start` instance (http://127.0.0.1:54321) instead.",
    );
  }
  db = createClient(localUrl!, localKey!, { auth: { persistSession: false } });
});

after(async () => {
  if (!hasCredentials) return;
  if (uploadedPaths.length) await db.storage.from(BUCKET).remove(uploadedPaths);
  if (createdQuoteRequestIds.length) {
    await db.from("QuoteRequestLine").delete().in("quoteRequestId", createdQuoteRequestIds);
    await db.from("QuoteRequest").delete().in("id", createdQuoteRequestIds);
  }
  if (createdDesignProjectIds.length) {
    await db.from("DesignSide").delete().in("designProjectId", createdDesignProjectIds);
    await db.from("DesignProject").delete().in("id", createdDesignProjectIds);
  }
});

const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadTestFile(path: string): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, TEST_PNG, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`test setup: upload failed for ${path}: ${error.message}`);
  uploadedPaths.push(path);
}

test("real upload + real signed URL: the signed URL Supabase returns is actually fetchable and serves the exact bytes uploaded", { skip: !hasCredentials }, async () => {
  const path = `itest-session-${crypto.randomUUID()}/front.png`;
  await uploadTestFile(path);

  const url = await getSignedAssetUrl(db, BUCKET, path, 300);
  assert.ok(url, "signing a just-uploaded real object must succeed");

  const res = await fetch(url!);
  assert.equal(res.status, 200, "a freshly-signed URL for a real object must be fetchable");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.equals(TEST_PNG), "the signed URL must serve the exact bytes that were uploaded");
});

test("real expiry: a signed URL with a 1-second TTL stops working shortly after issuance", { skip: !hasCredentials }, async () => {
  const path = `itest-session-${crypto.randomUUID()}/expiring.png`;
  await uploadTestFile(path);

  const url = await getSignedAssetUrl(db, BUCKET, path, 1);
  assert.ok(url);
  await new Promise((r) => setTimeout(r, 2500));
  const res = await fetch(url!);
  assert.notEqual(res.status, 200, "an expired signed URL must not serve the file");
});

test("real sign-vs-fetch-time behavior for a NEVER-UPLOADED path -- documents actual Supabase behavior rather than assuming it", { skip: !hasCredentials }, async () => {
  const neverUploadedPath = `itest-session-${crypto.randomUUID()}/does-not-exist.png`;
  const url = await getSignedAssetUrl(db, BUCKET, neverUploadedPath, 300);
  // docs/private-bucket-cutover.md's "What's genuinely untested" section flagged this exact
  // question as inferred, not observed: does createSignedUrl fail immediately for a nonexistent
  // object, or only the later fetch? Assert the actual fail-secure CONTRACT (never end up with a
  // 200 for an object that was never uploaded) without presupposing which branch produces it.
  if (url === null) return; // signing itself refused -- one valid fail-secure outcome
  const res = await fetch(url);
  assert.notEqual(res.status, 200, "signing must not succeed in a way that later serves a file that was never uploaded");
});

test("real round-trip: normalizeToStableStorageUrl(realSignedUrl) produces a URL that resolveSecureAssetUrl can re-sign successfully", { skip: !hasCredentials }, async () => {
  const path = `itest-session-${crypto.randomUUID()}/roundtrip.png`;
  await uploadTestFile(path);
  const signed = await getSignedAssetUrl(db, BUCKET, path, 300);
  assert.ok(signed);

  const stable = normalizeToStableStorageUrl(signed, BUCKET);
  assert.ok(stable!.includes("/object/public/"), "normalizing a real signed URL must produce the stable public-URL shape");
  assert.equal(extractStoragePathFromAnyKnownUrl(stable!, BUCKET), path);

  // This is the exact cycle the autosave PATCH route relies on: client holds a signed URL, server
  // normalizes it before persisting, a LATER request re-signs the stored stable URL again.
  const resigned = await resolveSecureAssetUrl(db, new Map(), BUCKET, stable);
  assert.ok(resigned, "a normalized (stable) URL must still be signable afterward");
  const res = await fetch(resigned!);
  assert.equal(res.status, 200);
});

test("real fail-secure: resolveSecureAssetUrl against a path that was removed after being stored returns null, never a stale URL", { skip: !hasCredentials }, async () => {
  const path = `itest-session-${crypto.randomUUID()}/will-be-deleted.png`;
  await uploadTestFile(path);
  const signed = await getSignedAssetUrl(db, BUCKET, path, 300);
  const stable = normalizeToStableStorageUrl(signed, BUCKET)!;

  await db.storage.from(BUCKET).remove([path]);
  uploadedPaths.splice(uploadedPaths.indexOf(path), 1);

  const resigned = await resolveSecureAssetUrl(db, new Map(), BUCKET, stable);
  if (resigned === null) return; // ideal fail-secure outcome
  // If Supabase still returns a signed URL for a deleted object (sign-time doesn't check
  // existence), the fetch itself must fail -- either branch is acceptable, a 200 is not.
  const res = await fetch(resigned);
  assert.notEqual(res.status, 200, "a deleted file must never still be servable through a freshly-signed URL");
});

test("real Studio-reload + real artwork export + real quote-attachment handling, end to end against real Storage", { skip: !hasCredentials, timeout: 30_000 }, async () => {
  const { signDesignProjectRecordForClient } = await import("../studio/signDesignProjectUrls.ts");
  const { freezeDesignProject } = await import("../studio/freeze.ts");
  const { triggerDesignExport } = await import("../studio/exportDesign.ts");
  const { buildFileInventory } = await import("../admin/fileInventory.ts");
  const { generateQuoteReference } = await import("../checkout/generateQuoteReference.ts");

  const sessionToken = `itest-session-${crypto.randomUUID()}`;
  const imagePath = `${sessionToken}/logo.png`;
  await uploadTestFile(imagePath);
  const { data: publicUrlData } = db.storage.from(BUCKET).getPublicUrl(imagePath);
  const stableAssetUrl = publicUrlData.publicUrl;

  const { data: project, error: projectError } = await db
    .from("DesignProject")
    .insert({
      ownerSession: sessionToken,
      productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
      categorySlug: "custom-apparel",
      subcategorySlug: "t-shirts",
      productName: "Men's Pro-Lock Performance T-Shirt",
      brandName: "AllPro",
      colourName: "Carolina Blue",
      sizeBreakdown: [{ size: "One size", qty: 24 }],
      totalQuantity: 24,
      productTemplateVersion: "private-storage-itest",
      pricingSnapshot: { unitBasePrice: 10, designFee: 0, chartFirstLocationCost: 4, chartAdditionalLocationCost: 2, quantity: 24, total: 336, printRuleVersion: "test" },
      mockupImages: {},
    })
    .select("id")
    .single();
  if (projectError || !project) throw new Error(`test setup: DesignProject insert failed: ${projectError?.message}`);
  createdDesignProjectIds.push(project.id);

  const { data: side, error: sideError } = await db
    .from("DesignSide")
    .insert({ designProjectId: project.id, sideType: "front", printAreaWidth: 12, printAreaHeight: 16 })
    .select("id")
    .single();
  if (sideError || !side) throw new Error(`test setup: DesignSide insert failed: ${sideError?.message}`);

  const { error: objectError } = await db.from("DesignObject").insert({
    designSideId: side.id,
    type: "image",
    assetUrl: stableAssetUrl,
    normalizedX: 0.3,
    normalizedY: 0.3,
    normalizedWidth: 0.4,
    normalizedHeight: 0.4,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
    hidden: false,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
  });
  if (objectError) throw new Error(`test setup: DesignObject insert failed: ${objectError.message}`);

  // --- Studio reload: GET /api/studio/[id]'s own signing step, against the real record ---
  const { data: liveProject } = await db.from("DesignProject").select("*").eq("id", project.id).single();
  const { data: liveSides } = await db.from("DesignSide").select("*, objects:DesignObject(*)").eq("designProjectId", project.id);
  const liveRecord = { ...liveProject, sides: liveSides } as unknown as Parameters<typeof signDesignProjectRecordForClient>[1];
  const signedForReload = await signDesignProjectRecordForClient(db, liveRecord);
  const reloadedAssetUrl = signedForReload.sides[0]!.objects[0]!.assetUrl!;
  assert.notEqual(reloadedAssetUrl, stableAssetUrl, "the record returned to a reloading client must carry a signed, not stable, URL");
  const reloadFetch = await fetch(reloadedAssetUrl);
  assert.equal(reloadFetch.status, 200, "the signed URL Studio's canvas would load on reload must actually be fetchable");

  // --- Freeze + real artwork export ---
  const frozen = await freezeDesignProject(db, project.id);
  assert.equal(frozen.ok, true, "freeze must succeed with the one image object present");

  await triggerDesignExport(db, project.id);
  const { data: exported } = await db.from("DesignProject").select("exportStatus, exportError, exportedFiles, previewFiles").eq("id", project.id).single();
  assert.equal(exported?.exportStatus, "READY", `export must reach READY against a real bucket (got error: ${exported?.exportError})`);
  const pngUrl = exported?.exportedFiles?.front?.pngUrl;
  assert.ok(pngUrl, "export must produce a front.png entry");
  uploadedPaths.push(extractStoragePathFromAnyKnownUrl(pngUrl, BUCKET)!);
  if (exported?.previewFiles?.front?.url) uploadedPaths.push(extractStoragePathFromAnyKnownUrl(exported.previewFiles.front.url, BUCKET)!);

  // The exported PNG itself must be independently signable/fetchable -- this is what proves
  // exportDesign.ts's loadImage() call against the SIGNED source (not the stable one) actually
  // produced a real, non-empty file rather than silently failing and still marking READY.
  const exportSigned = await getSignedAssetUrl(db, BUCKET, extractStoragePathFromAnyKnownUrl(pngUrl, BUCKET)!, 300);
  assert.ok(exportSigned);
  const exportFetch = await fetch(exportSigned!);
  assert.equal(exportFetch.status, 200);
  const exportBytes = Buffer.from(await exportFetch.arrayBuffer());
  assert.ok(exportBytes.byteLength > 0, "the exported production PNG must be a real, non-empty file");

  // --- Quote attachment handling: buildFileInventory, exactly as the quote-status/admin pages call it ---
  const reference = await generateQuoteReference(db);
  const { data: quote, error: quoteError } = await db
    .from("QuoteRequest")
    .insert({ reference, contactName: "Private Storage Itest", contactEmail: "private-storage-itest@example.invalid", productDescription: "itest", status: "new" })
    .select("id")
    .single();
  if (quoteError || !quote) throw new Error(`test setup: QuoteRequest insert failed: ${quoteError?.message}`);
  createdQuoteRequestIds.push(quote.id);

  const inventory = await buildFileInventory(db, [
    {
      productName: "AllPro T-Shirt",
      quantity: 24,
      customizationType: "CUSTOM",
      designProjectId: project.id,
      designSnapshot: frozen.ok ? frozen.designSnapshot : null,
    },
  ]);
  assert.equal(inventory.length, 1);
  assert.ok(inventory[0].assets[0]?.url, "the quote-status/admin attachment view must resolve a real, working URL for the uploaded logo");
  const attachmentFetch = await fetch(inventory[0].assets[0]!.url!);
  assert.equal(attachmentFetch.status, 200);
  assert.ok(inventory[0].production[0]?.pngUrl, "the admin inventory must also resolve the exported production file");
});
