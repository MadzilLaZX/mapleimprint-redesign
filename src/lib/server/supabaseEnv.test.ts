import { test } from "node:test";
import assert from "node:assert/strict";
import { requireEnv } from "./supabaseEnv.ts";

test("requireEnv: returns the value when the env var is set", () => {
  process.env.TEST_REQUIRE_ENV_VAR = "a-value";
  try {
    assert.equal(requireEnv("TEST_REQUIRE_ENV_VAR"), "a-value");
  } finally {
    delete process.env.TEST_REQUIRE_ENV_VAR;
  }
});

test("requireEnv: FAIL-CLOSED -- throws a clear error naming the missing var, never returns undefined", () => {
  delete process.env.TEST_REQUIRE_ENV_VAR_MISSING;
  assert.throws(() => requireEnv("TEST_REQUIRE_ENV_VAR_MISSING"), /TEST_REQUIRE_ENV_VAR_MISSING is not set/);
});

test("requireEnv: throws for an empty-string value too, not just a genuinely-unset var", () => {
  process.env.TEST_REQUIRE_ENV_VAR_EMPTY = "";
  try {
    assert.throws(() => requireEnv("TEST_REQUIRE_ENV_VAR_EMPTY"));
  } finally {
    delete process.env.TEST_REQUIRE_ENV_VAR_EMPTY;
  }
});
