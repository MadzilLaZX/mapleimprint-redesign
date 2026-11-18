import { test } from "node:test";
import assert from "node:assert/strict";
import { isProductionSupabaseUrl, refuseIfProductionSupabaseUrl } from "./knownProductionSupabaseProject.ts";

test("isProductionSupabaseUrl: true for the known production project id", () => {
  assert.equal(isProductionSupabaseUrl("https://ovqkwedpwmuusnijbxro.supabase.co"), true);
});

test("isProductionSupabaseUrl: false for null/undefined/empty", () => {
  assert.equal(isProductionSupabaseUrl(null), false);
  assert.equal(isProductionSupabaseUrl(undefined), false);
  assert.equal(isProductionSupabaseUrl(""), false);
});

test("isProductionSupabaseUrl: false for a local/staging-looking URL when NEXT_PUBLIC_SUPABASE_URL isn't configured to match it", () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(isProductionSupabaseUrl("http://127.0.0.1:54321"), false);
  assert.equal(isProductionSupabaseUrl("https://some-staging-project.supabase.co"), false);
});

test("isProductionSupabaseUrl: ENVIRONMENT ISOLATION -- true when the candidate matches whatever NEXT_PUBLIC_SUPABASE_URL is currently configured as, even without the known literal -- this is what still catches a future re-created production project under a different id", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://a-future-production-project.supabase.co";
  try {
    assert.equal(isProductionSupabaseUrl("https://a-future-production-project.supabase.co"), true);
    assert.equal(isProductionSupabaseUrl("https://a-different-staging-project.supabase.co"), false);
  } finally {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
});

test("refuseIfProductionSupabaseUrl: FAIL-CLOSED -- throws for the known production URL, naming the context given", () => {
  assert.throws(
    () => refuseIfProductionSupabaseUrl("https://ovqkwedpwmuusnijbxro.supabase.co", "LOCAL_SUPABASE_URL"),
    /LOCAL_SUPABASE_URL/,
  );
});

test("refuseIfProductionSupabaseUrl: does not throw for a non-production URL", () => {
  assert.doesNotThrow(() => refuseIfProductionSupabaseUrl("http://127.0.0.1:54321", "LOCAL_SUPABASE_URL"));
});

test("refuseIfProductionSupabaseUrl: does not throw for null/undefined (nothing configured yet to check)", () => {
  assert.doesNotThrow(() => refuseIfProductionSupabaseUrl(null, "LOCAL_SUPABASE_URL"));
  assert.doesNotThrow(() => refuseIfProductionSupabaseUrl(undefined, "LOCAL_SUPABASE_URL"));
});
