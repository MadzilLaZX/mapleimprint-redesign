import "server-only";
import { createClient } from "@supabase/supabase-js";

// Opposite trust model from src/lib/studio/supabaseClient.ts's anon-key client: that one is safe
// to ship client-side because access control is enforced entirely by Studio's session-cookie RLS
// policies. This one uses the SERVICE ROLE key, which bypasses RLS entirely — it is a real secret
// and must never reach a client bundle (the "server-only" import above makes any accidental
// client-side import a build-time error, not just a runtime leak). Used exclusively by the
// checkout/order/payment routes, which read/write MapleOrder/MapleOrderLine/PaymentAttempt/
// ProcessedWebhookEvent — tables with deny-all RLS (see supabase/migrations/002_maple_orders.sql)
// precisely because a guessable Studio-style session cookie must never reach payment data.
const SUPABASE_URL = "https://ovqkwedpwmuusnijbxro.supabase.co";

/** Build one per request — mirrors createStudioClient's own "don't share a client across
 *  sessions" guidance, even though there's no per-request header here to isolate. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Get it from the Supabase dashboard: Project Settings > API > service_role key.",
    );
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
