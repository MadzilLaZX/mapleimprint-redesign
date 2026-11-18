import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I -- same alphabet as generateOrderReference.ts

/** MI-YYYYMMDD-XXXXXX reference generator, backed by the real QuoteRequest table.
 *
 *  SECURITY FIX (2026-11-18): this previously produced a sequential MI-YYYYMMDD-#### counter
 *  (0001, 0002, ...), while `src/app/(site)/quote/[reference]/status/page.tsx` reads a quote by
 *  this reference ALONE via the service-role client, with no other access check -- the reference
 *  IS that page's access control, same model as `generateOrderReference.ts`'s order token. A
 *  sequential counter is trivially enumerable (anyone who sees one reference can walk the
 *  neighbouring few hundred for the same day and read other customers' names, contact info,
 *  uploaded artwork, and design previews). The date prefix stays for human/admin readability --
 *  it was never the secret part -- but the suffix is now a random base32 token like
 *  generateOrderReference.ts's, not a count-based guess. Collisions are still handled by retrying
 *  against the table's real unique constraint on `reference` (the caller retries this generator
 *  on a 23505 unique-violation -- see /api/quote), not by this function's own probe. */
export async function generateQuoteReference(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<string> {
  const now = new Date();
  const prefix = `MI-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${randomSuffix()}`;
    const { data: existing } = await supabase.from("QuoteRequest").select("id").eq("reference", candidate).maybeSingle();
    if (!existing) return candidate;
  }

  // Exhausting 5 random collisions in a row is practically impossible at any realistic volume --
  // fall back to one more random suffix rather than looping forever.
  return `${prefix}${randomSuffix()}`;
}

function randomSuffix(): string {
  const bytes = randomBytes(6);
  let token = "";
  for (const b of bytes) token += BASE32_ALPHABET[b % BASE32_ALPHABET.length];
  return token;
}
