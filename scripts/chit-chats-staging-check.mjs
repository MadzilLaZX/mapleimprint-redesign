#!/usr/bin/env node
// Manual, human-run verification script -- NOT wired into the app, NOT run by `npm test`, NOT
// run by any build/CI step, and NOT executed by Claude in this session. This makes REAL Chit
// Chats API calls the moment it's actually run with real credentials -- it must only be invoked
// deliberately, by a person, once real credentials AND an explicitly approved test destination
// are configured. Refuses to run at all if any of those are missing -- never substitutes a
// placeholder or an address this script invented on its own.
//
// Usage once credentials and an approved test destination exist:
//   node --env-file=.env.local scripts/chit-chats-staging-check.mjs
//
// Covers exactly the "first objective" sequence from docs/chit-chats-staging-validation.md:
// authenticate, create an unpurchased draft shipment, print the real rates returned, look the
// shipment up again by its order_id, then delete it.
//
// NEVER PURCHASES POSTAGE: there is no call to PATCH /shipments/{id}/buy anywhere in this file,
// deliberately -- the only shipment-mutating calls below are POST /shipments (with
// postage_type: "unknown", which creates a record without buying postage) and
// DELETE /shipments/{id}. Confirmed safe per the docs: deletion is only blocked once postage is
// purchased or the shipment is received -- neither happens here.
//
// Deliberately duplicates (rather than imports) the tiny amount of URL/header logic also in
// src/lib/server/chitChatsClient.ts -- that file no longer has `import "server-only"` (removed
// once chitChatsShippingProvider.ts started using it for real; see that file's header), but this
// script still stays standalone/zero-dependency on purpose, since it's meant to be run directly
// with no build step. Keep the two in sync if either changes.
//
// weight/size_x/size_y/size_z are sent as real JSON numbers below, not strings -- confirmed
// against the live OpenAPI spec embedded in https://chitchats.com/docs/api/v1 (2026-11-15): both
// fields are typed `number`, and size_x/size_y/size_z are in the schema's own top-level `required`
// array (not merely documented as recommended, as an earlier round of this codebase assumed).

const token = process.env.CHIT_CHATS_API_ACCESS_TOKEN;
const clientId = process.env.CHIT_CHATS_CLIENT_ID;
const environment = process.env.CHIT_CHATS_ENVIRONMENT === "production" ? "production" : "staging";

if (!token || !clientId) {
  console.error(
    "CHIT_CHATS_API_ACCESS_TOKEN and/or CHIT_CHATS_CLIENT_ID are not set -- refusing to run " +
      "rather than invent placeholder credentials. Set both in .env.local (see .env.example) " +
      "and run with: node --env-file=.env.local scripts/chit-chats-staging-check.mjs",
  );
  process.exit(1);
}

if (environment === "production") {
  console.error(
    "CHIT_CHATS_ENVIRONMENT is 'production' -- this script is for staging verification only. " +
      "Refusing to run against the production API. Set CHIT_CHATS_ENVIRONMENT=staging to proceed.",
  );
  process.exit(1);
}

// Approved test destination -- no hardcoded default. An earlier version of this script used an
// address I (Claude) invented without business sign-off; this version requires the person running
// it to explicitly provide one via env vars instead, so "approved" is a real property of the
// configuration, not an assumption baked into the script.
const destination = {
  name: process.env.CHIT_CHATS_TEST_RECIPIENT_NAME,
  address_1: process.env.CHIT_CHATS_TEST_ADDRESS_1,
  city: process.env.CHIT_CHATS_TEST_CITY,
  province_code: process.env.CHIT_CHATS_TEST_PROVINCE,
  postal_code: process.env.CHIT_CHATS_TEST_POSTAL_CODE,
  country_code: process.env.CHIT_CHATS_TEST_COUNTRY || "CA",
};
const missingDestinationFields = ["name", "address_1", "city", "province_code", "postal_code"].filter((k) => !destination[k]);
if (missingDestinationFields.length > 0) {
  console.error(
    `No approved test destination configured -- missing: ${missingDestinationFields.join(", ")}.\n` +
      "Set CHIT_CHATS_TEST_RECIPIENT_NAME, CHIT_CHATS_TEST_ADDRESS_1, CHIT_CHATS_TEST_CITY, " +
      "CHIT_CHATS_TEST_PROVINCE, CHIT_CHATS_TEST_POSTAL_CODE (and optionally CHIT_CHATS_TEST_COUNTRY, " +
      "default CA) to an address you've approved for this test before running this script. This is " +
      "a real shipment-creation API call once it runs -- it must use an address you chose, not one " +
      "this script invents.",
  );
  process.exit(1);
}

// Shipping ORIGIN is Chit Chats account-level configuration (Settings > Returns in their
// dashboard), not a field this request can set -- there is nothing for this script to configure
// or approve here. Whatever origin address is on file for the account is what's used; confirm
// that's the intended one directly in the Chit Chats dashboard before running this script for the
// first time, since no code anywhere in this repo can see or override it.
console.log(
  "NOTE: shipping origin is whatever is configured in the Chit Chats account's own Settings > " +
    "Returns page -- confirm that's correct there before proceeding; this script cannot see or set it.",
);

