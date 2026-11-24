import { test } from "node:test";
import assert from "node:assert/strict";
import { findStoredShippingQuoteForOrder } from "./chitChatsStoredQuoteLookup.ts";

function fakeAdmin(row: Record<string, unknown> | null) {
  return {
    from(table: string) {
      if (table !== "MapleOrderShippingQuote") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({ data: row }),
          }),
        }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("returns null when no quote row exists for this order -- honest empty state, never fabricated", async () => {
  const result = await findStoredShippingQuoteForOrder(fakeAdmin(null), { id: "order-without-a-quote" });
  assert.equal(result, null);
});

test("returns the real, exact row when one exists, unmodified", async () => {
  const row = {
    carrier: "Chit Chats",
    service: "Tracked Packet",
    originalQuotedCents: 1499,
    chitChatsShipmentId: "shp_12345",
    quotedAt: "2026-11-24T00:00:00.000Z",
  };
  const result = await findStoredShippingQuoteForOrder(fakeAdmin(row), { id: "order-with-a-quote" });
  assert.deepEqual(result, row);
});
