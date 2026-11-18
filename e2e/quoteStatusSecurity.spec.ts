import { test, expect } from "@playwright/test";

/** SECURITY MODEL (documented here, not just asserted): /quote/[reference]/status
 *  (src/app/(site)/quote/[reference]/status/page.tsx) uses the reference itself as a bearer
 *  token -- it looks up a QuoteRequest by `eq("reference", reference)` ALONE via the
 *  service-role client (which bypasses RLS entirely), with no secondary email/session check. The
 *  reference IS the access control. That's only safe because the reference is unguessable --
 *  generateQuoteReference.ts was fixed last session (commit de01f13) to produce a random base32
 *  suffix instead of the sequential MI-YYYYMMDD-#### counter it used before, closing a real
 *  enumeration gap. This test suite can't dynamically prove "a valid reference never shows a
 *  DIFFERENT customer's data" against two real rows -- that needs a real/test Supabase instance,
 *  which this environment doesn't have and the task forbids writing to regardless. What IS
 *  verified here, against the actual local app: the page never renders ANY quote content (name,
 *  email, artwork) for a reference that isn't a real match, and a server-side failure never leaks
 *  implementation details to the response the way local dev mode alone would suggest. */

test("an arbitrary/guessed reference never exposes any quote content (name, email, artwork)", async ({ page }) => {
  const response = await page.goto("/quote/MI-20261118-GUESSED1/status");
  expect(response?.status()).toBeGreaterThanOrEqual(200);

  const bodyText = await page.locator("body").innerText();
  // This local environment has no SUPABASE_SERVICE_ROLE_KEY configured at all (confirmed via a
  // direct curl check this round: every reference 500s locally, vs. a real "Quote not found" 200
  // once Supabase is configured -- see e2e/README.md). Either way, the one invariant that matters
  // here holds: no quote's contact info or artwork is ever present in the response for a
  // reference nobody could have been issued.
  expect(bodyText).not.toMatch(/@/); // no email address rendered
  expect(bodyText.toLowerCase()).not.toContain("design snapshot");
});

test("DEV-MODE-ONLY finding (not Production-reachable): a missing-credentials error currently includes the error message text in the dev response -- confirmed redacted in a real production build", async ({ page }) => {
  // This documents a real but narrow finding from this round's investigation, as a regression
  // guard against it getting WORSE (e.g. a real secret value ending up in that message), not as a
  // claim that it's exploitable: Next.js's production build redacts this to a generic
  // "Internal Server Error" + opaque digest (verified this round by building and starting a real
  // production server locally and diffing the response) -- this dev-mode detail only exists
  // because SUPABASE_SERVICE_ROLE_KEY is deliberately unset in this local environment, which
  // never happens in a real deployment. No customer data exists locally to leak either way.
  const response = await page.goto("/quote/MI-20261118-GUESSED2/status");
  const bodyText = await page.locator("body").innerText();
  if (response?.status() === 500) {
    expect(bodyText).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY=.+[a-zA-Z0-9]{20}/);
  }
});
