#!/usr/bin/env node
// Manual, human-run verification script for the PRODUCTION Chit Chats account -- NOT wired into
// the app, NOT run by `npm test`, NOT run by any build/CI step, and NOT executed by Claude in this
// session. Mirrors scripts/chit-chats-staging-check.mjs's safety model, but for production
// specifically, because staging.chitchats.com has been confirmed unreachable for this account (a
// prior read-only probe returned 404) while production returned 200 -- so this is the only real
// account available to validate a rate request against, which makes the gating below stricter than
// the staging script's, not looser.
//
// SAFETY MODEL (strictly additive to the staging script's, never relaxed):
//   1. Refuses outright unless CHIT_CHATS_ENVIRONMENT=production is explicitly set (inverse of the
//      staging script, which refuses if it's "production" -- this one refuses if it's anything else).
//   2. The ONE real network call this script makes with NO further gating is a read-only
//      GET /shipments?limit=1 auth check -- confirms credentials resolve against production without
//      creating anything. Safe to run at any time per this task's "read-only requests are allowed"
//      rule.
//   3. Creating/inspecting/deleting a real draft shipment (steps 2-5, mirroring the staging script)
//      requires BOTH: the `--execute` CLI flag AND process.env.CHIT_CHATS_PRODUCTION_TEST_APPROVED
//      set to the exact phrase below. Without both, the script prints a DRY RUN instead -- the exact
//      JSON body it WOULD send, with nothing actually transmitted -- so a human can review the real
//      request shape before approving it.
//   4. Destination (recipient name/address/city/province/postal/country) and parcel (weight,
//      weight_unit, size_x/size_y/size_z, size_unit) are read ONLY from explicit env vars below --
//      this script never invents a business address or parcel dimension. If any are missing, the
//      script reports exactly which ones and stops (after the safe auth check), even in dry-run
//      mode -- there is no sample/placeholder fallback.
//   5. NEVER PURCHASES POSTAGE: there is no call to PATCH /shipments/{id}/buy anywhere in this
//      file -- the only shipment-mutating calls below (reachable only via --execute + the approval
//      phrase) are POST /shipments (with postage_type: "unknown", which creates a record without
//      buying postage) and DELETE /shipments/{id}. Confirmed against the live OpenAPI spec
//      (chitchats.com/docs/api/v1, 2026-11-15): deletion is blocked only once postage is purchased or
//      the shipment has been received -- neither happens here.
//   6. NEVER touches this app's own checkout flow, Square payments, or tax/shipping activation --
//      this script talks directly to Chit Chats' API and nothing else in this codebase.
//
// Usage:
//   Dry run (safe, shows the exact request without sending it -- also the auth check always runs):
//     node --env-file=.env.local scripts/chit-chats-production-rate-check.mjs
//   Real run (creates one real draft shipment, inspects it, deletes it -- requires explicit approval):
//     CHIT_CHATS_PRODUCTION_TEST_APPROVED="I-APPROVE-ONE-REAL-PRODUCTION-DRAFT-SHIPMENT" \
//       node --env-file=.env.local scripts/chit-chats-production-rate-check.mjs --execute
//
// Deliberately duplicates (rather than imports) the tiny amount of URL/header logic also in
// src/lib/server/chitChatsClient.ts, matching scripts/chit-chats-staging-check.mjs's own note --
// this script stays standalone with no build step. Keep all three in sync if any changes.

const APPROVAL_PHRASE = "I-APPROVE-ONE-REAL-PRODUCTION-DRAFT-SHIPMENT";

const token = process.env.CHIT_CHATS_API_ACCESS_TOKEN;
const clientId = process.env.CHIT_CHATS_CLIENT_ID;
const environment = process.env.CHIT_CHATS_ENVIRONMENT;

if (environment !== "production") {
  console.error(
    "CHIT_CHATS_ENVIRONMENT is not 'production' -- this script is for the production account only " +
      "(staging.chitchats.com has been confirmed unreachable for this account; see this file's header). " +
      "Set CHIT_CHATS_ENVIRONMENT=production in .env.local to proceed. Refusing to run against anything else.",
  );
  process.exit(1);
}

