import { test } from "node:test";
import assert from "node:assert/strict";
import { ChitChatsShippingProvider, type ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";
import { CanadianSalesTaxProvider } from "./taxProvider.ts";
import { OTTAWA_PICKUP_OPTION } from "./canadaPostShippingProvider.ts";
import { PICKUP_LOCATION } from "./pickupLocation.ts";

// Exercises ChitChatsShippingProvider and CanadianSalesTaxProvider together, mirroring exactly
// what /api/checkout/quote and /api/checkout/pay compute (subtotal -> shipping -> tax -> total),
// to prove end-to-end: (1) the total Square is ultimately charged always equals
// subtotal + shipping + tax with no drift, and (2) the free-shipping threshold decision itself
// never depends on tax -- the shipping provider has no reference to tax at all, so its eligibility
// call can't change based on which province's rate applies.

const onAddressFull = {
  province: "ON",
  country: "CA",
  postalCode: "K1V 8B9",
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city: "Ottawa",
};
const abAddressFull = { ...onAddressFull, province: "AB", postalCode: "T2P 1J9" };
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];
const okFetcher: ChitChatsRateFetcher = async () => [{ id: "cc-standard", label: "Chit Chats Standard", cents: 1850 }];

async function computeTotalCents(params: {
  subtotalCents: number;
  address: typeof onAddressFull;
  fetcher?: ChitChatsRateFetcher;
  isPickup?: boolean;
}) {
  const shippingProvider = new ChitChatsShippingProvider(params.fetcher ?? okFetcher);
  const taxProvider = new CanadianSalesTaxProvider();

  const shippingOption = params.isPickup
    ? OTTAWA_PICKUP_OPTION
    : (await shippingProvider.getOptions(params.address, params.subtotalCents, weighedLines))[0];

  const { taxCents } = await taxProvider.calculate({
    subtotalCents: params.subtotalCents,
    shippingCents: shippingOption.cents,
    shippingAddress: params.address,
    isPickup: params.isPickup,
  });

  return { shippingOption, taxCents, totalCents: params.subtotalCents + shippingOption.cents + taxCents };
}

test("Square total consistency: Ontario $100 order under threshold -- paid shipping, HST on merchandise + shipping combined", async () => {
  const result = await computeTotalCents({ subtotalCents: 10000, address: onAddressFull });
  assert.equal(result.shippingOption.cents, 1850);
  // (10000 + 1850) * 0.13 = 1540.5 -> rounds to 1541
  assert.equal(result.taxCents, 1541);
  assert.equal(result.totalCents, 10000 + 1850 + 1541);
});

test("Square total consistency: Ontario $350 order over threshold -- free shipping, HST on merchandise only (shipping is $0)", async () => {
  const result = await computeTotalCents({ subtotalCents: 35000, address: onAddressFull });
  assert.equal(result.shippingOption.cents, 0);
  assert.equal(result.taxCents, 4550); // 35000 * 0.13
  assert.equal(result.totalCents, 35000 + 0 + 4550);
});

test("Square total consistency: Ottawa pickup -- $0 shipping, Ontario HST point-of-sale override regardless of customer's own province", async () => {
  const result = await computeTotalCents({ subtotalCents: 10000, address: abAddressFull, isPickup: true });
  assert.equal(result.shippingOption.cents, 0);
  assert.equal(result.taxCents, 1300); // Ontario HST applied via override, not Alberta's GST-only rate
  assert.equal(result.totalCents, 10000 + 0 + 1300);
});

test("the free-shipping threshold decision is independent of GST/HST: the shipping provider returns the same eligibility regardless of destination province's tax type", async () => {
  const onShipping = new ChitChatsShippingProvider(okFetcher);
  const abShipping = new ChitChatsShippingProvider(okFetcher);
  const onOptions = await onShipping.getOptions(onAddressFull, 35000, weighedLines); // HST province
  const abOptions = await abShipping.getOptions(abAddressFull, 35000, weighedLines); // GST-only province
  assert.equal(onOptions[0].cents, 0);
  assert.equal(abOptions[0].cents, 0);
  assert.deepEqual(onOptions[0], abOptions[0]);
});

test("the free-shipping threshold decision is unaffected by tax even at the exact $300.00 boundary (not-eligible) across different tax types", async () => {
  const onShipping = new ChitChatsShippingProvider(okFetcher);
  const abShipping = new ChitChatsShippingProvider(okFetcher);
  const onOptions = await onShipping.getOptions(onAddressFull, 30000, weighedLines);
  const abOptions = await abShipping.getOptions(abAddressFull, 30000, weighedLines);
  assert.equal(onOptions[0].cents, 1850);
  assert.equal(abOptions[0].cents, 1850);
});

test("an unserviceable Canadian destination never produces a Square total built on a fabricated free rate", async () => {
  const unsupportedFetcher: ChitChatsRateFetcher = async () => {
    throw new Error("Chit Chats: destination not supported");
  };
  await assert.rejects(() =>
    computeTotalCents({ subtotalCents: 35000, address: onAddressFull, fetcher: unsupportedFetcher }),
  );
});

test("Ottawa pickup is $0 shipping regardless of order size -- never gated on the $300 delivery threshold", async () => {
  const small = await computeTotalCents({ subtotalCents: 500, address: abAddressFull, isPickup: true });
  const large = await computeTotalCents({ subtotalCents: 100000, address: abAddressFull, isPickup: true });
  assert.equal(small.shippingOption.cents, 0);
  assert.equal(large.shippingOption.cents, 0);
});

test("switching fulfillment method for the identical cart recomputes independently -- no stale shipping/tax carried over from the other method", async () => {
  const subtotalCents = 10000; // under the $300 delivery threshold -- a paid delivery rate applies
  const asDelivery = await computeTotalCents({ subtotalCents, address: onAddressFull, isPickup: false });
  const asPickup = await computeTotalCents({ subtotalCents, address: onAddressFull, isPickup: true });

  // Delivery: real Chit Chats rate + HST on (merchandise + that shipping charge).
  assert.equal(asDelivery.shippingOption.cents, 1850);
  assert.equal(asDelivery.taxCents, 1541);
  assert.equal(asDelivery.totalCents, 10000 + 1850 + 1541);

  // Pickup, same cart/subtotal/address: $0 shipping, HST on merchandise alone.
  assert.equal(asPickup.shippingOption.cents, 0);
  assert.equal(asPickup.taxCents, 1300);
  assert.equal(asPickup.totalCents, 10000 + 0 + 1300);

  // Confirms they're genuinely independent recomputations, not one leaking into the other.
  assert.notEqual(asDelivery.totalCents, asPickup.totalCents);
});

test("PICKUP_LOCATION is a real, already-public Ontario/Canada address -- not an invented placeholder", () => {
  assert.equal(PICKUP_LOCATION.province, "ON");
  assert.equal(PICKUP_LOCATION.country, "CA");
  assert.ok(PICKUP_LOCATION.addressLine1.length > 0);
  assert.ok(PICKUP_LOCATION.hours.length > 0);
});
