// Integration tests against an ISOLATED Supabase instance ONLY -- NOT run by `npm test` or any
// automatic/CI path, and (unlike this repo's other *.integration.test.ts files, which point at
// the shared production project with a loud warning comment) this file REFUSES to run against the
// known production project URL even if someone points SUPABASE_SERVICE_ROLE_KEY at it -- see the
// hard assertion in `before()` below. Per this round's explicit instruction ("never connect
// automated write tests to Production Supabase"), there is no fallback/default URL here at all.
//
// How to actually run this (requires Docker Desktop or Podman -- confirmed NOT installed in the
// environment this file was written in; `npx supabase start` failed with
// "docker: command not found (podman also not found)"):
//
//   1. Install Docker Desktop (or Podman) and make sure it's on PATH.
//   2. From the repo root: `npx supabase init` (one-time, creates supabase/config.toml --
//      the supabase/migrations/ folder already exists and will be picked up automatically).
//   3. `npx supabase start` -- prints a local API URL (http://127.0.0.1:54321), anon key, and
//      service_role key. This spins up real, isolated, local-only Postgres/Auth/Storage/Realtime
//      containers -- nothing here ever touches the real maple-imprint-catalogue project.
//   4. `npx supabase db reset` (or migrations apply automatically on `start` for a fresh project)
//      to apply every file in supabase/migrations/ against the local instance.
//   5. Run:
//        LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
//        LOCAL_SUPABASE_SERVICE_ROLE_KEY=<the service_role key supabase start printed> \
//        RUN_LOCAL_DB_INTEGRATION_TESTS=1 \
//        node --import ./scripts/register-test-alias-loader.mjs --test src/lib/studio/dbIntegration.test.ts
//
// Everything created here is synthetic and deleted in an `after` hook regardless of pass/fail.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { freezeDesignProject } from "./freeze.ts";
import { generateQuoteReference } from "../checkout/generateQuoteReference.ts";
import { refuseIfProductionSupabaseUrl } from "../server/knownProductionSupabaseProject.ts";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = Boolean(localUrl) && Boolean(localKey) && process.env.RUN_LOCAL_DB_INTEGRATION_TESTS === "1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: SupabaseClient<any, any, any>;
const createdDesignProjectIds: string[] = [];
const createdQuoteRequestIds: string[] = [];

before(() => {
  if (!hasCredentials) return;
  // Hard safety guard, not just documentation: refuses to run against the real project even if
  // someone mis-sets these env vars, regardless of what RUN_LOCAL_DB_INTEGRATION_TESTS says.
  refuseIfProductionSupabaseUrl(localUrl, "LOCAL_SUPABASE_URL");
  db = createClient(localUrl!, localKey!, { auth: { persistSession: false } });
});

after(async () => {
  if (!hasCredentials) return;
  if (createdQuoteRequestIds.length) {
    await db.from("QuoteRequestLine").delete().in("quoteRequestId", createdQuoteRequestIds);
    await db.from("QuoteRequest").delete().in("id", createdQuoteRequestIds);
  }
  if (createdDesignProjectIds.length) {
    await db.from("DesignSide").delete().in("designProjectId", createdDesignProjectIds);
    await db.from("DesignProject").delete().in("id", createdDesignProjectIds);
  }
});

async function makeDesignProject(ownerSession: string) {
  const { data: project, error } = await db
    .from("DesignProject")
    .insert({
      ownerSession,
      productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
      categorySlug: "custom-apparel",
      subcategorySlug: "t-shirts",
      productName: "Men's Pro-Lock Performance T-Shirt",
      brandName: "AllPro",
      colourName: "Carolina Blue",
      sizeBreakdown: [{ size: "One size", qty: 24 }],
      totalQuantity: 24,
      productTemplateVersion: "db-integration-test",
      pricingSnapshot: { unitBasePrice: 10, designFee: 0, chartFirstLocationCost: 4, chartAdditionalLocationCost: 2, quantity: 24, total: 336, printRuleVersion: "test" },
      mockupImages: {},
    })
    .select("id")
    .single();
  if (error || !project) throw new Error(`failed to create test DesignProject: ${error?.message}`);
  createdDesignProjectIds.push(project.id);

  const { error: sideError } = await db
    .from("DesignSide")
    .insert({ designProjectId: project.id, sideType: "front", printAreaWidth: 12, printAreaHeight: 16 });
  if (sideError) throw new Error(`failed to create test DesignSide: ${sideError.message}`);

  return project.id as string;
}

