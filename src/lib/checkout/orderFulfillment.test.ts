import { test } from "node:test";
import assert from "node:assert/strict";
import { nextFulfillmentOptions } from "./orderFulfillment.ts";

test("a PAID order with no recorded fulfillment status yet offers only AWAITING_PRODUCTION", () => {
  const options = nextFulfillmentOptions(null, true);
  assert.deepEqual(options.map((o) => o.status), ["AWAITING_PRODUCTION"]);
});

test("AWAITING_PRODUCTION offers only IN_PRODUCTION, regardless of pickup/delivery", () => {
  assert.deepEqual(nextFulfillmentOptions("AWAITING_PRODUCTION", true).map((o) => o.status), ["IN_PRODUCTION"]);
  assert.deepEqual(nextFulfillmentOptions("AWAITING_PRODUCTION", false).map((o) => o.status), ["IN_PRODUCTION"]);
});

test("IN_PRODUCTION branches on fulfillment method -- pickup offers READY_FOR_PICKUP, delivery offers SHIPPED, never both", () => {
  assert.deepEqual(nextFulfillmentOptions("IN_PRODUCTION", true).map((o) => o.status), ["READY_FOR_PICKUP"]);
  assert.deepEqual(nextFulfillmentOptions("IN_PRODUCTION", false).map((o) => o.status), ["SHIPPED"]);
});

test("SHIPPED is the only option that requires a tracking number", () => {
  const shipped = nextFulfillmentOptions("IN_PRODUCTION", false)[0];
  assert.equal(shipped.requiresTracking, true);
  const readyForPickup = nextFulfillmentOptions("IN_PRODUCTION", true)[0];
  assert.equal(readyForPickup.requiresTracking, false);
});

test("READY_FOR_PICKUP and SHIPPED both converge on COMPLETED", () => {
  assert.deepEqual(nextFulfillmentOptions("READY_FOR_PICKUP", true).map((o) => o.status), ["COMPLETED"]);
  assert.deepEqual(nextFulfillmentOptions("SHIPPED", false).map((o) => o.status), ["COMPLETED"]);
});

test("COMPLETED is terminal -- no further options offered", () => {
  assert.deepEqual(nextFulfillmentOptions("COMPLETED", true), []);
  assert.deepEqual(nextFulfillmentOptions("COMPLETED", false), []);
});