const baseUrl = `https://staging.chitchats.com/api/v1/clients/${clientId}`;
const headers = { Authorization: token, "Content-Type": "application/json" };
const testOrderId = `staging-check-${Date.now()}`;

/** Never prints the real token. Client ID isn't the secret itself, but is still partially masked
 *  here as defense-in-depth -- nothing in this script's console output should let a copy-pasted
 *  terminal transcript leak account-identifying values in full. */
function redact(value) {
  if (!value || value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function step(label, fn) {
  process.stdout.write(`\n--- ${label} ---\n`);
  const result = await fn();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log(`Chit Chats staging check -- environment: ${environment}, client: ${redact(clientId)}`);
  console.log(`Test order_id marker: ${testOrderId}`);
  console.log(`Approved test destination: ${destination.name}, ${destination.city}, ${destination.province_code}`);

  await step("1. Authenticate (GET /shipments?limit=1)", async () => {
    const res = await fetch(`${baseUrl}/shipments?limit=1`, { headers });
    if (!res.ok) throw new Error(`Auth check failed: ${res.status} ${await res.text()}`);
    return { status: res.status, ok: true };
  });

  let shipmentId;
  try {
    const created = await step("2. Create unpurchased draft shipment (POST /shipments)", async () => {
      const res = await fetch(`${baseUrl}/shipments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...destination,
          value: "10.00",
          value_currency: "cad",
          package_type: "parcel",
          weight_unit: "lb",
          weight: 1.0, // number, not a string -- confirmed by the live OpenAPI spec's `weight` type
          size_unit: "in",
          size_x: 10, // number, not a string -- same confirmation for size_x/size_y/size_z
          size_y: 10,
          size_z: 10,
          description: "Staging validation test parcel -- safe to delete",
          postage_type: "unknown", // never purchases postage -- see this file's header
          order_id: testOrderId,
        }),
      });
      if (!res.ok) throw new Error(`Shipment creation failed: ${res.status} ${await res.text()}`);
      return res.json();
    });
    shipmentId = created.id;

    console.log(
      `\nStatus: ${created.status} (expect "pending"). Postage label URLs: ` +
        `${created.postage_label_png_url ?? "null"} (expect null -- confirms no postage purchased).`,
    );
    console.log(`Rates returned: ${Array.isArray(created.rates) ? created.rates.length : 0}`);

    await step("3. Rates array (full detail)", async () => created.rates ?? []);

    await step(`4. Look up by order_id via q= (GET /shipments?q=${testOrderId})`, async () => {
      const res = await fetch(`${baseUrl}/shipments?q=${encodeURIComponent(testOrderId)}`, { headers });
      if (!res.ok) throw new Error(`Lookup failed: ${res.status} ${await res.text()}`);
      const body = await res.json();
      const matches = (body.shipments ?? []).filter((s) => s.order_id === testOrderId);
      console.log(`\n${matches.length} exact order_id match(es) out of ${body.shipments?.length ?? 0} result(s) for this query.`);
      return body;
    });
  } finally {
    // Always attempted if a shipment was created, even if an earlier step (e.g. the lookup) threw
    // -- and the delete attempt's own success/failure is handled separately from whatever error
    // triggered this finally block, so a cleanup failure is never silently swallowed by, or
    // allowed to mask, the original error.
    if (shipmentId) {
      try {
        const res = await fetch(`${baseUrl}/shipments/${shipmentId}`, { method: "DELETE", headers });
        if (res.status === 204) {
          console.log(`\n--- 5. Delete draft shipment ${shipmentId} ---\nDeleted successfully (204 No Content).`);
        } else {
          console.error(
            `\n!!! MANUAL CLEANUP NEEDED !!!\n` +
              `DELETE /shipments/${shipmentId} returned ${res.status} (expected 204): ${await res.text()}\n` +
              `Shipment ID ${shipmentId} (order_id: ${testOrderId}) was NOT confirmed deleted -- ` +
              `delete it manually in the Chit Chats dashboard or retry: ` +
              `curl -X DELETE -H "Authorization: $CHIT_CHATS_API_ACCESS_TOKEN" ${baseUrl}/shipments/${shipmentId}`,
          );
        }
      } catch (err) {
        console.error(
          `\n!!! MANUAL CLEANUP NEEDED !!!\n` +
            `DELETE /shipments/${shipmentId} failed with a network/unexpected error: ${err.message}\n` +
            `Shipment ID ${shipmentId} (order_id: ${testOrderId}) was NOT confirmed deleted -- delete it manually.`,
        );
      }
    }
  }

  console.log("\nDone. Review each step's output against docs/chit-chats-staging-validation.md's expectations.");
}

main().catch((err) => {
  console.error("\nStaging check failed:", err.message);
  process.exit(1);
});
