import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQuoteReference } from "./generateQuoteReference.ts";

// A minimal fake Supabase client covering the one call shape this function uses: an existence
// probe (select(...).eq(...).maybeSingle()). No shared Supabase-mocking helper exists in this
// codebase yet (see freeze.test.ts's identical note) -- built inline per test file.

function fakeSupabase(opts: { existingReferences?: Set<string> }) {
  const existing = opts.existingReferences ?? new Set<string>();
  return {
    from(table: string) {
      if (table !== "QuoteRequest") throw new Error(`fakeSupabase: unexpected table "${table}"`);
      return {
        select(_cols: string) {
          return {
            eq: (_col: string, value: string) => ({
              maybeSingle: async () => ({ data: existing.has(value) ? { id: "existing" } : null }),
            }),
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function todayPrefix(): string {
  const now = new Date();
  return `MI-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-`;
}

test("always starts with today's MI-YYYYMMDD- date prefix", async () => {
  const client = fakeSupabase({});
  const ref = await generateQuoteReference(client);
  assert.match(ref, new RegExp(`^${todayPrefix()}`));
});

// SECURITY REGRESSION (2026-11-18): the suffix used to be a count-based sequence (0001, 0002, ...)
// which src/app/(site)/quote/[reference]/status/page.tsx's access-control model depends on NOT
// being guessable -- this locks in the random, non-sequential replacement.
test("the suffix is a 6-character random base32 token, not a sequential counter", async () => {
  const client = fakeSupabase({});
  const AMBIGUOUS = /[01OI]/;
  for (let i = 0; i < 50; i++) {
    const ref = await generateQuoteReference(client);
    const suffix = ref.slice(todayPrefix().length);
    assert.equal(suffix.length, 6, `expected a 6-character suffix, got "${suffix}"`);
    assert.doesNotMatch(suffix, AMBIGUOUS, `suffix "${suffix}" contains an ambiguous character`);
    assert.match(suffix, /^[A-Z2-9]+$/, `suffix "${suffix}" contains an unexpected character`);
    assert.doesNotMatch(suffix, /^\d{4}$/, "suffix must not look like the old 4-digit sequential counter");
  }
});

test("repeated calls produce distinct references -- not practically guessable/sequential", async () => {
  const client = fakeSupabase({});
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) seen.add(await generateQuoteReference(client));
  assert.equal(seen.size, 100, "expected 100 distinct references from 100 calls");
});

test("when the first candidate already exists, retries with a new random suffix until a free one is found", async () => {
  const prefix = todayPrefix();
  // Simulate the first two random candidates colliding by pre-seeding the fake DB with every
  // reference actually produced, one at a time, via a client that always reports "taken" until
  // explicitly allowed through.
  const allowedAfter = 2;
  let calls = 0;
  const client = {
    from(table: string) {
      if (table !== "QuoteRequest") throw new Error(`unexpected table "${table}"`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls++;
              return { data: calls <= allowedAfter ? { id: "existing" } : null };
            },
          }),
        }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ref = await generateQuoteReference(client);
  assert.match(ref, new RegExp(`^${prefix}[A-Z2-9]{6}$`));
  assert.ok(calls > allowedAfter, "expected at least one retry before succeeding");
});

test("falls back to a random suffix if 5 attempts all collide, rather than looping forever", async () => {
  const prefix = todayPrefix();
  const client = {
    from(table: string) {
      if (table !== "QuoteRequest") throw new Error(`unexpected table "${table}"`);
      return {
        select: () => ({
          eq: () => ({
            // Every attempt reports "taken" -- forces the function through all 5 loop iterations
            // and into the final fallback return.
            maybeSingle: async () => ({ data: { id: "existing" } }),
          }),
        }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ref = await generateQuoteReference(client);
  assert.match(ref, new RegExp(`^${prefix}[A-Z2-9]{6}$`));
});
