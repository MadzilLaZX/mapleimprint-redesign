import { test } from "node:test";
import assert from "node:assert/strict";
import { createStudioClient, DESIGN_UPLOADS_BUCKET } from "./supabaseClient.ts";

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

test("DESIGN_UPLOADS_BUCKET is readable with no Supabase env vars set -- importing this module for an unrelated export must never require credentials", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }, () => {
    assert.equal(DESIGN_UPLOADS_BUCKET, "design-uploads");
  });
});

test("createStudioClient: FAIL-CLOSED -- throws when NEXT_PUBLIC_SUPABASE_URL is missing, never silently connects anywhere", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "some-anon-key" }, () => {
    assert.throws(() => createStudioClient("session-token"), /NEXT_PUBLIC_SUPABASE_URL is not set/);
  });
});

test("createStudioClient: FAIL-CLOSED -- throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }, () => {
    assert.throws(() => createStudioClient("session-token"), /NEXT_PUBLIC_SUPABASE_ANON_KEY is not set/);
  });
});

test("createStudioClient: succeeds once both env vars are set, using whatever is currently configured (ENVIRONMENT ISOLATION -- no hardcoded project)", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key" }, () => {
    const client = createStudioClient("a-session-token");
    assert.ok(client);
    assert.equal(typeof client.storage.from, "function");
    assert.equal(typeof client.from, "function");
  });
});
