import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShippingQuoteRequestMessage } from "./shippingQuoteRequestMessage.ts";

const DELIVERY = { addressLine1: "123 Test St", city: "Ottawa", province: "ON", postalCode: "K1A 0B1" };

test("includes every cart item's real name, colour, and quantity -- never invents a price or rate", () => {
  const msg = buildShippingQuoteRequestMessage(
    [
      { name: "Men's Pro-Lock Performance T-Shirt", quantity: 2, colourName: "Black" },
      { name: "11oz Sublimation White Mug — Case of 36", quantity: 1, colourName: null },
    ],
    DELIVERY,
  );
  assert.ok(msg.includes("- Men's Pro-Lock Performance T-Shirt (Black) x2"));
  assert.ok(msg.includes("- 11oz Sublimation White Mug — Case of 36 x1"));
  assert.ok(!/\$\d/.test(msg), "must never include a dollar amount -- no rate is known yet");
});

test("includes the real delivery address the customer typed, including optional address line 2", () => {
  const msg = buildShippingQuoteRequestMessage(
    [{ name: "Test Product", quantity: 1 }],
    { ...DELIVERY, addressLine2: "Unit 4" },
  );
  assert.ok(msg.includes("123 Test St, Unit 4, Ottawa, ON, K1A 0B1"));
});

test("omits address line 2 cleanly when not provided, no stray empty segment", () => {
  const msg = buildShippingQuoteRequestMessage([{ name: "Test Product", quantity: 1 }], DELIVERY);
  assert.ok(msg.includes("123 Test St, Ottawa, ON, K1A 0B1"));
  assert.ok(!msg.includes(", ,"));
});

test("an empty item list still produces a valid message with no item lines, never throws", () => {
  const msg = buildShippingQuoteRequestMessage([], DELIVERY);
  assert.ok(msg.includes("Items:"));
  assert.ok(msg.includes("Delivery address:"));
});
