import { test } from "node:test";
import assert from "node:assert/strict";
import { priceCartItem, lineShippingWeightLb, type CheckoutCartItemInput } from "./priceCartItem.ts";
import type { DesignProjectRecord } from "@/lib/studio/types";

// This is the ONE function both /api/checkout/quote and /api/checkout/pay call to compute what a
// customer is actually charged -- it never reads a price off the client-sent CheckoutCartItemInput
// (that type doesn't even have a price field), only off a server-side DesignProject lookup (CUSTOM)
// or the real static catalogue (BLANK). These tests exist specifically to prove that recomputation
// is correct and can't be steered by anything the browser sends, since this file previously had no
// test coverage at all despite being the authoritative "never trust the client" pricing boundary.

// Minimal fake Supabase client covering exactly the one call shape priceCartItem's CUSTOM branch
// uses: .from("DesignProject").select(...).eq("id", id).maybeSingle() -- same inline-fake pattern
// as freeze.test.ts/generateQuoteReference.test.ts (no shared Supabase-mocking helper exists yet).
function fakeSupabase(projectsById: Record<string, unknown>) {
  return {
    from(table: string) {
      if (table !== "DesignProject") throw new Error(`fakeSupabase: unexpected table "${table}"`);
      return {
        select: (_cols: string) => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: projectsById[id] ?? null, error: null }),
          }),
        }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function fakeSupabaseError() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "connection reset" } }),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function customItem(overrides: Partial<CheckoutCartItemInput> = {}): CheckoutCartItemInput {
  return {
    id: "cart-item-1",
    name: "Custom item",
    categorySlug: "custom-apparel",
    categoryName: "Custom Apparel",
    quantity: 24,
    customizationType: "CUSTOM",
    designProjectId: "design-1",
    ...overrides,
  };
}

