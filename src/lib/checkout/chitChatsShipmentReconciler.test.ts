import { test } from "node:test";
import assert from "node:assert/strict";
import { chitChatsOrderIdReconciler } from "./chitChatsShipmentReconciler.ts";
import type { ChitChatsPersistedQuoteKey } from "./chitChatsQuoteStore.ts";

// Exercises the real (non-stub) chitChatsOrderIdReconciler against a mocked global.fetch -- never
// a real network call. See chitChatsShipmentReconciler.ts's header for why this intentionally only
// ever returns "true" or "unknown", never "false".

const fingerprint = "a".repeat(64); // stand-in for a real 64-char SHA-256 hex fingerprint
const key: ChitChatsPersistedQuoteKey = {
  address: { province: "ON", country: "CA", postalCode: "K1V 8B9" },
  subtotalCents: 1000,
  pkg: { weightLb: 1, dimensionsIn: null },
};

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
  for (const [envKey, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
  }
  globalThis.fetch = ORIGINAL_FETCH;
}

test("without credentials: returns 'unknown', never attempts a network call", async () => {
  delete process.env.CHIT_CHATS_CLIENT_ID;
  delete process.env.CHIT_CHATS_API_ACCESS_TOKEN;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("must never be called");
  }) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
    assert.equal(called, false);
  } finally {
    restoreEnv();
  }
});

test("exactly one exact order_id match with usable rates: returns 'true' and adopts it, querying the real search URL", async () => {
  setFakeCredentials();
  let capturedUrl: string | undefined;
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url;
    return new Response(
      JSON.stringify({
        shipments: [
          {
            id: "ship_recovered",
            order_id: fingerprint,
            rates: [{ postage_type: "ddp", postage_description: "Chit Chats Standard", purchase_amount: "18.50" }],
          },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, {
      outcome: true,
      rates: [{ id: "chitchats-ddp", label: "Chit Chats Standard", cents: 1850 }],
      chitChatsShipmentId: "ship_recovered",
    });
    assert.equal(capturedUrl, `https://staging.chitchats.com/api/v1/clients/test-client-id/shipments?q=${fingerprint}`);
  } finally {
    restoreEnv();
  }
});

test("zero results: returns 'unknown', never 'false' -- search-miss reliability is unconfirmed", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () => new Response(JSON.stringify({ shipments: [] }), { status: 200 })) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});

test("a result with a different order_id (full-text false positive) is excluded, leaving zero exact matches -> 'unknown'", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ shipments: [{ id: "ship_other", order_id: "b".repeat(64), rates: [] }] }), { status: 200 })) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});

test("more than one exact match (should never happen for a real fingerprint): refuses to guess, returns 'unknown'", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        shipments: [
          { id: "ship_a", order_id: fingerprint, rates: [{ postage_type: "ddp", purchase_amount: "18.50" }] },
          { id: "ship_b", order_id: fingerprint, rates: [{ postage_type: "ddp", purchase_amount: "18.50" }] },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});

test("an exact match with no usable rates: cannot adopt it, returns 'unknown' rather than filling an empty rate list", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ shipments: [{ id: "ship_recovered", order_id: fingerprint, rates: [] }] }), { status: 200 })) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});

test("a non-ok HTTP response: returns 'unknown' rather than throwing or guessing", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () => new Response("", { status: 500 })) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});

test("a network failure: returns 'unknown' rather than throwing", async () => {
  setFakeCredentials();
  globalThis.fetch = (async () => {
    throw new Error("ECONNRESET");
  }) as typeof fetch;
  try {
    const result = await chitChatsOrderIdReconciler(fingerprint, key);
    assert.deepEqual(result, { outcome: "unknown" });
  } finally {
    restoreEnv();
  }
});
