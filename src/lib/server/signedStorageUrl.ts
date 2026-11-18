import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Short-lived by design: these URLs are generated fresh on every quote-status-page render /
 *  admin ZIP download, not stored anywhere, so there's no "revoke it later" need -- they simply
 *  expire. 10 minutes is enough to view a page and click through to an image/download link, short
 *  enough that a leaked signed URL (referrer header, browser history, a screenshot of a link) is
 *  only a window, not forever. */
const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

/** Wraps Supabase Storage's createSignedUrl with a graceful null on failure rather than throwing
 *  -- every call site falls back to the already-known plain public URL when this returns null, so
 *  a signing hiccup degrades to today's behavior instead of breaking the page. Works against the
 *  `design-uploads` bucket regardless of whether it's currently flagged public or private in the
 *  Supabase dashboard (createSignedUrl is a real, independent Storage API call either way) -- this
 *  function doesn't change or depend on that flag, it's additive: once the bucket is switched to
 *  private (an owner action, not made by this code), every call site already using this function
 *  keeps working with zero further code changes, because signed URLs were already the thing being
 *  served. */
export async function getSignedAssetUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      console.error("[storage] createSignedUrl failed", { bucket, path, error: error?.message });
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[storage] createSignedUrl threw", { bucket, path, err });
    return null;
  }
}

/** Recovers the raw storage path from a Supabase "public" object URL
 *  (`.../storage/v1/object/public/{bucket}/{path}`) -- needed because DesignProject.exportedFiles/
 *  previewFiles (production + preview renders) only ever stored the full public URL, never a
 *  separate path column the way Asset.storagePath does for customer uploads. Pure string parsing,
 *  no network call; returns null for anything that doesn't match the expected shape (a stored URL
 *  from a different host/bucket, or already-malformed data) so callers can fall back safely rather
 *  than assume this always succeeds. */
export function extractStoragePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const rawPath = publicUrl.slice(index + marker.length);
  if (!rawPath) return null;
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}
