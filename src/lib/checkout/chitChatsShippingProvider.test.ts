import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ChitChatsShippingProvider,
  FREE_SHIPPING_THRESHOLD_CENTS,
  type ChitChatsPackageInput,
} from "./chitChatsShippingProvider.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";
import type { ShippingAddressInput } from "./shippingProvider.ts";

const caAddressMinimal = { province: "ON", country: "CA", postalCode: "K1V 8B9" };
const caAddressFull = {
  ...caAddressMinimal,
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city: "Ottawa",
};
const usAddressFull = {
  province: "NY",
  country: "US",
  postalCode: "10001",
  name: "Jamie Customer",
  addressLine1: "500 5th Ave",
  city: "New York",
};
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];

test("Canadian order over $300 before tax qualifies for free shipping", async () => {
  const provider = new ChitChatsShippingProvider();
  const options = await provider.getOptions(caAddressMinimal, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("exactly $300.00 does not qualify (over, not at-or-over) -- falls through to a paid quote attempt", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS, weighedLines),
    ShippingRateUnavailableError,
  );
});

test("$300.01 does qualify for free shipping", async () => {
  const provider = new ChitChatsShippingProvider();
  const options = await provider.getOptions(caAddressMinimal, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
  assert.ok(options.some((o) => o.id === "free"));
});

test("an international order over $300 does NOT qualify for free shipping -- the promotion is Canada-only", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(usAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 100000, weighedLines),
    ShippingRateUnavailableError,
  );
});

test("an invalid/unsupported address does not qualify for free shipping just because the subtotal is high enough", async () => {
  const provider = new ChitChatsShippingProvider();
  const badPostal = { province: "ON", country: "CA", postalCode: "not-a-postal-code" };
  await assert.rejects(
    () => provider.getOptions(badPostal, FREE_SHIPPING_THRESHOLD_CENTS + 1, []),
    ShippingRateUnavailableError,
  );
});

test("a missing province is rejected for any destination, before the free-shipping check", async () => {
  const provider = new ChitChatsShippingProvider();
  const noProvince = { province: "", country: "CA", postalCode: "K1V 8B9" };
  await assert.rejects(() => provider.getOptions(noProvince, FREE_SHIPPING_THRESHOLD_CENTS + 1, []), /province/);
});

test("a cart with no authoritative weight is rejected with a specific message once past the free-shipping and address checks", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, []),
    /shipping weight for everything in your cart/,
  );
});

test("a cart with one unweighed line among weighed ones is still rejected -- partial weight data is not good enough", async () => {
  const provider = new ChitChatsShippingProvider();
  const mixed = [{ unitWeightLb: 1, quantity: 1 }, { unitWeightLb: null, quantity: 1 }];
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, mixed),
    /shipping weight for everything in your cart/,
  );
});

test("a quote-step address missing name/street/city is rejected with an honest, specific message, distinct from the weight-gate message", async () => {
  const provider = new ChitChatsShippingProvider();
  // Exactly what /api/checkout/quote sends today -- province/country/postalCode only.
  await assert.rejects(
    () => provider.getOptions(caAddressMinimal, 1000, weighedLines),
    /full shipping address/,
  );
});

test("a cart where every line has weight AND the address has full fields reaches the credential-missing failure instead", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, weighedLines),
    /not available yet|aren't available/,
  );
});

test("an international destination with full address/weight data reaches the live-rate call (not rejected just for being international)", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(usAddressFull, 1000, weighedLines),
    /not available yet|aren't available/,
  );
});

test("a delivery quote that cannot be resolved throws -- it must never silently become a pickup-only or free result", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(() => provider.getOptions(caAddressFull, 1000, weighedLines), ShippingRateUnavailableError);
});

test("getOptions() threads the real computed parcel weight through to the rate fetcher for a multi-item, multi-quantity cart", async () => {
  let receivedWeight: number | null = null;
  const fakeFetcher = async (_addr: ShippingAddressInput, _subtotal: number, pkg: ChitChatsPackageInput) => {
    receivedWeight = pkg.weightLb;
    return { id: "live", label: "Chit Chats", cents: 1850 };
  };
  const provider = new ChitChatsShippingProvider(fakeFetcher);
  const multiItemCart = [
    { unitWeightLb: 0.35, quantity: 3 }, // t-shirts
    { unitWeightLb: 1.2, quantity: 2 }, // hoodies
    { unitWeightLb: 0.08, quantity: 10 }, // stickers
  ];
  const options = await provider.getOptions(caAddressFull, 1000, multiItemCart);
  assert.equal(receivedWeight, 0.35 * 3 + 1.2 * 2 + 0.08 * 10);
  assert.deepEqual(options, [{ id: "live", label: "Chit Chats", cents: 1850 }]);
});

test("getOptions() passes dimensionsIn as null -- no per-product dimension data exists anywhere in the catalogue today", async () => {
  let receivedDimensions: unknown = "not called";
  const fakeFetcher = async (_addr: ShippingAddressInput, _subtotal: number, pkg: ChitChatsPackageInput) => {
    receivedDimensions = pkg.dimensionsIn;
    return { id: "live", label: "Chit Chats", cents: 1850 };
  };
  const provider = new ChitChatsShippingProvider(fakeFetcher);
  await provider.getOptions(caAddressFull, 1000, weighedLines);
  assert.equal(receivedDimensions, null);
});

test("a simulated Chit Chats API failure propagates as a clear, catchable error rather than crashing or defaulting to a flat rate", async () => {
  const flakyFetcher = async () => {
    throw new Error("ECONNRESET: Chit Chats API unreachable");
  };
  const provider = new ChitChatsShippingProvider(flakyFetcher);
  await assert.rejects(() => provider.getOptions(caAddressFull, 1000, weighedLines), /ECONNRESET/);
});

test("Ottawa pickup is never returned by this provider -- it must be offered by the caller independently", async () => {
  const provider = new ChitChatsShippingProvider();
  const freeOptions = await provider.getOptions(caAddressMinimal, FREE_SHIPPING_THRESHOLD_CENTS + 1, []);
  assert.ok(!freeOptions.some((o) => o.id === "ottawa-pickup"));
});
