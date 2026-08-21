import { createClient } from "@supabase/supabase-js";

// Unlike every other credential in this codebase, these two values are deliberately NOT secrets —
// Supabase's anon/publishable key is designed to be shipped in client bundles; access control is
// enforced entirely by the Row Level Security policies on the DesignProject/DesignSide/DesignObject
// tables and the design-uploads storage bucket (see catalogue-engine's migration history), which
// scope every row to the caller's `x-mi-session` header. Hardcoded (not an env var) on purpose, so
// Studio works on every deployment target without needing Vercel env var configuration — there is
// nothing here a real secret-scanning rule should flag.
const SUPABASE_URL = "https://ovqkwedpwmuusnijbxro.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cWt3ZWRwd211dXNuaWpieHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1OTkyNDMsImV4cCI6MjEwMTE3NTI0M30.JMh1CCgXePe1IlD3gsiOFrXq3fpDUDpwmUOMw2YPNes";

/** Every Studio DB/storage call must go through a client scoped to the caller's anonymous session
 *  — the RLS policies key off this header, so a client built without it can only touch rows with
 *  no owner (i.e. none). Build one per request; don't share a single client across sessions. */
export function createStudioClient(sessionToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-mi-session": sessionToken } },
    auth: { persistSession: false },
  });
}

export const DESIGN_UPLOADS_BUCKET = "design-uploads";