function frozenApparelSnapshot(overrides: Partial<DesignProjectRecord> = {}): DesignProjectRecord {
  return {
    id: "design-1",
    productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
    categorySlug: "custom-apparel",
    subcategorySlug: "t-shirts",
    productName: "Men's Pro-Lock Performance T-Shirt",
    brandName: "AllPro",
    colourName: "Carolina Blue",
    sizeBreakdown: [{ size: "One size", qty: 24 }],
    totalQuantity: 24,
    productTemplateVersion: "test",
    pricingSnapshot: {
      unitBasePrice: 10,
      designFee: 0,
      chartFirstLocationCost: 4,
      chartAdditionalLocationCost: 2,
      quantity: 24,
      total: (10 + 4) * 24,
      printRuleVersion: "test",
    },
    mockupImages: {},
    status: "reviewed",
    revision: 1,
    sides: [{ id: "side-1", sideType: "front", printAreaWidth: 12, printAreaHeight: 16, objects: [{ id: "obj-1" } as never] }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// --- CUSTOM branch: never trusts anything the client sent, only the server-side DesignProject ---

test("CUSTOM: rejects when designProjectId is missing from the cart item", async () => {
  const result = await priceCartItem(customItem({ designProjectId: undefined }), fakeSupabase({}));
  assert.equal(result.ok, false);
});

test("CUSTOM: rejects when the design can't be found (deleted, or belongs to a different session)", async () => {
  const result = await priceCartItem(customItem(), fakeSupabase({}));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /could not be found/i);
});

test("CUSTOM: a database error on the design lookup is a clean rejection, not a throw", async () => {
  const result = await priceCartItem(customItem(), fakeSupabaseError());
  assert.equal(result.ok, false);
});

test("CUSTOM: rejects an unfrozen design -- a draft can't be checked out, only a finalized one", async () => {
  const unfrozen = { frozenAt: null, designSnapshot: null, frozenRevision: 0 };
  const result = await priceCartItem(customItem(), fakeSupabase({ "design-1": unfrozen }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /hasn't been finalized/i);
});

test("CUSTOM: SECURITY -- rejects a stale designFrozenRevision (design changed since it was added to the cart)", async () => {
  const frozen = {
    frozenAt: new Date().toISOString(),
    frozenRevision: 2,
    designSnapshot: frozenApparelSnapshot(),
  };
  // Cart item was added when the design was at revision 1; the design has since been edited and
  // re-frozen at revision 2 -- the stale cart entry must not silently check out at a price that no
  // longer matches what was actually designed/approved.
  const result = await priceCartItem(customItem({ designFrozenRevision: 1 }), fakeSupabase({ "design-1": frozen }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /changed since it was added/i);
});

test("CUSTOM: drinkware is always rejected to Request a Quote, even with valid frozen pricing", async () => {
  const frozen = {
    frozenAt: new Date().toISOString(),
    frozenRevision: 1,
    designSnapshot: frozenApparelSnapshot({ categorySlug: "drinkware", subcategorySlug: "tumblers" }),
  };
  const result = await priceCartItem(customItem({ designFrozenRevision: 1 }), fakeSupabase({ "design-1": frozen }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /priced by quote/i);
});

test("CUSTOM: correctly recomputes price from the server-side frozen snapshot -- (base + printing) x quantity, never any client-sent amount", async () => {
  const frozen = {
    frozenAt: new Date().toISOString(),
    frozenRevision: 1,
    designSnapshot: frozenApparelSnapshot(),
  };
  // CheckoutCartItemInput has no price field at all -- there is nothing for a malicious client to
  // override even in principle. unitBasePrice=10, chartFirstLocationCost=4, 1 printed location,
  // qty=24 -> (10 + 4) * 24 = $336.00 = 33600 cents.
  const result = await priceCartItem(customItem({ designFrozenRevision: 1 }), fakeSupabase({ "design-1": frozen }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.lineTotalCents, 33600);
    assert.equal(result.line.unitPriceCents, 1400);
    assert.equal(result.line.quantity, 24);
    assert.equal(result.line.customizationType, "CUSTOM");
    assert.equal(result.line.designFrozenRevision, 1);
  }
});

test("CUSTOM: printing cost scales correctly with multiple designed locations (first-location cost + additional-location cost per extra side)", async () => {
  const twoSidedSnapshot = frozenApparelSnapshot({
    sides: [
      { id: "s1", sideType: "front", printAreaWidth: 12, printAreaHeight: 16, objects: [{ id: "o1" } as never] },
      { id: "s2", sideType: "back", printAreaWidth: 12, printAreaHeight: 16, objects: [{ id: "o2" } as never] },
      // An empty side (no objects) must not count as a printed location.
      { id: "s3", sideType: "left-sleeve", printAreaWidth: 4, printAreaHeight: 4, objects: [] },
    ],
  });
  const frozen = { frozenAt: new Date().toISOString(), frozenRevision: 1, designSnapshot: twoSidedSnapshot };
  const result = await priceCartItem(customItem({ designFrozenRevision: 1 }), fakeSupabase({ "design-1": frozen }));
  assert.equal(result.ok, true);
  // (unitBasePrice=10 + chartFirstLocationCost=4 + chartAdditionalLocationCost=2 for the 2nd side) * 24
  if (result.ok) assert.equal(result.line.lineTotalCents, (10 + 4 + 2) * 24 * 100);
});

// --- BLANK branch: priced from the real static catalogue, never from client-sent fields ---

test("BLANK: rejects a product that doesn't exist in the catalogue", async () => {
  const result = await priceCartItem(
    {
      id: "x",
      name: "fake",
      categorySlug: "custom-apparel",
      categoryName: "Custom Apparel",
      quantity: 1,
      customizationType: "BLANK",
      productSlug: "this-product-does-not-exist",
      subcategorySlug: "t-shirts",
    },
    fakeSupabase({}),
  );
  assert.equal(result.ok, false);
});

test("BLANK: rejects an invalid (zero/negative/non-integer) quantity", async () => {
  for (const quantity of [0, -5, 1.5]) {
    const result = await priceCartItem(
      {
        id: "x",
        name: "AllPro tee",
        categorySlug: "custom-apparel",
        categoryName: "Custom Apparel",
        quantity,
        customizationType: "BLANK",
        productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
        subcategorySlug: "t-shirts",
      },
      fakeSupabase({}),
    );
    assert.equal(result.ok, false, `quantity ${quantity} should be rejected`);
  }
});

test("BLANK: a real priced catalogue product resolves to a real positive price, computed server-side", async () => {
  const result = await priceCartItem(
    {
      id: "x",
      name: "AllPro tee",
      categorySlug: "custom-apparel",
      categoryName: "Custom Apparel",
      quantity: 10,
      customizationType: "BLANK",
      productSlug: "allpro-men-s-pro-lock-performance-t-shirt",
      subcategorySlug: "t-shirts",
    },
    fakeSupabase({}),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.line.unitPriceCents > 0);
    assert.equal(result.line.lineTotalCents, result.line.unitPriceCents * 10);
    assert.equal(result.line.customizationType, "BLANK");
  }
});

test("BLANK: a price-list (quote-only) house product is rejected, not silently priced at $0", async () => {
  const result = await priceCartItem(
    {
      id: "x",
      name: "Business cards",
      categorySlug: "business-printing",
      categoryName: "Business Printing",
      quantity: 100,
      customizationType: "BLANK",
      productSlug: "standard-business-cards",
      subcategorySlug: "business-cards",
    },
    fakeSupabase({}),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /custom quote/i);
});

test("neither CUSTOM nor BLANK (e.g. MAPLE_DESIGNER, or the field omitted) is rejected to quote, never priced", async () => {
  const result = await priceCartItem(
    {
      id: "x",
      name: "Something",
      categorySlug: "custom-apparel",
      categoryName: "Custom Apparel",
      quantity: 1,
      customizationType: "MAPLE_DESIGNER",
    },
    fakeSupabase({}),
  );
  assert.equal(result.ok, false);
});

// --- lineShippingWeightLb: pure helper, shared by every branch above ---

test("lineShippingWeightLb: returns the product's real weight when known", () => {
  assert.equal(lineShippingWeightLb({ shippingWeightLb: 0.4 }), 0.4);
});

test("lineShippingWeightLb: returns null (never a guess) when unknown or product missing", () => {
  assert.equal(lineShippingWeightLb({ shippingWeightLb: null }), null);
  assert.equal(lineShippingWeightLb(null), null);
  assert.equal(lineShippingWeightLb(undefined), null);
});
