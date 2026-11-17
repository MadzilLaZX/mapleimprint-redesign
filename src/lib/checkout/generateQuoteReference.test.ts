import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQuoteReference } from "./generateQuoteReference.ts";

// A minimal fake Supabase client covering exactly the two call shapes this function uses:
// a count query (select(..., { count, head: true }).like(...)) and an existence probe
// (select(...).eq(...).maybeSingle()). No shared Supabase-mocking helper exists in this codebase
// yet (see freeze.test.ts's identical note) -- built inline per test file.

function fakeSupabase(opts: { count: number; existingReferences?: Set<string> }) {
  const existing = opts.existingReferences ?? new Set<string>();
  return {
    from(table: string) {
      if (table !== "QuoteRequest") throw new Error(`fakeSupabase: unexpected table "${table}"`);
      return {
        select(_cols: string, selectOpts?: { count?: string; head?: boolean }) {
          if (selectOpts?.count) {
            // The count-query branch: .select("id", { count: "exact", head: true }).like(...)
            return { like: async () => ({ count: opts.count }) };
          }
          // The existence-probe branch: .select("id").eq(...).maybeSingle()
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

test("produces today's date prefix with the count-based sequence, zero-padded to 4 digits", async () => {
  const client = fakeSupabase({ count: 5 });
  const ref = await generateQuoteReference(client);
  assert.equal(ref, `${todayPrefix()}0006`);
});

test("a count of zero (no quotes today yet) produces sequence 0001", async () => {
  const client = fakeSupabase({ count: 0 });
  const ref = await generateQuoteReference(client);
  assert.equal(ref, `${todayPrefix()}0001`);
});

test("when the first candidate already exists, retries with an incremented sequence until a free one is found", async () => {
  const prefix = todayPrefix();
  const client = fakeSupabase({ count: 0, existingReferences: new Set([`${prefix}0001`, `${prefix}0002`]) });
  const ref = await generateQuoteReference(client);
  assert.equal(ref, `${prefix}0003`);
});

test("falls back to a random suffix if 5 sequential candidates are all taken, rather than looping forever", async () => {
  const prefix = todayPrefix();
  const allTaken = new Set([`${prefix}0001`, `${prefix}0002`, `${prefix}0003`, `${prefix}0004`, `${prefix}0005`]);
  const client = fakeSupabase({ count: 0, existingReferences: allTaken });
  const ref = await generateQuoteReference(client);
  assert.match(ref, new RegExp(`^${prefix}\\d{4}$`));
  assert.ok(!allTaken.has(ref), "the fallback reference must not be one of the exhausted candidates' exact values");
});
