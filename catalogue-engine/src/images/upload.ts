// Uploads validated image bytes (from ingestImage()) to Supabase Storage and returns the public
// URL to record in the image manifest (see ./manifest.ts). The storage client is injected (same
// pattern as ingest.ts's `fetcher`) so this is unit-testable with a fake client -- no real
// Supabase project, bucket, or network call is needed to verify the logic is correct.
//
// NOT YET USED against the real project. The intended bucket (`product-images`) does not exist
// yet and no image has been uploaded to it -- creating it and running a real upload is a live,
// paid-storage-adjacent infrastructure change, out of scope to perform without explicit
// authorization (and, for supplier images specifically, without confirmed rehosting rights --
// see OUTREACH_DRAFTS.md #2a). This module exists so that once both exist, wiring them together
// is a small, already-tested addition, not something built from scratch under launch pressure.

export const PRODUCT_IMAGES_BUCKET = "product-images";

export interface StorageUploadError {
  message: string;
}

/** The minimal subset of @supabase/supabase-js's storage client this module needs -- kept narrow
 *  so a test fixture doesn't have to fake the entire SupabaseClient surface. */
export interface StorageBucketClient {
  upload(
    path: string,
    bytes: Buffer,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: StorageUploadError | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

export interface StorageClient {
  from(bucket: string): StorageBucketClient;
}

// No wrapper needed for the real implementation: a genuine `SupabaseClient.storage` object
// already satisfies `StorageClient` structurally (it exposes this exact `upload`/`getPublicUrl`
// shape) -- pass it directly to uploadImageToStorage() below. Never called against the real
// project this round.

export interface UploadImageResult {
  outcome: "uploaded" | "upload_failed";
  hostedUrl: string | null;
  error: string | null;
}

/** `path` should be stable and deterministic from the source (e.g. a hash or the supplier's own
 *  image id) so re-running this for the same image is idempotent -- `upsert: false` means a
 *  second upload of the same path is a no-op success, never a silent overwrite of different
 *  bytes under the same name. */
export async function uploadImageToStorage(
  client: StorageClient,
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<UploadImageResult> {
  const bucketClient = client.from(bucket);
  const { error } = await bucketClient.upload(path, bytes, { contentType, upsert: false });
  if (error) {
    return { outcome: "upload_failed", hostedUrl: null, error: error.message };
  }
  const { data } = bucketClient.getPublicUrl(path);
  return { outcome: "uploaded", hostedUrl: data.publicUrl, error: null };
}
