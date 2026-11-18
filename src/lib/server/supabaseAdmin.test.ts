import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminClient } from "./supabaseAdmin.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("createAdminClient: FAIL-CLOSED -- throws when NEXT_PUBLIC_SUPABASE_URL is missing, never silently connects anywhere", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: "some-service-role-key" }, () => {
    assert.throws(() => createAdminClient(), /NEXT_PUBLIC_SUPABASE_URL is not set/);
  });
});

test("createAdminClient: FAIL-CLOSED -- throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assert.throws(() => createAdminClient(), /SUPABASE_SERVICE_ROLE_KEY is not set/);
  });
});

test("createAdminClient: succeeds once both env vars are set, using whatever is currently configured (ENVIRONMENT ISOLATION -- no hardcoded project)", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key" }, () => {
    const client = createAdminClient();
    assert.ok(client);
    assert.equal(typeof client.storage.from, "function");
    assert.equal(typeof client.from, "function");
  });
});
