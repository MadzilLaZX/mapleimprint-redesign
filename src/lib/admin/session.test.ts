import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPassword, createSessionCookieValue, isValidSessionCookie } from "./session.ts";

const ORIGINAL_ENV = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("verifyPassword returns false (never throws) when ADMIN_PASSWORD is unset", () => {
  delete process.env.ADMIN_PASSWORD;
  try {
    assert.equal(verifyPassword("anything"), false);
  } finally {
    restoreEnv();
  }
});

test("a real session cookie round-trips: created then validated with the same secret", () => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-fixture-only";
  try {
    const cookie = createSessionCookieValue();
    assert.equal(isValidSessionCookie(cookie), true);
  } finally {
    restoreEnv();
  }
});

test("REGRESSION: isValidSessionCookie returns false (never throws) when ADMIN_SESSION_SECRET is unset, even with a cookie-shaped value -- would otherwise crash proxy.ts's middleware with an uncaught exception instead of redirecting to login", () => {
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    // Shaped like a real cookie (passes the split/Number.isFinite checks) so execution reaches
    // the hmac() call that used to throw uncaught.
    const futureTimestamp = Date.now() + 1000 * 60 * 60;
    const cookieShapedValue = `${futureTimestamp}.deadbeef`;
    assert.doesNotThrow(() => isValidSessionCookie(cookieShapedValue));
    assert.equal(isValidSessionCookie(cookieShapedValue), false);
  } finally {
    restoreEnv();
  }
});

test("isValidSessionCookie rejects an expired cookie", () => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-fixture-only";
  try {
    const pastTimestamp = Date.now() - 1000;
    assert.equal(isValidSessionCookie(`${pastTimestamp}.deadbeef`), false);
  } finally {
    restoreEnv();
  }
});

test("isValidSessionCookie rejects a malformed or missing cookie value", () => {
  assert.equal(isValidSessionCookie(null), false);
  assert.equal(isValidSessionCookie(undefined), false);
  assert.equal(isValidSessionCookie(""), false);
  assert.equal(isValidSessionCookie("not-a-valid-shape"), false);
});

test("isValidSessionCookie rejects a cookie signed with a DIFFERENT secret", () => {
  process.env.ADMIN_SESSION_SECRET = "secret-a";
  const cookie = createSessionCookieValue();
  process.env.ADMIN_SESSION_SECRET = "secret-b";
  try {
    assert.equal(isValidSessionCookie(cookie), false);
  } finally {
    restoreEnv();
  }
});
