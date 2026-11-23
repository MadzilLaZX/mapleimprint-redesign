import { test } from "node:test";
import assert from "node:assert/strict";
import { findStoredShippingQuoteForOrder } from "./chitChatsStoredQuoteLookup.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeAdmin = {} as any;

test("returns null -- no real order today can have its fingerprint reliably recomputed (see this function's own header for the two real reasons why)", async () => {
  const result = await findStoredShippingQuoteForOrder(fakeAdmin, {
    shippingAddress: { addressLine1: "123 Test St", city: "Ottawa", province: "ON", postalCode: "K1V 8B9" },
    subtotalCents: 50000,
  });
  assert.equal(result, null);
});
