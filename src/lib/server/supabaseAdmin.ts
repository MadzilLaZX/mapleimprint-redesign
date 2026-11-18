import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, SUPABASE_URL_ENV_VAR, SUPABASE_SERVICE_ROLE_KEY_ENV_VAR } from "./supabaseEnv";

// Opposite trust model from src/lib/studio/supabaseClient.ts's anon-key client: that one is safe
// to ship client-side because access control is enforced entirely by Studio's session-cookie RLS
// policies. This one uses the SERVICE ROLE key, which bypasses RLS entirely — it is a real secret
// and must never reach a client bundle (the "server-only" import above makes any accidental
// client-side import a build-time error, not just a runtime leak). Used exclusively by the
// checkout/order/payment routes, which read/write MapleOrder/MapleOrderLine/PaymentAttempt/
// ProcessedWebhookEvent — tables with deny-all RLS (see supabase/migrations/002_maple_orders.sql)
// precisely because a guessable Studio-style session cookie must never reach payment data.
//
// The URL is read from the SAME public (non-secret) env var as the anon-key client above —
// there's one Supabase project per environment, and which project that is isn't itself a secret,
// only the service-role key is. No hardcoded fallback: see docs/environment-configuration.md.

/** Build one per request — mirrors createStudioClient's own "don't share a client across
 *  sessions" guidance, even though there's no per-request header here to isolate. */
export function createAdminClient() {
  const url = requireEnv(SUPABASE_URL_ENV_VAR);
  const key = requireEnv(SUPABASE_SERVICE_ROLE_KEY_ENV_VAR);
  return createClient(url, key, { auth: { persistSession: false } });
}
