import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PricingSnapshot, SizeQty } from "@/lib/studio/types";

// Design rows are writable by their own browser session (Studio's RLS scopes every row to the
// caller's x-mi-session header, and the anon key ships in the client bundle — see
// supabaseClient.ts), so a stored price on its own proves nothing. /api/studio signs the price it
// computed (studio/serverPricing.ts) together with everything that price depends on, using a key
// only the server holds; priceCartItem charges a design only when that signature still matches.
// Artwork is deliberately not signed — it's the customer's to change until they approve.

export interface SignedPricingFields {
  projectId: string;
  productSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  colourName: string;
  sizeBreakdown: SizeQty[];
  totalQuantity: number;
  /** Sides created with an explicit size at project creation (banner, sign, poster, sticker and
   *  price-listed print canvases) — the size the customer paid for. Sides added later in Studio
   *  ("More locations") have fixed sizes and are priced from the signed per-location chart costs. */
  sizedSides: { sideType: string; widthIn: number; heightIn: number }[];
  pricing: Omit<PricingSnapshot, "signature">;
}

function signingKey(): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? `maple-studio-pricing-v1:${secret}` : null;
}

function canonical(f: SignedPricingFields): string {
  const p = f.pricing;
  return JSON.stringify([
    f.projectId,
    f.productSlug,
    f.categorySlug,
    f.subcategorySlug,
    f.colourName,
    f.sizeBreakdown.map((s) => [s.size, s.qty]),
    f.totalQuantity,
    [...f.sizedSides].sort((a, b) => a.sideType.localeCompare(b.sideType)).map((s) => [s.sideType, s.widthIn, s.heightIn]),
    [p.unitBasePrice, p.designFee, p.chartFirstLocationCost, p.chartAdditionalLocationCost, p.quantity, p.total, p.printRuleVersion],
  ]);
}

/** Null when the server has no signing key configured — callers must treat that as "can't price". */
export function signPricing(fields: SignedPricingFields): string | null {
  const key = signingKey();
  return key ? createHmac("sha256", key).update(canonical(fields)).digest("hex") : null;
}

export function verifyPricing(fields: SignedPricingFields, signature: string | undefined): boolean {
  const expected = signPricing(fields);
  if (!expected || typeof signature !== "string" || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