if (!token || !clientId) {
  console.error(
    "CHIT_CHATS_API_ACCESS_TOKEN and/or CHIT_CHATS_CLIENT_ID are not set -- refusing to run " +
      "rather than invent placeholder credentials. Set both in .env.local (see .env.example) " +
      "and run with: node --env-file=.env.local scripts/chit-chats-production-rate-check.mjs",
  );
  process.exit(1);
}

const executeRequested = process.argv.includes("--execute");
const approved = process.env.CHIT_CHATS_PRODUCTION_TEST_APPROVED === APPROVAL_PHRASE;
const willExecute = executeRequested && approved;
if (executeRequested && !approved) {
  console.error(
    `--execute was passed but CHIT_CHATS_PRODUCTION_TEST_APPROVED does not exactly match the required ` +
      `approval phrase. Falling back to a DRY RUN. To actually create one real draft shipment, set:\n` +
      `  CHIT_CHATS_PRODUCTION_TEST_APPROVED="${APPROVAL_PHRASE}"\n` +
      `This is a real shipment-creation call against your PRODUCTION account once approved.`,
  );
}

const baseUrl = `https://chitchats.com/api/v1/clients/${clientId}`;
const headers = { Authorization: token, "Content-Type": "application/json" };

/** Never prints the real token. Client ID isn't the secret itself, but is still partially masked
 *  here as defense-in-depth, matching scripts/chit-chats-staging-check.mjs. */
