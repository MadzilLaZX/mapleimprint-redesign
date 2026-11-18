/** Identifies whether a given Supabase URL is the real maple-imprint-catalogue project, so that
 *  scripts and integration tests that must never (or must only with explicit confirmation) touch
 *  it can refuse automatically. This is the ONE place in the repo that still names the production
 *  project directly -- now that src/lib/studio/supabaseClient.ts and
 *  src/lib/server/supabaseAdmin.ts read their connection from environment variables instead of a
 *  hardcoded constant, nothing else needs to know which project is "the real one." The id itself
 *  is not a secret (it's visible in that project's own dashboard URL to anyone with access, the
 *  same way any Supabase project id is); this file exists to centralize a SAFETY check, not to
 *  document how to reach the project.
 *
 *  Two independent signals, either of which is enough to refuse:
 *    1. A literal match against the known project id -- catches it even when no Supabase
 *       environment variables are configured in the shell running a test or script at all.
 *    2. A match against whatever NEXT_PUBLIC_SUPABASE_URL is actually configured as right now --
 *       catches it even if the production project is ever recreated under a different id and
 *       this file's literal below goes stale. */
const KNOWN_PRODUCTION_PROJECT_FRAGMENT = "ovqkwedpwmuusnijbxro";

export function isProductionSupabaseUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes(KNOWN_PRODUCTION_PROJECT_FRAGMENT)) return true;
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(configuredUrl) && url === configuredUrl;
}

/** Throws (never returns a boolean for a caller to maybe-ignore) -- refusing to proceed is the
 *  only acceptable outcome once a candidate URL is identified as production. `context` is a short
 *  label identifying which env var / config value was being checked, so the thrown message is
 *  actionable rather than generic. */
export function refuseIfProductionSupabaseUrl(url: string | null | undefined, context: string): void {
  if (isProductionSupabaseUrl(url)) {
    throw new Error(
      `${context} resolves to the production Supabase project. Refusing to run -- point this at ` +
        `a local or staging Supabase instance instead.`,
    );
  }
}