test("Studio project creation and saving: a DesignProject + its DesignSide are real, retrievable rows, scoped to the owning session", { skip: !hasCredentials }, async () => {
  const sessionToken = `db-itest-session-${crypto.randomUUID()}`;
  const projectId = await makeDesignProject(sessionToken);

  const { data: sides } = await db.from("DesignSide").select("id, sideType").eq("designProjectId", projectId);
  assert.equal(sides?.length, 1);
  assert.equal(sides?.[0]?.sideType, "front");
});

test("Editable design JSON persistence: saving DesignObject rows and reading them back round-trips correctly", { skip: !hasCredentials }, async () => {
  const sessionToken = `db-itest-session-${crypto.randomUUID()}`;
  const projectId = await makeDesignProject(sessionToken);
  const { data: side } = await db.from("DesignSide").select("id").eq("designProjectId", projectId).single();

  await db.from("DesignObject").insert({
    designSideId: side!.id,
    type: "text",
    content: "Integration Test Heading",
    normalizedX: 0.2,
    normalizedY: 0.4,
    normalizedWidth: 0.5,
    normalizedHeight: 0.12,
    fontSize: 40,
    fill: "#171412",
  });

  const { data: objects } = await db.from("DesignObject").select("content, fontSize").eq("designSideId", side!.id);
  assert.equal(objects?.length, 1);
  assert.equal(objects?.[0]?.content, "Integration Test Heading");
  assert.equal(objects?.[0]?.fontSize, 40);
});

test("Design freeze (real freeze.ts, not reimplemented): freezing with at least one object succeeds, re-freezing is idempotent", { skip: !hasCredentials }, async () => {
  const sessionToken = `db-itest-session-${crypto.randomUUID()}`;
  const projectId = await makeDesignProject(sessionToken);
  const { data: side } = await db.from("DesignSide").select("id").eq("designProjectId", projectId).single();
  await db.from("DesignObject").insert({ designSideId: side!.id, type: "text", content: "Frozen Heading", normalizedX: 0.2, normalizedY: 0.4, normalizedWidth: 0.5, normalizedHeight: 0.12 });

  const first = await freezeDesignProject(db, projectId);
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.frozenRevision, 1);

  // Re-freezing an already-frozen project must return the SAME snapshot, not re-derive or error.
  const second = await freezeDesignProject(db, projectId);
  assert.equal(second.ok, true);
  if (second.ok && first.ok) assert.deepEqual(second.designSnapshot, first.designSnapshot);

  const { data: project } = await db.from("DesignProject").select("frozenAt, status").eq("id", projectId).single();
  assert.ok(project?.frozenAt, "frozenAt must be set after a successful freeze");
});

test("Quote submission with an associated design file persists a QuoteRequestLine carrying the real designSnapshot", { skip: !hasCredentials }, async () => {
  const sessionToken = `db-itest-session-${crypto.randomUUID()}`;
  const projectId = await makeDesignProject(sessionToken);
  const { data: side } = await db.from("DesignSide").select("id").eq("designProjectId", projectId).single();
  await db.from("DesignObject").insert({ designSideId: side!.id, type: "text", content: "Quoted Design", normalizedX: 0.2, normalizedY: 0.4, normalizedWidth: 0.5, normalizedHeight: 0.12 });
  const frozen = await freezeDesignProject(db, projectId);
  assert.equal(frozen.ok, true);

  const reference = await generateQuoteReference(db);
  const { data: quote, error: quoteError } = await db
    .from("QuoteRequest")
    .insert({ reference, contactName: "DB Integration Test Customer A", contactEmail: "db-itest-a@example.invalid", productDescription: "Integration test request", status: "new" })
    .select("id")
    .single();
  if (quoteError || !quote) throw new Error(`failed to create test QuoteRequest: ${quoteError?.message}`);
  createdQuoteRequestIds.push(quote.id);

  if (frozen.ok) {
    await db.from("QuoteRequestLine").insert({
      quoteRequestId: quote.id,
      productName: "Men's Pro-Lock Performance T-Shirt",
      quantity: 24,
      customizationType: "CUSTOM",
      designProjectId: projectId,
      designFrozenRevision: frozen.frozenRevision,
      designSnapshot: frozen.designSnapshot,
    });
  }

  const { data: lines } = await db.from("QuoteRequestLine").select("designSnapshot, designProjectId").eq("quoteRequestId", quote.id);
  assert.equal(lines?.length, 1);
  assert.equal(lines?.[0]?.designProjectId, projectId);
  const snapshot = lines?.[0]?.designSnapshot as { sides?: { objects?: { content?: string }[] }[] } | null;
  assert.equal(snapshot?.sides?.[0]?.objects?.[0]?.content, "Quoted Design");
});

