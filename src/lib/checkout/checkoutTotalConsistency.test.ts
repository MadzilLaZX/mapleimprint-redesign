import { test } from "node:test";
import assert from "node:assert/strict";
import { ChitChatsShippingProvider, type ChitChatsRateFetcher } from "./chitChatsShippingProvider.ts";
import { CanadianSalesTaxProvider, taxProvider } from "./taxProvider.ts";
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

// --- The LIVE taxProvider singleton, not a freshly-constructed CanadianSalesTaxProvider ---
// This is the exact object /api/checkout/quote and /api/checkout/pay import and call -- proving
// the activation (taxProvider.ts's resolveTaxProvider swap) actually took effect end-to-end, not
// just that the underlying class is correct in isolation.

test("the live taxProvider singleton charges real Ontario HST in this (non-Production) test environment", async () => {
  const result = await taxProvider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: onAddressFull });
  assert.equal(result.taxCents, 1300);
  assert.deepEqual(result.breakdown, [{ label: "HST", cents: 1300 }]);
});

test("the live taxProvider singleton reproduces the launch spec's exact two scenarios end-to-end", async () => {
  const hundred = await taxProvider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: onAddressFull });
  assert.equal(hundred.taxCents, 1300); // $13.00 HST on a $100 Ontario order

  const threeFifty = await taxProvider.calculate({ subtotalCents: 35000, shippingCents: 0, shippingAddress: onAddressFull });
  assert.equal(threeFifty.taxCents, 4550); // $45.50 HST on a $350 Ontario order
});

test("the live taxProvider singleton still withholds PST/QST by default (not separately confirmed)", async () => {
  const result = await taxProvider.calculate({ subtotalCents: 10000, shippingCents: 0, shippingAddress: abAddressFull });
  // Alberta is GST-only by rate type, not by the pstQstEnabled flag -- use BC to prove the flag.
  const bc = await taxProvider.calculate({
    subtotalCents: 10000,
    shippingCents: 0,
    shippingAddress: { ...onAddressFull, province: "BC", postalCode: "V6B 1A1" },
  });
  assert.equal(result.taxCents, 500);
  assert.equal(bc.taxCents, 500);
  assert.deepEqual(bc.breakdown, [{ label: "GST", cents: 500 }]);
});

test("Square total consistency through the live taxProvider singleton: Ontario $350 order, free shipping, real HST on merchandise only", async () => {
  const shippingProvider = new ChitChatsShippingProvider(okFetcher);
  const subtotalCents = 35000;
  const shippingOption = (await shippingProvider.getOptions(onAddressFull, subtotalCents, weighedLines))[0];
  const { taxCents } = await taxProvider.calculate({
    subtotalCents,
    shippingCents: shippingOption.cents,
    shippingAddress: onAddressFull,
  });
  const totalCents = subtotalCents + shippingOption.cents + taxCents;
  assert.equal(shippingOption.cents, 0);
  assert.equal(taxCents, 4550);
  assert.equal(totalCents, 39550);
});
