import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRobotsRules } from "./robots.ts";

test("resolveRobotsRules('production') allows crawling, with the existing cart/account/api exclusions", () => {
  const rules = resolveRobotsRules("production");
  assert.deepEqual(rules, {
    userAgent: "*",
    allow: "/",
    disallow: ["/cart", "/account", "/account/*", "/api/*"],
  });
});

test("resolveRobotsRules('preview') disallows everything -- a Preview deployment must never invite indexing", () => {
  const rules = resolveRobotsRules("preview");
  assert.deepEqual(rules, { userAgent: "*", disallow: "/" });
});

test("resolveRobotsRules(undefined) (local dev / npm test, no VERCEL_ENV set) disallows everything, matching the safe default", () => {
  const rules = resolveRobotsRules(undefined);
  assert.deepEqual(rules, { userAgent: "*", disallow: "/" });
});