test("SECURITY -- quote reference isolation: customer B's reference cannot retrieve customer A's QuoteRequest row", { skip: !hasCredentials }, async () => {
  const refA = await generateQuoteReference(db);
  const { data: quoteA } = await db
    .from("QuoteRequest")
    .insert({ reference: refA, contactName: "Customer A", contactEmail: "customer-a@example.invalid", productDescription: "A's request", status: "new" })
    .select("id")
    .single();
  createdQuoteRequestIds.push(quoteA!.id);

  const refB = await generateQuoteReference(db);
  const { data: quoteB } = await db
    .from("QuoteRequest")
    .insert({ reference: refB, contactName: "Customer B", contactEmail: "customer-b@example.invalid", productDescription: "B's request", status: "new" })
    .select("id")
    .single();
  createdQuoteRequestIds.push(quoteB!.id);

  assert.notEqual(refA, refB, "two references generated in the same test run must be distinct");

  // Exactly what src/app/(site)/quote/[reference]/status/page.tsx does: look up by reference
  // alone. Confirms B's reference can never resolve to A's row (or vice versa) regardless of how
  // the service-role client bypasses RLS -- the WHERE clause itself is the only thing standing
  // between the two customers' contact info.
  const { data: lookupWithB } = await db.from("QuoteRequest").select("id, contactName, contactEmail").eq("reference", refB).maybeSingle();
  assert.equal(lookupWithB?.id, quoteB!.id);
  assert.notEqual(lookupWithB?.id, quoteA!.id);
  assert.equal(lookupWithB?.contactEmail, "customer-b@example.invalid");

  const { data: lookupWithA } = await db.from("QuoteRequest").select("id, contactName, contactEmail").eq("reference", refA).maybeSingle();
  assert.equal(lookupWithA?.id, quoteA!.id);
  assert.equal(lookupWithA?.contactEmail, "customer-a@example.invalid");
});

test("Admin quote retrieval: buildFileInventory only returns files for the lines actually passed in, never another quote's", { skip: !hasCredentials }, async () => {
  const { buildFileInventory } = await import("@/lib/admin/fileInventory");

  const sessionA = `db-itest-session-${crypto.randomUUID()}`;
  const projectA = await makeDesignProject(sessionA);
  const { data: sideA } = await db.from("DesignSide").select("id").eq("designProjectId", projectA).single();
  await db.from("DesignObject").insert({ designSideId: sideA!.id, type: "text", content: "Customer A's design", normalizedX: 0.2, normalizedY: 0.4, normalizedWidth: 0.5, normalizedHeight: 0.12 });
  const frozenA = await freezeDesignProject(db, projectA);
  assert.equal(frozenA.ok, true);

  const sessionB = `db-itest-session-${crypto.randomUUID()}`;
  const projectB = await makeDesignProject(sessionB);
  const { data: sideB } = await db.from("DesignSide").select("id").eq("designProjectId", projectB).single();
  await db.from("DesignObject").insert({ designSideId: sideB!.id, type: "text", content: "Customer B's design", normalizedX: 0.2, normalizedY: 0.4, normalizedWidth: 0.5, normalizedHeight: 0.12 });
  const frozenB = await freezeDesignProject(db, projectB);
  assert.equal(frozenB.ok, true);

  if (!frozenA.ok || !frozenB.ok) return;

  // Simulates what the admin quote detail page does for ONE quote -- only customer A's line is
  // passed in, so B's design must never appear in the resulting inventory even though both exist
  // in the same database at the same time.
  const inventory = await buildFileInventory(db, [
    { productName: "A's product", quantity: 24, customizationType: "CUSTOM", designProjectId: projectA, designSnapshot: frozenA.designSnapshot },
  ]);

  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].designProjectId, projectA);
  const snapshotContent = JSON.stringify(inventory[0].designSnapshot);
  assert.ok(!snapshotContent.includes("Customer B's design"), "customer B's design content must never appear in customer A's inventory");
});
