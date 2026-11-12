#!/usr/bin/env node
// Manual, human-run verification script -- NOT wired into the app, NOT run by `npm test`, NOT
// run by any build/CI step, and NOT executed by Claude in this session. This makes REAL Chit
// Chats API calls the moment it's actually run with real credentials -- it must only be invoked
// deliberately, by a person, once CHIT_CHATS_API_ACCESS_TOKEN and CHIT_CHATS_CLIENT_ID hold real
// values. Refuses to run at all if either is missing or empty -- never substitutes a placeholder.
//
// Usage once credentials exist:
//   node --env-file=.env.local scripts/chit-chats-staging-check.mjs
//
// Covers exactly the "first objective" sequence from docs/chit-chats-staging-validation.md:
// authenticate, create an unpurchased draft shipment, print the real rates returned, look the
// shipment up again by its order_id, then delete it (confirmed safe per the docs: deletion is
// only blocked once postage is purchased or the shipment is received -- neither happens here,
// since postage_type "unknown" never purchases anything and this script never calls
// PATCH /shipments/{id}/buy).
//
// Deliberately duplicates (rather than imports) the tiny amount of URL/header logic also in
// src/lib/server/chitChatsClient.ts -- that file has `import "server-only"`, which throws
// unconditionally outside Next.js's bundler (confirmed: every other file in src/lib/server/ has
// the same issue, which is why none of them have a plain-Node test either). Keep the two in sync
// if either changes.

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

const baseUrl = `https://staging.chitchats.com/api/v1/clients/${clientId}`;
const headers = { Authorization: token, "Content-Type": "application/json" };
const testOrderId = `staging-check-${Date.now()}`;

async function step(label, fn) {
  process.stdout.write(`\n--- ${label} ---\n`);
  const result = await fn();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log(`Chit Chats staging check -- environment: ${environment}, client: ${clientId}`);
  console.log(`Test order_id marker: ${testOrderId}`);

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
          name: "Staging Check Recipient",
          address_1: "123 Test St",
          city: "Toronto",
          province_code: "ON",
          postal_code: "M5V 2T6",
          country_code: "CA",
          value: "10.00",
          value_currency: "cad",
          package_type: "parcel",
          weight_unit: "lb",
          weight: "1.0",
          size_unit: "in",
          size_x: "10",
          size_y: "10",
          size_z: "10",
          description: "Staging validation test parcel -- safe to delete",
          postage_type: "unknown",
          order_id: testOrderId,
        }),
      });
      if (!res.ok) throw new Error(`Shipment creation failed: ${res.status} ${await res.text()}`);
      const body = await res.json();
      return body;
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
      await step(`5. Delete draft shipment (DELETE /shipments/${shipmentId})`, async () => {
        const res = await fetch(`${baseUrl}/shipments/${shipmentId}`, { method: "DELETE", headers });
        return { status: res.status, expectedNoContent: res.status === 204 };
      });
    }
  }

  console.log("\nDone. Review each step's output against docs/chit-chats-staging-validation.md's expectations.");
}

main().catch((err) => {
  console.error("\nStaging check failed:", err.message);
  process.exit(1);
});
