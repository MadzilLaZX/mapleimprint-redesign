import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ChitChatsShippingProvider,
  FREE_SHIPPING_THRESHOLD_CENTS,
  type ChitChatsPackageInput,
  type ChitChatsRateFetcher,
} from "./chitChatsShippingProvider.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";
import type { ShippingAddressInput, ShippingOption } from "./shippingProvider.ts";

const fullAddress = (province: string, city = "Ottawa"): ShippingAddressInput => ({
  province,
  country: "CA",
  postalCode: "K1V 8B9",
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city,
});
const caAddressMinimal = { province: "ON", country: "CA", postalCode: "K1V 8B9" };
const caAddressFull = fullAddress("ON");
const usAddressFull: ShippingAddressInput = {
  province: "NY",
  country: "US",
  postalCode: "10001",
  name: "Jamie Customer",
  addressLine1: "500 5th Ave",
  city: "New York",
};
const weighedLines = [{ unitWeightLb: 1, quantity: 1 }];

// A working fetcher standing in for a successful Chit Chats quote -- used by every test that
// needs to get PAST serviceability confirmation (see this provider's header note: a real quote
// attempt is now how serviceability itself is validated, so even the free-shipping tests need a
// fetcher that would actually succeed).
const okFetcher: ChitChatsRateFetcher = async () => [{ id: "cc-standard", label: "Chit Chats Standard", cents: 1850 }];

const CANADIAN_PROVINCES_AND_TERRITORIES = ["ON", "QC", "NS", "NB", "MB", "BC", "PE", "SK", "AB", "NL", "NT", "YT", "NU"];

test("all 10 provinces and 3 territories are geographically eligible for free shipping once serviceable", async () => {
  for (const province of CANADIAN_PROVINCES_AND_TERRITORIES) {
    const provider = new ChitChatsShippingProvider(okFetcher);
    const options = await provider.getOptions(fullAddress(province), FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
    assert.ok(options.some((o) => o.id === "free"), `expected free shipping to be offered for ${province}`);
  }
});

test("exactly $300.00 does not qualify (over, not at-or-over) -- stays at the real quoted rate", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const options = await provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS, weighedLines);
  assert.deepEqual(options, [{ id: "cc-standard", label: "Chit Chats Standard", cents: 1850 }]);
});

test("$300.01 does qualify for free shipping", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const options = await provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
  assert.deepEqual(options, [{ id: "free", label: "Free Shipping", cents: 0 }]);
});

test("an international order over $300 does NOT qualify for free shipping -- the promotion is Canada-only", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const options = await provider.getOptions(usAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 100000, weighedLines);
  assert.ok(!options.some((o) => o.id === "free"));
  assert.deepEqual(options, [{ id: "cc-standard", label: "Chit Chats Standard", cents: 1850 }]);
});

test("international destinations still get a real calculated rate where Chit Chats supports them", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const options = await provider.getOptions(usAddressFull, 1000, weighedLines);
  assert.deepEqual(options, [{ id: "cc-standard", label: "Chit Chats Standard", cents: 1850 }]);
});

test("a destination Chit Chats cannot service does NOT fall back to a fabricated free rate, even over $300 in Canada", async () => {
  const unsupportedFetcher: ChitChatsRateFetcher = async () => {
    throw new ShippingRateUnavailableError("Chit Chats does not support deliveries to this address.");
  };
  const provider = new ChitChatsShippingProvider(unsupportedFetcher);
  await assert.rejects(
    () => provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines),
    /does not support deliveries/,
  );
});

test("an oversized/restricted parcel is routed to a manual quote, not a fabricated $0 rate, even over $300 in Canada", async () => {
  const oversizedFetcher: ChitChatsRateFetcher = async () => {
    throw new ShippingRateUnavailableError("This parcel exceeds Chit Chats' size limits for this destination.");
  };
  const provider = new ChitChatsShippingProvider(oversizedFetcher);
  await assert.rejects(
    () => provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines),
    /exceeds Chit Chats' size limits/,
  );
});

test("a fetcher that resolves with zero rates (no deliverable service) throws rather than treating the destination as free", async () => {
  const emptyFetcher: ChitChatsRateFetcher = async () => [];
  const provider = new ChitChatsShippingProvider(emptyFetcher);
  await assert.rejects(
    () => provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines),
    /no delivery service available/,
  );
});

test("multiple service levels: only the cheapest (standard) becomes free -- expedited/premium keep their own charge", async () => {
  const multiRateFetcher: ChitChatsRateFetcher = async () => [
    { id: "cc-expedited", label: "Chit Chats Expedited", cents: 4200 },
    { id: "cc-standard", label: "Chit Chats Standard", cents: 1850 },
  ];
  const provider = new ChitChatsShippingProvider(multiRateFetcher);
  const options = await provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
  assert.deepEqual(options, [
    { id: "free", label: "Free Shipping", cents: 0 },
    { id: "cc-expedited", label: "Chit Chats Expedited", cents: 4200 },
  ]);
});