function redact(value) {
  if (!value || value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// Destination -- no hardcoded default. Required to proceed past the dry-run preview; this script
// never invents a business address, matching scripts/chit-chats-staging-check.mjs's own policy.
const destination = {
  name: process.env.CHIT_CHATS_TEST_RECIPIENT_NAME,
  address_1: process.env.CHIT_CHATS_TEST_ADDRESS_1,
  city: process.env.CHIT_CHATS_TEST_CITY,
  province_code: process.env.CHIT_CHATS_TEST_PROVINCE,
  postal_code: process.env.CHIT_CHATS_TEST_POSTAL_CODE,
  country_code: process.env.CHIT_CHATS_TEST_COUNTRY || "CA",
};

// Parcel -- weight and dimensions are REAL, product-specific facts (confirmed required by the live
// OpenAPI spec: size_x/size_y/size_z are in its top-level `required` array, not merely
// recommended -- see src/lib/checkout/chitChatsShippingProvider.ts's header for the same finding).
// No default weight/size is invented here, unlike the staging script's hardcoded 1 lb / 10x10x10in
// placeholder -- this script requires a real, approved parcel from whoever runs it. Only the UNITS
// (lb/in/cad) default, since those are measurement units, not business facts.
const parcel = {
  weight_unit: process.env.CHIT_CHATS_TEST_WEIGHT_UNIT || "lb",
  weight: process.env.CHIT_CHATS_TEST_WEIGHT_LB,
  size_unit: process.env.CHIT_CHATS_TEST_SIZE_UNIT || "in",
  size_x: process.env.CHIT_CHATS_TEST_SIZE_X,
  size_y: process.env.CHIT_CHATS_TEST_SIZE_Y,
  size_z: process.env.CHIT_CHATS_TEST_SIZE_Z,
};
const value = process.env.CHIT_CHATS_TEST_VALUE_CAD;
const description = process.env.CHIT_CHATS_TEST_DESCRIPTION;

function findMissingFields() {
  const missing = [];
  for (const [key, label] of [
    ["name", "CHIT_CHATS_TEST_RECIPIENT_NAME"],
    ["address_1", "CHIT_CHATS_TEST_ADDRESS_1"],
    ["city", "CHIT_CHATS_TEST_CITY"],
    ["province_code", "CHIT_CHATS_TEST_PROVINCE"],
    ["postal_code", "CHIT_CHATS_TEST_POSTAL_CODE"],
  ]) {
    if (!destination[key]) missing.push(label);
  }
  if (!parcel.weight) missing.push("CHIT_CHATS_TEST_WEIGHT_LB (a real parcel weight -- never invented)");
  if (!parcel.size_x) missing.push("CHIT_CHATS_TEST_SIZE_X (length, in inches -- never invented)");
  if (!parcel.size_y) missing.push("CHIT_CHATS_TEST_SIZE_Y (width, in inches -- never invented)");
  if (!parcel.size_z) missing.push("CHIT_CHATS_TEST_SIZE_Z (height, in inches -- never invented)");
  if (!value) missing.push("CHIT_CHATS_TEST_VALUE_CAD (declared customs/insurance value in CAD)");
  if (!description) missing.push("CHIT_CHATS_TEST_DESCRIPTION (what the parcel actually contains)");
  return missing;
}

async function step(label, fn) {
  process.stdout.write(`\n--- ${label} ---\n`);
  const result = await fn();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log(`Chit Chats PRODUCTION rate check -- environment: ${environment}, client: ${redact(clientId)}`);
  console.log(`Mode: ${willExecute ? "EXECUTE (will create one real draft shipment)" : "DRY RUN (no shipment will be created)"}`);
  console.log(
    "NOTE: shipping origin is whatever is configured in the Chit Chats account's own Settings > " +
      "Returns page -- confirm that's correct there before proceeding; this script cannot see or set it.",
  );

  // Always safe, always allowed, runs regardless of dry-run/execute or whether destination/parcel
  // fields are configured yet -- a read-only GET, never a mutation.
  await step("1. Authenticate (GET /shipments?limit=1, read-only)", async () => {
    const res = await fetch(`${baseUrl}/shipments?limit=1`, { headers });
    if (!res.ok) throw new Error(`Auth check failed: ${res.status} ${await res.text()}`);
    return { status: res.status, ok: true };
  });

  const missing = findMissingFields();
  if (missing.length > 0) {
    console.log(
      `\nAuth check passed. Cannot go further yet -- the following real, business-specific values ` +
        `are not configured (set in .env.local; none of these are invented by this script):\n` +
        missing.map((m) => `  - ${m}`).join("\n"),
    );
    return;
  }

  const testOrderId = `production-rate-check-${Date.now()}`;
  const requestBody = {
    ...destination,
    value,
    value_currency: "cad",
    package_type: "parcel",
    weight_unit: parcel.weight_unit,
    weight: Number(parcel.weight),
    size_unit: parcel.size_unit,
    size_x: Number(parcel.size_x),
    size_y: Number(parcel.size_y),
    size_z: Number(parcel.size_z),
    description,
    postage_type: "unknown", // never purchases postage -- see this file's header
    order_id: testOrderId,
  };

  console.log(`\nApproved test destination: ${destination.name}, ${destination.city}, ${destination.province_code}`);
  console.log(`Test order_id marker: ${testOrderId}`);

  if (!willExecute) {
    console.log(
      "\n--- DRY RUN: exact POST /shipments request body that WOULD be sent (nothing transmitted) ---",
    );
    console.log(JSON.stringify(requestBody, null, 2));
    console.log(
      `\nTo actually send this and create one real, deletable draft shipment, re-run with --execute ` +
        `and CHIT_CHATS_PRODUCTION_TEST_APPROVED="${APPROVAL_PHRASE}" set.`,
    );
    return;
  }

  let shipmentId;
  try {
    const created = await step("2. Create unpurchased draft shipment (POST /shipments)", async () => {
      const res = await fetch(`${baseUrl}/shipments`, { method: "POST", headers, body: JSON.stringify(requestBody) });
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

  console.log("\nDone. This created and deleted exactly one real production draft shipment -- no postage was purchased.");
}

main().catch((err) => {
  console.error("\nProduction rate check failed:", err.message);
  process.exit(1);
});
