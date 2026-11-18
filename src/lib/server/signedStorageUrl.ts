import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Short-lived by design: these URLs are generated fresh on every quote-status-page render /
 *  admin ZIP download, not stored anywhere, so there's no "revoke it later" need -- they simply
 *  expire. 10 minutes is enough to view a page and click through to an image/download link, short
 *  enough that a leaked signed URL (referrer header, browser history, a screenshot of a link) is
 *  only a window, not forever. */
const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

/** Wraps Supabase Storage's createSignedUrl with a graceful null on failure rather than throwing.
 *
 *  FAIL-SECURE CONTRACT: `null` means "no URL to give out," full stop -- callers must NEVER
 *  substitute a stored plain/public URL as a fallback when this returns null. That used to be
 *  this codebase's behavior (fileInventory.ts's old resolveSecureUrl) and was deliberately
 *  removed: falling back to a permanent public URL for sensitive customer artwork defeats the
 *  entire point of signing in the first place, and after the bucket is switched to private, that
 *  stored URL wouldn't even resolve to the real file content as a plain GET expects either -- a
 *  signing failure must surface as "this file isn't available right now," never as a different,
 *  less-protected way to fetch the same file.
 *
 *  Works against the `design-uploads` bucket regardless of whether it's currently flagged public
 *  or private in the Supabase dashboard (createSignedUrl is a real, independent Storage API call
 *  either way) -- this function doesn't change or depend on that flag. */
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
 *  from a different host/bucket, or already-malformed data). Same fail-secure contract as
 *  getSignedAssetUrl above: a null here must lead to "unavailable," never a fallback to the
 *  original (unparseable) URL being used as-is. */
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

/** Same as extractStoragePathFromPublicUrl, but also recognizes a SIGNED object URL
 *  (`.../storage/v1/object/sign/{bucket}/{path}?token=...`) and strips its query string --
 *  needed anywhere a route has to accept whatever URL shape a client is CURRENTLY holding, which
 *  (after GET /api/studio/[id] and the upload routes started returning signed URLs for
 *  rendering) may legitimately be either shape depending on when the client last fetched it. See
 *  remove-background/route.ts's own call site. */
export function extractStoragePathFromAnyKnownUrl(url: string, bucket: string): string | null {
  const publicPath = extractStoragePathFromPublicUrl(url, bucket);
  if (publicPath) return publicPath;

  const signMarker = `/storage/v1/object/sign/${bucket}/`;
  const index = url.indexOf(signMarker);
  if (index === -1) return null;
  const rest = url.slice(index + signMarker.length);
  const rawPath = rest.split("?")[0];
  if (!rawPath) return null;
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

/** Rewrites whatever URL shape a client currently holds for a file back to the STABLE, permanent
 *  public-URL shape this app always stores in the database -- `data:` URIs pass through
 *  unchanged (already stable/self-contained). MUST be applied to every assetUrl/qrLogoUrl in a
 *  PATCH /api/studio/[id] autosave request before writing to the DesignObject table: since GET
 *  and the upload routes now return SIGNED urls for rendering (a short-lived token baked into the
 *  URL), the client's in-memory design state legitimately holds signed urls -- without this
 *  normalization, autosave would silently persist an expiring URL as if it were permanent,
 *  corrupting the stored design within ~10 minutes (the object would render fine during the
 *  current session, then go dead after reload, and -- because a signed URL's `/object/sign/`
 *  shape doesn't match what extractStoragePathFromPublicUrl expects -- become permanently
 *  unrecoverable, not just temporarily broken).
 *
 *  Returns the input UNCHANGED for anything that isn't a recognized Storage URL shape (also not a
 *  data: URI) -- deliberately NOT fail-secure here, unlike the read-side functions above: this is
 *  a write path, and silently discarding an unrecognized-but-possibly-legitimate value would risk
 *  losing a customer's design data, which is worse than storing it as-is unchanged. */
export function normalizeToStableStorageUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (extractStoragePathFromPublicUrl(url, bucket)) return url; // already the stable shape

  const signMarker = `/storage/v1/object/sign/${bucket}/`;
  const signIndex = url.indexOf(signMarker);
  if (signIndex === -1) return url; // not a recognized signed-URL shape -- pass through unchanged

  const path = extractStoragePathFromAnyKnownUrl(url, bucket);
  if (!path) return url;

  const origin = url.slice(0, signIndex);
  return `${origin}/storage/v1/object/public/${bucket}/${path}`;
}

/** The one canonical implementation of "given whatever raw URL this app stored for a file, what
 *  should actually be sent to the browser" -- used by both fileInventory.ts (quote/order/admin
 *  file lists) and signDesignProjectRecordUrls.ts (live Studio canvas editing), so the two can't
 *  silently diverge on this decision. Three cases:
 *
 *  1. null/empty -> null (nothing to resolve).
 *  2. A `data:` URI -> returned AS-IS, never run through signing at all. Studio's own clipart/
 *     graphics library (templates.ts's recolorMapleAsset, the open-source icon providers) writes
 *     assetUrl as a self-contained data: URI, not a Storage reference -- there is no bucket object
 *     behind it to sign, and it isn't customer-sensitive data (it's Maple's own shared asset
 *     library), so treating it as "unavailable" would be a real regression, not extra safety.
 *  3. Anything else -> treated as a possible Supabase Storage public URL: recover its path and
 *     sign it. If the path can't be recovered, or signing fails, returns null -- per
 *     getSignedAssetUrl's fail-secure contract, never the raw original URL.
 *
 *  `cache`, keyed by the raw input URL, is required for the same reason fileInventory.ts's own
 *  cache is: signing the same underlying file twice in one request would mint two different
 *  tokens for it, which can silently break a caller's own de-duplication logic. */
export async function resolveSecureAssetUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  cache: Map<string, Promise<string | null>>,
  bucket: string,
  rawUrl: string | null,
): Promise<string | null> {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("data:")) return rawUrl;

  const cached = cache.get(rawUrl);
  if (cached) return cached;

  const path = extractStoragePathFromPublicUrl(rawUrl, bucket);
  const promise = path ? getSignedAssetUrl(supabaseAdmin, bucket, path) : Promise.resolve(null);
  cache.set(rawUrl, promise);
  return promise;
}