test("multiple service levels when NOT eligible for free shipping: every option stays at its real quoted price", async () => {
  const multiRateFetcher: ChitChatsRateFetcher = async () => [
    { id: "cc-standard", label: "Chit Chats Standard", cents: 1850 },
    { id: "cc-expedited", label: "Chit Chats Expedited", cents: 4200 },
  ];
  const provider = new ChitChatsShippingProvider(multiRateFetcher);
  const options = await provider.getOptions(caAddressFull, 1000, weighedLines);
  assert.deepEqual(options, [
    { id: "cc-standard", label: "Chit Chats Standard", cents: 1850 },
    { id: "cc-expedited", label: "Chit Chats Expedited", cents: 4200 },
  ]);
});

test("an invalid/unsupported-format address does not qualify for free shipping just because the subtotal is high enough", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const badPostal = { province: "ON", country: "CA", postalCode: "not-a-postal-code" };
  await assert.rejects(
    () => provider.getOptions(badPostal, FREE_SHIPPING_THRESHOLD_CENTS + 1, []),
    ShippingRateUnavailableError,
  );
});

test("a missing province is rejected for any destination, before any rate attempt", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const noProvince = { province: "", country: "CA", postalCode: "K1V 8B9" };
  await assert.rejects(() => provider.getOptions(noProvince, FREE_SHIPPING_THRESHOLD_CENTS + 1, []), /province/);
});

test("a cart with no authoritative weight is rejected with a specific message, before any rate attempt", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, []),
    /shipping weight for everything in your cart/,
  );
});

test("a cart with one unweighed line among weighed ones is still rejected -- partial weight data is not good enough", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const mixed = [{ unitWeightLb: 1, quantity: 1 }, { unitWeightLb: null, quantity: 1 }];
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, mixed),
    /shipping weight for everything in your cart/,
  );
});

test("a quote-step address missing name/street/city is rejected with an honest, specific message -- even on an otherwise-eligible order", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  // Exactly what /api/checkout/quote sends today -- province/country/postalCode only.
  await assert.rejects(
    () => provider.getOptions(caAddressMinimal, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines),
    /full shipping address/,
  );
});

test("a cart where every line has weight AND the address has full fields reaches the credential-missing failure using the default fetcher", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(
    () => provider.getOptions(caAddressFull, 1000, weighedLines),
    /not available yet|aren't available/,
  );
});

test("a delivery quote that cannot be resolved throws -- it must never silently become a pickup-only or free result", async () => {
  const provider = new ChitChatsShippingProvider();
  await assert.rejects(() => provider.getOptions(caAddressFull, 1000, weighedLines), ShippingRateUnavailableError);
});

test("getOptions() threads the real computed parcel weight through to the rate fetcher for a multi-item, multi-quantity cart", async () => {
  let receivedWeight: number | null = null;
  const fakeFetcher: ChitChatsRateFetcher = async (_addr, _subtotal, pkg: ChitChatsPackageInput) => {
    receivedWeight = pkg.weightLb;
    return [{ id: "live", label: "Chit Chats", cents: 1850 }];
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
  const fakeFetcher: ChitChatsRateFetcher = async (_addr, _subtotal, pkg: ChitChatsPackageInput) => {
    receivedDimensions = pkg.dimensionsIn;
    return [{ id: "live", label: "Chit Chats", cents: 1850 }];
  };
  const provider = new ChitChatsShippingProvider(fakeFetcher);
  await provider.getOptions(caAddressFull, 1000, weighedLines);
  assert.equal(receivedDimensions, null);
});

test("a simulated Chit Chats API failure propagates as a clear, catchable error rather than crashing or defaulting to a flat rate", async () => {
  const flakyFetcher: ChitChatsRateFetcher = async () => {
    throw new Error("ECONNRESET: Chit Chats API unreachable");
  };
  const provider = new ChitChatsShippingProvider(flakyFetcher);
  await assert.rejects(() => provider.getOptions(caAddressFull, 1000, weighedLines), /ECONNRESET/);
});

test("Ottawa pickup is never returned by this provider -- it must be offered by the caller independently, regardless of order value", async () => {
  const provider = new ChitChatsShippingProvider(okFetcher);
  const freeOptions: ShippingOption[] = await provider.getOptions(caAddressFull, FREE_SHIPPING_THRESHOLD_CENTS + 1, weighedLines);
  assert.ok(!freeOptions.some((o) => o.id === "ottawa-pickup"));
  const smallOrderOptions: ShippingOption[] = await provider.getOptions(caAddressFull, 500, weighedLines);
  assert.ok(!smallOrderOptions.some((o) => o.id === "ottawa-pickup"));
});
