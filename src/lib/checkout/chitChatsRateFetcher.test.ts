import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchChitChatsRates, type ChitChatsPackageInput } from "./chitChatsShippingProvider.ts";
import { buildQuoteFingerprint } from "./chitChatsQuoteStore.ts";
import type { ShippingAddressInput } from "./shippingProvider.ts";

// Exercises the REAL (non-stub) fetchChitChatsRates against a mocked global.fetch -- never a real
// network call, consistent with "no real Chit Chats shipments" (see chitChatsShippingProvider.ts's
// header). Credentials are fake, test-only values set directly on process.env for the duration of
// each test and always restored afterward so other test files (each run in their own process by
// `node --test`, but this file's own later tests included) never see a leaked value.

const address: ShippingAddressInput = {
  province: "ON",
  country: "CA",
  postalCode: "K1V 8B9",
  name: "Jamie Customer",
  addressLine1: "123 Main St",
  city: "Ottawa",
};
const pkg: ChitChatsPackageInput = { weightLb: 1.5, dimensionsIn: null };

const ORIGINAL_ENV = {
  CHIT_CHATS_CLIENT_ID: process.env.CHIT_CHATS_CLIENT_ID,
  CHIT_CHATS_API_ACCESS_TOKEN: process.env.CHIT_CHATS_API_ACCESS_TOKEN,
  CHIT_CHATS_ENVIRONMENT: process.env.CHIT_CHATS_ENVIRONMENT,
};
const ORIGINAL_FETCH = globalThis.fetch;

function setFakeCredentials() {
  process.env.CHIT_CHATS_CLIENT_ID = "test-client-id";
  process.env.CHIT_CHATS_API_ACCESS_TOKEN = "test-access-token";
  process.env.CHIT_CHATS_ENVIRONMENT = "staging";
}

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = ORIGINAL_FETCH;
}

test("without credentials set: rejects with the honest 'not available yet' message, never attempts a network call", async () => {
  delete process.env.CHIT_CHATS_CLIENT_ID;
  delete process.env.CHIT_CHATS_API_ACCESS_TOKEN;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("must never be called -- credentials are missing");
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchChitChatsRates(address, 1000, pkg), /not available yet|aren't available/);
    assert.equal(fetchCalled, false);
  } finally {
    restoreEnv();
  }
});

test("with credentials set: POSTs to the real shipments URL with the raw token (no Bearer prefix) and maps rates[] into ShippingOption[]", async () => {
  setFakeCredentials();
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        id: "ship_123",
        rates: [
          { postage_type: "ddp", postage_description: "Chit Chats Standard", purchase_amount: "18.50" },
          { postage_type: "ddp_exp", postage_description: "Chit Chats Expedited", purchase_amount: "42.00" },
        ],
      }),
      { status: 201 },
    );
  }) as typeof fetch;

  try {
    const options = await fetchChitChatsRates(address, 1000, pkg);
    assert.deepEqual(options, [
      { id: "chitchats-ddp", label: "Chit Chats Standard", cents: 1850 },
      { id: "chitchats-ddp_exp", label: "Chit Chats Expedited", cents: 4200 },
    ]);

    assert.equal(capturedUrl, "https://staging.chitchats.com/api/v1/clients/test-client-id/shipments");
    assert.equal((capturedInit?.headers as Record<string, string>).Authorization, "test-access-token");
    assert.equal(capturedInit?.method, "POST");

    const body = JSON.parse(capturedInit?.body as string);
    assert.equal(body.name, "Jamie Customer");
    assert.equal(body.address_1, "123 Main St");
    assert.equal(body.city, "Ottawa");
    assert.equal(body.province_code, "ON");
    assert.equal(body.postal_code, "K1V 8B9");
    assert.equal(body.country_code, "CA");
    assert.equal(body.value, "10.00");
    assert.equal(body.value_currency, "cad");
    assert.equal(body.weight, "1.50");
    assert.equal(body.weight_unit, "lb");
    assert.equal(body.postage_type, "unknown");
    assert.equal(body.order_id, buildQuoteFingerprint({ address, subtotalCents: 1000, pkg }));
  } finally {
    restoreEnv();
  }
});

test("dimensions, when present, are included as size_x/size_y/size_z in inches", async () => {
  setFakeCredentials();
  let capturedBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ rates: [] }), { status: 201 });
  }) as typeof fetch;

  try {
    const withDimensions: ChitChatsPackageInput = { weightLb: 2, dimensionsIn: { length: 10, width: 8, height: 4 } };
    await fetchChitChatsRates(address, 1000, withDimensions);
    assert.equal(capturedBody?.size_unit, "in");
    assert.equal(capturedBody?.size_x, "10.00");
    assert.equal(capturedBody?.size_y, "8.00");
    assert.equal(capturedBody?.size_z, "4.00");
  } finally {
    restoreEnv();
  }
});

test("a rejected request (unsupported destination / oversized parcel) throws, never falls back to a fabricated rate", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Unsupported destination" }), { status: 422 })) as typeof fetch;
  try {
    await assert.rejects(() => fetchChitChatsRates(address, 1000, pkg), /couldn't quote this shipment/);
  } finally {
    restoreEnv();
  }
});

test("a network failure reaching Chit Chats throws a clear, catchable error rather than crashing", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () => {
    throw new Error("ECONNRESET");
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchChitChatsRates(address, 1000, pkg), /couldn't reach our shipping carrier/);
  } finally {
    restoreEnv();
  }
});

test("rate entries missing postage_type or purchase_amount are dropped rather than crashing or guessing a price", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        rates: [
          { postage_type: "ddp", purchase_amount: "18.50" },
          { postage_description: "Missing postage_type", purchase_amount: "5.00" },
          { postage_type: "no-amount" },
        ],
      }),
      { status: 201 },
    )) as typeof fetch;
  try {
    const options = await fetchChitChatsRates(address, 1000, pkg);
    assert.deepEqual(options, [{ id: "chitchats-ddp", label: "ddp", cents: 1850 }]);
  } finally {
    restoreEnv();
  }
});
