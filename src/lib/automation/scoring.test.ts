import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreInquiry } from "./scoring.ts";
import type { NormalizedInquiry } from "./types.ts";

// Pure function, no dependencies -- the one piece of logic deciding which leads get prioritized
// in the admin workflow, and the one with the most free-text-parsing edge cases in this codebase
// (quantity/budget heuristics, rush-deadline date math). No test existed before now.

function baseInquiry(overrides: Partial<NormalizedInquiry> = {}): NormalizedInquiry {
  return { source: "quote", name: "Jamie Customer", email: "jamie@example.com", ...overrides };
}

test("base scores by source: contact=10, appointment=30, quote=40", () => {
  assert.equal(scoreInquiry(baseInquiry({ source: "contact" })).score, 10);
  assert.equal(scoreInquiry(baseInquiry({ source: "appointment" })).score, 30);
  assert.equal(scoreInquiry(baseInquiry({ source: "quote" })).score, 40);
});

test("tags the correct base tag per source", () => {
  assert.deepEqual(scoreInquiry(baseInquiry({ source: "contact" })).tags, ["general-inquiry"]);
  assert.deepEqual(scoreInquiry(baseInquiry({ source: "appointment" })).tags, ["appointment"]);
  assert.deepEqual(scoreInquiry(baseInquiry({ source: "quote" })).tags, ["quote"]);
});

test("a non-empty organization adds +10 and the b2b tag; whitespace-only does not count", () => {
  const withOrg = scoreInquiry(baseInquiry({ organization: "Acme Co." }));
  assert.equal(withOrg.score, 50);
  assert.ok(withOrg.tags.includes("b2b"));

  const whitespaceOrg = scoreInquiry(baseInquiry({ organization: "   " }));
  assert.equal(whitespaceOrg.score, 40);
  assert.ok(!whitespaceOrg.tags.includes("b2b"));
});

test("bulk project types (uniforms, mixed) add +10 and the bulk-order tag; other types don't", () => {
  assert.equal(scoreInquiry(baseInquiry({ projectType: "uniforms" })).score, 50);
  assert.equal(scoreInquiry(baseInquiry({ projectType: "mixed" })).score, 50);
  assert.equal(scoreInquiry(baseInquiry({ projectType: "apparel" })).score, 40);
});

test("large-quantity free text (>= 250) adds +15 and the large-order tag", () => {
  assert.equal(scoreInquiry(baseInquiry({ quantity: "500" })).score, 55);
  assert.equal(scoreInquiry(baseInquiry({ quantity: "1,000 units" })).score, 55);
  assert.ok(scoreInquiry(baseInquiry({ quantity: "500" })).tags.includes("large-order"));
  // Below the 250 threshold -- no bump.
  assert.equal(scoreInquiry(baseInquiry({ quantity: "100" })).score, 40);
  // Not parseable as a number at all -- no bump, no crash.
  assert.equal(scoreInquiry(baseInquiry({ quantity: "a few dozen" })).score, 40);
});

test("high-budget free text (>= $2500, takes the MAX number found) adds +10 and the high-budget tag", () => {
  assert.equal(scoreInquiry(baseInquiry({ budgetRange: "$2500+" })).score, 50);
  assert.equal(scoreInquiry(baseInquiry({ budgetRange: "$2,500 - $5,000" })).score, 50);
  assert.ok(scoreInquiry(baseInquiry({ budgetRange: "$3000" })).tags.includes("high-budget"));
  // Below threshold.
  assert.equal(scoreInquiry(baseInquiry({ budgetRange: "$500 - $1000" })).score, 40);
});

test("a deadline within the next 7 days (inclusive) adds +15 and the urgent tag", () => {
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const result = scoreInquiry(baseInquiry({ neededBy: inThreeDays }));
  assert.equal(result.score, 55);
  assert.ok(result.tags.includes("urgent"));
});

test("a deadline further than 7 days away does NOT add the urgent bump", () => {
  const inThreeWeeks = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const result = scoreInquiry(baseInquiry({ neededBy: inThreeWeeks }));
  assert.equal(result.score, 40);
  assert.ok(!result.tags.includes("urgent"));
});

test("a deadline already in the past does NOT add the urgent bump (not a negative-days edge case bug)", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = scoreInquiry(baseInquiry({ neededBy: yesterday }));
  assert.ok(!result.tags.includes("urgent"));
});

test("an unparseable neededBy date is ignored, never thrown", () => {
  assert.doesNotThrow(() => scoreInquiry(baseInquiry({ neededBy: "not-a-real-date" })));
  assert.ok(!scoreInquiry(baseInquiry({ neededBy: "not-a-real-date" })).tags.includes("urgent"));
});

test("designHelp adds +5 and the design-required tag", () => {
  const result = scoreInquiry(baseInquiry({ designHelp: true }));
  assert.equal(result.score, 45);
  assert.ok(result.tags.includes("design-required"));
});

test("a recognized decoration method keyword adds its own tag (case-insensitive), only the first match", () => {
  const embroidery = scoreInquiry(baseInquiry({ decorationMethod: "Embroidery please" }));
  assert.ok(embroidery.tags.includes("embroider"));

  const screenPrint = scoreInquiry(baseInquiry({ decorationMethod: "screen print" }));
  assert.ok(screenPrint.tags.includes("screen-print"));

  const unknown = scoreInquiry(baseInquiry({ decorationMethod: "something unrecognized" }));
  assert.deepEqual(unknown.tags, ["quote"]);
});

test("uploaded files add the has-artwork tag, no score change", () => {
  const withFiles = scoreInquiry(baseInquiry({ fileNames: ["logo.png"] }));
  assert.ok(withFiles.tags.includes("has-artwork"));
  assert.equal(withFiles.score, 40);

  const withoutFiles = scoreInquiry(baseInquiry({ fileNames: [] }));
  assert.ok(!withoutFiles.tags.includes("has-artwork"));
});

test("score is capped at 100 even when every bonus stacks", () => {
  const maxed = scoreInquiry(
    baseInquiry({
      organization: "Acme Co.",
      projectType: "uniforms",
      quantity: "10000",
      budgetRange: "$50000",
      neededBy: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      designHelp: true,
    }),
  );
  // 40 + 10 + 10 + 15 + 10 + 15 + 5 = 105, capped to 100.
  assert.equal(maxed.score, 100);
});
