import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChitChatsQuoteKey } from "./chitChatsShippingProvider.ts";
import { buildQuoteFingerprint } from "./chitChatsQuoteStore.ts";
import { associateShippingQuoteWithOrder } from "./chitChatsOrderQuoteAssociation.ts";

const ON_FULL = { province: "ON", country: "CA", postalCode: "K1V 8B9", name: "Test Customer", addressLine1: "123 Test St", city: "Ottawa" };

test("buildChitChatsQuoteKey returns null when no line has a usable weight -- the same case getOptions() itself rejects", () => {
  const key = buildChitChatsQuoteKey(ON_FULL, 10_000, [{ unitWeightLb: null, quantity: 1 }]);
  assert.equal(key, null);
});

test("buildChitChatsQuoteKey falls back to weight-only (null dimensions) when no real packaging profile applies -- today's universal case", () => {
  const key = buildChitChatsQuoteKey(ON_FULL, 10_000, [{ unitWeightLb: 2, quantity: 3 }]);
  assert.ok(key);
  assert.equal(key!.pkg.dimensionsIn, null);
  assert.equal(key!.pkg.weightLb, 6);
});

test("buildChitChatsQuoteKey produces the SAME fingerprint for the same real inputs -- this is what makes pay-time lookup reliable, unlike reconstructing one from stored order data later", () => {
  const lines = [{ unitWeightLb: 2, quantity: 3 }];
  const keyA = buildChitChatsQuoteKey(ON_FULL, 10_000, lines);
  const keyB = buildChitChatsQuoteKey(ON_FULL, 10_000, lines);
  assert.equal(buildQuoteFingerprint(keyA!), buildQuoteFingerprint(keyB!));
});

// --- associateShippingQuoteWithOrder: fake supabaseAdmin covering both tables it touches ---

function fakeAdmin(opts: {
  persistedQuote?: { chitChatsShipmentId: string | null; rates: { id: string; label: string; cents: number }[] | null; createdAt: string; expiresAt: string } | null;
  upsertedRows?: Record<string, unknown>[];
}) {
  const upsertedRows = opts.upsertedRows ?? [];
  return {
    from(table: string) {
      if (table === "ChitChatsShippingQuote") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: async () => ({ data: opts.persistedQuote ?? null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "MapleOrderShippingQuote") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            upsertedRows.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`fakeAdmin: unexpected table "${table}"`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const LINES = [{ unitWeightLb: 2, quantity: 1, productId: "test-product" }];

test("associates nothing when no persisted quote exists -- never fabricates a quote to fill the gap", async () => {
  const upsertedRows: Record<string, unknown>[] = [];
  const admin = fakeAdmin({ persistedQuote: null, upsertedRows });
  await associateShippingQuoteWithOrder(admin, "order-1", ON_FULL, 10_000, LINES, { id: "free", label: "Free Shipping", cents: 0 });
  assert.deepEqual(upsertedRows, []);
});

test("recovers the ORIGINAL (pre-free-shipping-override) rate when the selected option is 'free' -- preserves what Chit Chats actually quoted, not the $0 the customer was charged", async () => {
  const upsertedRows: Record<string, unknown>[] = [];
  const admin = fakeAdmin({
    persistedQuote: {
      chitChatsShipmentId: "shp_abc",
      rates: [
        { id: "tracked_packet", label: "Tracked Packet", cents: 1299 },
        { id: "expedited", label: "Expedited Parcel", cents: 2499 },
      ],
      createdAt: "2026-11-24T00:00:00.000Z",
      expiresAt: "2026-11-24T00:10:00.000Z",
    },
    upsertedRows,
  });
  // Selected option is "free" -- the override already applied; the real pre-discount entry is the
  // cheapest raw one (tracked_packet, 1299), not the pricier expedited option.
  await associateShippingQuoteWithOrder(admin, "order-2", ON_FULL, 40_000, LINES, { id: "free", label: "Free Shipping", cents: 0 });
  assert.equal(upsertedRows.length, 1);
  const row = upsertedRows[0];
  assert.equal(row.orderId, "order-2");
  assert.equal(row.service, "Tracked Packet");
  assert.equal(row.serviceCode, "tracked_packet");
  assert.equal(row.originalQuotedCents, 1299);
  assert.equal(row.chitChatsShipmentId, "shp_abc");
  assert.equal(row.quotedAt, "2026-11-24T00:00:00.000Z");
});

test("matches a non-free selected option by its real id directly -- no override to reverse", async () => {
  const upsertedRows: Record<string, unknown>[] = [];
  const admin = fakeAdmin({
    persistedQuote: {
      chitChatsShipmentId: "shp_xyz",
      rates: [{ id: "tracked_packet", label: "Tracked Packet", cents: 1299 }],
      createdAt: "2026-11-24T00:00:00.000Z",
      expiresAt: "2026-11-24T00:10:00.000Z",
    },
    upsertedRows,
  });
  await associateShippingQuoteWithOrder(admin, "order-3", ON_FULL, 1_000, LINES, { id: "tracked_packet", label: "Tracked Packet", cents: 1299 });
  assert.equal(upsertedRows.length, 1);
  assert.equal(upsertedRows[0].originalQuotedCents, 1299);
});

test("associates nothing when the selected option doesn't correspond to any raw entry in the persisted quote -- never guesses a mismatched amount", async () => {
  const upsertedRows: Record<string, unknown>[] = [];
  const admin = fakeAdmin({
    persistedQuote: {
      chitChatsShipmentId: "shp_123",
      rates: [{ id: "tracked_packet", label: "Tracked Packet", cents: 1299 }],
      createdAt: "2026-11-24T00:00:00.000Z",
      expiresAt: "2026-11-24T00:10:00.000Z",
    },
    upsertedRows,
  });
  await associateShippingQuoteWithOrder(admin, "order-4", ON_FULL, 1_000, LINES, { id: "some-other-service", label: "Mystery Service", cents: 500 });
  assert.deepEqual(upsertedRows, []);
});

test("never throws, even if the underlying client throws -- checkout must never break because of this best-effort step", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const throwingAdmin = { from: () => { throw new Error("simulated DB outage"); } } as any;
  await assert.doesNotReject(() => associateShippingQuoteWithOrder(throwingAdmin, "order-5", ON_FULL, 1_000, LINES, { id: "free", label: "Free Shipping", cents: 0 }));
});

test("no parcel weight (every line unweighed) -- associates nothing, never attempts a lookup", async () => {
  const upsertedRows: Record<string, unknown>[] = [];
  const admin = fakeAdmin({ persistedQuote: { chitChatsShipmentId: "shp_1", rates: [{ id: "x", label: "X", cents: 100 }], createdAt: "2026-11-24T00:00:00.000Z", expiresAt: "2026-11-24T00:10:00.000Z" }, upsertedRows });
  await associateShippingQuoteWithOrder(admin, "order-6", ON_FULL, 1_000, [{ unitWeightLb: null, quantity: 1 }], { id: "x", label: "X", cents: 100 });
  assert.deepEqual(upsertedRows, []);
});
