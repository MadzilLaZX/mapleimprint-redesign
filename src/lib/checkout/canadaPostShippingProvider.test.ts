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

test("free shipping kicks in above the $300 threshold", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1);
  assert.deepEqual(
    options.map((o) => o.id),
    ["free"],
  );
  assert.equal(options[0].cents, 0);
});

test("exactly at the threshold does NOT qualify for free shipping (over, not at-or-over)", async () => {
  // At the threshold, a live rate is attempted (and currently always throws, not configured yet)
  // -- this asserts the boundary itself, independent of whether a live rate is ever resolved.
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS), ShippingRateUnavailableError);
});

test("one cent over the threshold does qualify for free shipping", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1);
  assert.ok(options.some((o) => o.id === "free"));
});

test("a delivery quote that cannot be resolved throws -- it must never silently become a pickup-only result", async () => {
  // This is the core safety property: a customer who asked for delivery and can't get a rate
  // must see a clear failure (and have delivery checkout blocked), never a quiet substitution of
  // a fulfillment method they never chose. getOptions() must not return an empty or
  // pickup-flavoured array here -- it must throw.
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000), ShippingRateUnavailableError);
});

test("the delivery-unavailable error message is honest about why, not generic", async () => {
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000), /not available yet|aren't available/);
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

test("Ottawa pickup is exported as a separate constant, not bundled into getOptions()'s return", async () => {
  // Pickup must be something the CALLER offers independently and unconditionally -- never a
  // value this provider returns as part of (or in place of) a delivery quote.
  assert.equal(OTTAWA_PICKUP_OPTION.cents, 0);
  assert.equal(OTTAWA_PICKUP_OPTION.id, "ottawa-pickup");

  const provider = new CanadaPostShippingProvider();
  const freeShippingOptions = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1);
  assert.ok(!freeShippingOptions.some((o) => o.id === "ottawa-pickup"), "getOptions() must never include pickup itself");
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
