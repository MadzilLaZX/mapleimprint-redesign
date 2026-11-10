import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CanadaPostShippingProvider,
  OTTAWA_PICKUP_OPTION,
  FREE_SHIPPING_THRESHOLD_CENTS,
  ShippingRateUnavailableError,
  estimateParcelWeightLb,
} from "./canadaPostShippingProvider.ts";

const address = { province: "ON", country: "CA", postalCode: "K1V 8B9" };

test("free shipping kicks in above the $300 threshold, pickup always offered", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1);
  assert.deepEqual(
    options.map((o) => o.id),
    ["ottawa-pickup", "free"],
  );
  assert.equal(options.find((o) => o.id === "free")?.cents, 0);
});

test("exactly at the threshold does NOT qualify for free shipping (over, not at-or-over)", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS);
  assert.ok(!options.some((o) => o.id === "free"));
});

test("one cent over the threshold does qualify", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1);
  assert.ok(options.some((o) => o.id === "free"));
});

test("at or below the threshold with a valid address but no live rate configured: degrades to pickup-only, does not block checkout", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS);
  assert.deepEqual(
    options.map((o) => o.id),
    ["ottawa-pickup"],
  );
});

test("an invalid postal code is rejected with a customer-fixable error, not a generic failure", async () => {
  const provider = new CanadaPostShippingProvider();
  const bad = { province: "ON", country: "CA", postalCode: "not-a-postal-code" };
  await assert.rejects(() => provider.getOptions(bad, 1000), ShippingRateUnavailableError);
});

test("a non-Canadian address is rejected clearly (Maple ships within Canada only today)", async () => {
  const provider = new CanadaPostShippingProvider();
  const us = { province: "NY", country: "US", postalCode: "10001" };
  await assert.rejects(() => provider.getOptions(us, 1000), /Canadian addresses/);
});

test("an empty province is rejected", async () => {
  const provider = new CanadaPostShippingProvider();
  const noProvince = { province: "", country: "CA", postalCode: "K1V 8B9" };
  await assert.rejects(() => provider.getOptions(noProvince, 1000), /Select a province/);
});

test("Ottawa pickup is always free", () => {
  assert.equal(OTTAWA_PICKUP_OPTION.cents, 0);
});

test("estimateParcelWeightLb sums unit weight across quantities", () => {
  const total = estimateParcelWeightLb([
    { unitWeightLb: 0.5, quantity: 3 },
    { unitWeightLb: 1.776, quantity: 2 },
  ]);
  assert.equal(total, 0.5 * 3 + 1.776 * 2);
});

test("estimateParcelWeightLb returns null rather than under-counting a parcel with an unknown weight", () => {
  assert.equal(
    estimateParcelWeightLb([
      { unitWeightLb: 0.5, quantity: 1 },
      { unitWeightLb: null, quantity: 1 },
    ]),
    null,
  );
});

test("estimateParcelWeightLb returns null for an empty cart", () => {
  assert.equal(estimateParcelWeightLb([]), null);
});

test("estimateParcelWeightLb rejects a zero or negative quantity line rather than ignoring it", () => {
  assert.equal(estimateParcelWeightLb([{ unitWeightLb: 0.5, quantity: 0 }]), null);
  assert.equal(estimateParcelWeightLb([{ unitWeightLb: 0.5, quantity: -1 }]), null);
});

test("estimateParcelWeightLb handles a large multi-product, multi-quantity cart correctly", () => {
  // Simulates a realistic mixed order: several different products, several units each.
  const total = estimateParcelWeightLb([
    { unitWeightLb: 0.35, quantity: 12 }, // t-shirts
    { unitWeightLb: 1.2, quantity: 3 }, // hoodies
    { unitWeightLb: 0.08, quantity: 50 }, // stickers
  ]);
  assert.equal(total, 0.35 * 12 + 1.2 * 3 + 0.08 * 50);
});
