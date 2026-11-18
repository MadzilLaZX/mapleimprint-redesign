/** Throws a clear, immediate error naming exactly which environment variable is missing, rather
 *  than letting `undefined` silently reach `createClient` (which would either throw an opaque
 *  fetch error for a missing URL, or -- worse -- authenticate successfully against Supabase's own
 *  default/anonymous behavior for a missing key, which is not what "fail closed" means here).
 *
 *  Deliberately called LAZILY, inside each client-construction function (createStudioClient(),
 *  createAdminClient()), never at module load time. A module-level `const URL = requireEnv(...)`
 *  would throw the moment anything imports that module for an unrelated reason -- several files
 *  (fileInventory.ts, exportDesign.ts, signDesignProjectUrls.ts) import
 *  src/lib/studio/supabaseClient.ts ONLY for its DESIGN_UPLOADS_BUCKET string constant, and this
 *  repo's unit tests transitively import those files without ever setting real Supabase
 *  credentials (by design -- see package.json's `test` script, which never loads .env.local).
 *  Keeping this lazy means importing a module for an unrelated export never requires real
 *  credentials to be present; only actually calling a client-construction function does. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. This project's Supabase connection is fully environment-configured ` +
        `-- there is no hardcoded fallback, and it never silently defaults to another project. ` +
        `Set it in .env.local for local development, or in the appropriate Vercel Environment ` +
        `Variables for Preview/Production. See docs/environment-configuration.md.`,
    );
  }
  return value;
}

export const SUPABASE_URL_ENV_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_ANON_KEY_ENV_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
export const SUPABASE_SERVICE_ROLE_KEY_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
