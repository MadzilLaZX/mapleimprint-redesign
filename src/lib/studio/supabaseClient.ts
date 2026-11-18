import { createClient } from "@supabase/supabase-js";
import { requireEnv, SUPABASE_URL_ENV_VAR, SUPABASE_ANON_KEY_ENV_VAR } from "@/lib/server/supabaseEnv";

// Unlike every other credential in this codebase, these two values are deliberately NOT secrets —
// Supabase's anon/publishable key is designed to be shipped in client bundles; access control is
// enforced entirely by the Row Level Security policies on the DesignProject/DesignSide/DesignObject
// tables and the design-uploads storage bucket (see catalogue-engine's migration history), which
// scope every row to the caller's `x-mi-session` header. NEXT_PUBLIC_-prefixed because of that —
// not because anything currently imports this module into a browser bundle (nothing does; every
// importer is a server route or server-only lib), but because the Next.js convention for "safe to
// expose" values is the NEXT_PUBLIC_ prefix, and using it now means no rename is needed if that
// ever changes. There is deliberately NO hardcoded fallback: which Supabase project this connects
// to is entirely environment-configured (see docs/environment-configuration.md), so Preview,
// Production, and local dev can each point at a different project without a code change, and a
// missing/misconfigured environment fails the request rather than silently reusing another
// environment's project.

/** Every Studio DB/storage call must go through a client scoped to the caller's anonymous session
 *  — the RLS policies key off this header, so a client built without it can only touch rows with
 *  no owner (i.e. none). Build one per request; don't share a single client across sessions.
 *  Reads its connection from the environment on every call (not once at module load) so a single
 *  warm server process always uses whatever is currently configured — see requireEnv's own
 *  comment on why this check is lazy rather than a module-level constant. */
export function createStudioClient(sessionToken: string) {
  const url = requireEnv(SUPABASE_URL_ENV_VAR);
  const anonKey = requireEnv(SUPABASE_ANON_KEY_ENV_VAR);
  return createClient(url, anonKey, {
    global: { headers: { "x-mi-session": sessionToken } },
    auth: { persistSession: false },
  });
}

export const DESIGN_UPLOADS_BUCKET = "design-uploads";
