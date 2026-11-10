import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CanadaPostShippingProvider,
  OTTAWA_PICKUP_OPTION,
  FREE_SHIPPING_THRESHOLD_CENTS,
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

test("at or below the threshold, live rating is attempted and throws rather than fabricating a quote", async () => {
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(
    () => provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS),
    /not configured yet/,
  );
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
