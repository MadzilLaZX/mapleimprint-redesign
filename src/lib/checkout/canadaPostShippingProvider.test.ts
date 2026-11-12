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

// Every cart-line weight exports as null today (migration 008 + its backfill haven't run --
// see this file's header), so most existing tests below use [] and rely on an earlier check
// (free-shipping threshold or address validation) throwing/returning first. Tests that
// specifically want to reach PAST the weight gate, to assert the credential-missing failure
// underneath it, use this fixture instead.
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];

test("free shipping kicks in above the $300 threshold", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
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
  await assert.rejects(
    () => provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS, weighedLines),
    ShippingRateUnavailableError,
  );
});

test("one cent over the threshold does qualify for free shipping", async () => {
  const provider = new CanadaPostShippingProvider();
  const options = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
  assert.ok(options.some((o) => o.id === "free"));
});

test("a delivery quote that cannot be resolved throws -- it must never silently become a pickup-only result", async () => {
  // This is the core safety property: a customer who asked for delivery and can't get a rate
  // must see a clear failure (and have delivery checkout blocked), never a quiet substitution of
  // a fulfillment method they never chose. getOptions() must not return an empty or
  // pickup-flavoured array here -- it must throw.
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000, weighedLines), ShippingRateUnavailableError);
});

test("the delivery-unavailable error message is honest about why, not generic", async () => {
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000, weighedLines), /not available yet|aren't available/);
});

test("an invalid postal code is rejected with a customer-fixable error, not a generic failure", async () => {
  const provider = new CanadaPostShippingProvider();
  const bad = { province: "ON", country: "CA", postalCode: "not-a-postal-code" };
  await assert.rejects(() => provider.getOptions(bad, 1000, weighedLines), ShippingRateUnavailableError);
});

test("a non-Canadian address is rejected clearly (Maple ships within Canada only today)", async () => {
  const provider = new CanadaPostShippingProvider();
  const us = { province: "NY", country: "US", postalCode: "10001" };
  await assert.rejects(() => provider.getOptions(us, 1000, weighedLines), /Canadian addresses/);
});

test("an invalid address does NOT qualify for free shipping just because the subtotal is high enough -- address validation runs first", async () => {
  const provider = new CanadaPostShippingProvider();
  const us = { province: "NY", country: "US", postalCode: "10001" };
  await assert.rejects(
    () => provider.getOptions(us, FREE_SHIPPING_THRESHOLD_CENTS + 1, []),
    /Canadian addresses/,
  );
});

test("an empty province is rejected", async () => {
  const provider = new CanadaPostShippingProvider();
  const noProvince = { province: "", country: "CA", postalCode: "K1V 8B9" };
  await assert.rejects(() => provider.getOptions(noProvince, 1000, weighedLines), /Select a province/);
});

test("Ottawa pickup is exported as a separate constant, not bundled into getOptions()'s return", async () => {
  // Pickup must be something the CALLER offers independently and unconditionally -- never a
  // value this provider returns as part of (or in place of) a delivery quote.
  assert.equal(OTTAWA_PICKUP_OPTION.cents, 0);
  assert.equal(OTTAWA_PICKUP_OPTION.id, "ottawa-pickup");

  const provider = new CanadaPostShippingProvider();
  const freeShippingOptions = await provider.getOptions(address, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
  assert.ok(!freeShippingOptions.some((o) => o.id === "ottawa-pickup"), "getOptions() must never include pickup itself");
});

test("a cart with no authoritative weight data is rejected with a specific, honest message -- not the generic credential-missing one", async () => {
  // Today this is every real cart (migration 008 + its backfill haven't run), so this is the
  // actual failure a real customer hitting this code path right now would see.
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000, []), ShippingRateUnavailableError);
  await assert.rejects(() => provider.getOptions(address, 1000, []), /shipping weight for everything in your cart/);
});

test("a cart with one unweighed line among weighed ones is still rejected -- partial weight data is not good enough", async () => {
  const provider = new CanadaPostShippingProvider();
  const mixed = [{ unitWeightLb: 1, quantity: 1 }, { unitWeightLb: null, quantity: 1 }];
  await assert.rejects(() => provider.getOptions(address, 1000, mixed), /shipping weight for everything in your cart/);
});

test("a cart where every line has authoritative weight passes the weight gate and reaches the credential-missing failure instead", async () => {
  // Confirms the weight gate and the credential gate are genuinely separate checks with distinct
  // messages, not the same error reused -- this is what proves the weight gate is actually wired
  // in, rather than every getOptions() call failing before ever reaching it regardless of weight.
  const provider = new CanadaPostShippingProvider();
  await assert.rejects(() => provider.getOptions(address, 1000, weighedLines), /not available yet|aren't available/);
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

test("getOptions() threads the real computed parcel weight through to the rate fetcher -- not just the gate, the actual call", async () => {
  // Confirms a real fix: estimateParcelWeightLb()'s result was computed but never actually
  // passed to the function that will eventually build a real Canada Post rate request. An
  // injected fake fetcher lets this be verified without a live Canada Post account.
  let receivedWeight: number | null = null;
  const fakeFetcher = async (_addr: typeof address, _subtotal: number, parcelWeightLb: number) => {
    receivedWeight = parcelWeightLb;
    return { id: "live", label: "Canada Post", cents: 1500 };
  };
  const provider = new CanadaPostShippingProvider(fakeFetcher);
  const mixedCartLines = [
    { unitWeightLb: 0.35, quantity: 2 },
    { unitWeightLb: 1.2, quantity: 1 },
  ];
  const options = await provider.getOptions(address, 1000, mixedCartLines);
  assert.equal(receivedWeight, 0.35 * 2 + 1.2 * 1);
  assert.deepEqual(options, [{ id: "live", label: "Canada Post", cents: 1500 }]);
});
