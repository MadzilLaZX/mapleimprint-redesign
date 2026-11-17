import { test } from "node:test";
import assert from "node:assert/strict";
import { freezeDesignProject } from "./freeze.ts";

// freezeDesignProject() is the one function behind BOTH "Approve & add to cart"
// (POST /api/studio/[id]/freeze) and /api/quote's defensive freeze-on-submit -- the exact
// artwork-persistence boundary where an editable DesignProject becomes the immutable snapshot an
// order/quote line references forever after. No test existed for it before this round. A minimal
// fake Supabase client is built per test (this codebase has no shared Supabase-mocking helper to
// reuse) rather than hitting a real database -- see this file's own fakeSupabase() below for
// exactly which calls it stands in for.

interface FakeResponses {
  designProjectSelect?: { data: Record<string, unknown> | null; error: unknown };
  designSideSelect?: { data: unknown[] | null; error: unknown };
  update?: { error: unknown };
}

function fakeSupabase(responses: FakeResponses) {
  let updateCalls = 0;
  let lastUpdatePatch: Record<string, unknown> | null = null;

  const supabase = {
    from(table: string) {
      if (table === "DesignProject") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => responses.designProjectSelect ?? { data: null, error: null },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              updateCalls++;
              lastUpdatePatch = patch;
              return responses.update ?? { error: null };
            },
          }),
        };
      }
      if (table === "DesignSide") {
        return {
          select: () => ({
            eq: async () => responses.designSideSelect ?? { data: [], error: null },
          }),
        };
      }
      throw new Error(`fakeSupabase: unexpected table "${table}"`);
    },
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: supabase as any,
    getUpdateCalls: () => updateCalls,
    getLastUpdatePatch: () => lastUpdatePatch,
  };
}

const baseProjectRow = {
  id: "proj-1",
  productSlug: "test-slug",
  categorySlug: "test-category",
  subcategorySlug: "test-subcategory",
  productName: "Test Product",
  brandName: "Test Brand",
  colourName: "Black",
  sizeBreakdown: null,
  totalQuantity: 10,
  productTemplateVersion: 1,
  pricingSnapshot: { chartFirstLocationCost: 5, chartAdditionalLocationCost: 2, designFee: 0, unitBasePrice: 10 },
  mockupImages: {},
  status: "draft",
  revision: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  frozenAt: null,
  frozenRevision: null,
  designSnapshot: null,
};

const sideWithOneObject = [
  { id: "side-1", sideType: "front", printAreaWidth: 10, printAreaHeight: 10, DesignObject: [{ zIndex: 0, type: "image" }] },
];

test("an already-frozen project returns its existing snapshot unchanged, never calls update (idempotent)", async () => {
  const { client, getUpdateCalls } = fakeSupabase({
    designProjectSelect: {
      data: { frozenAt: "2026-01-02T00:00:00Z", designSnapshot: { id: "proj-1", revision: 3 }, frozenRevision: 3 },
      error: null,
    },
  });

  const result = await freezeDesignProject(client, "proj-1");
  assert.deepEqual(result, { ok: true, frozenRevision: 3, designSnapshot: { id: "proj-1", revision: 3 } });
  assert.equal(getUpdateCalls(), 0, "an already-frozen project must never be re-frozen/re-written");
});

test("a not-yet-frozen project with at least one design element freezes successfully, writing the correct patch", async () => {
  const { client, getUpdateCalls, getLastUpdatePatch } = fakeSupabase({
    designProjectSelect: { data: baseProjectRow, error: null },
    designSideSelect: { data: sideWithOneObject, error: null },
  });

  const result = await freezeDesignProject(client, "proj-1");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.frozenRevision, 1);
    assert.equal(result.designSnapshot.id, "proj-1");
  }
  assert.equal(getUpdateCalls(), 1);
  const patch = getLastUpdatePatch();
  assert.equal(patch?.status, "ordered");
  assert.equal(patch?.frozenRevision, 1);
  assert.ok(patch?.frozenAt, "frozenAt must be set on the patch");
  assert.ok(patch?.designSnapshot, "designSnapshot must be set on the patch");
});

test("a project with no design elements on any side is rejected (422-equivalent), never frozen", async () => {
  const { client, getUpdateCalls } = fakeSupabase({
    designProjectSelect: { data: baseProjectRow, error: null },
    designSideSelect: { data: [{ id: "side-1", sideType: "front", printAreaWidth: 10, printAreaHeight: 10, DesignObject: [] }], error: null },
  });

  const result = await freezeDesignProject(client, "proj-1");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 422);
    assert.match(result.error, /at least one design element/);
  }
  assert.equal(getUpdateCalls(), 0);
});

test("a project that doesn't exist returns 404", async () => {
  const { client } = fakeSupabase({ designProjectSelect: { data: null, error: null } });
  const result = await freezeDesignProject(client, "does-not-exist");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
});

test("a database error on the initial frozen-status check returns a clean 502, not a throw", async () => {
  const { client } = fakeSupabase({ designProjectSelect: { data: null, error: new Error("connection reset") } });
  const result = await freezeDesignProject(client, "proj-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 502);
});

test("a database error on the final update returns a clean 502, not a throw -- the design is NOT silently left half-frozen", async () => {
  const { client } = fakeSupabase({
    designProjectSelect: { data: baseProjectRow, error: null },
    designSideSelect: { data: sideWithOneObject, error: null },
    update: { error: new Error("write failed") },
  });

  const result = await freezeDesignProject(client, "proj-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 502);
});
