import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase client using the service role key. Only import this from API
 * route handlers — it bypasses row-level security by design, since the API
 * routes are the only trusted writers. Never import from a "use client"
 * component or the key would end up in the client bundle.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const ATTACHMENTS_BUCKET = "inquiry-attachments";
