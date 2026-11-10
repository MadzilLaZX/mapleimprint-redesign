// Maps a supplier-hotlinked image URL to our own hosted copy, when one exists. Empty today — no
// images have been uploaded to Supabase Storage's `product-images` bucket pending confirmation
// that our supplier agreements permit re-hosting (see 2026-11-10 investigation). Populating
// imageManifest.json (sourceUrl -> hostedUrl) is the entire migration step once that's resolved;
// every consumer of CatalogueProduct.images already resolves through here via products.ts, so no
// further site code changes will be needed.
import manifest from "./imageManifest.json";

const MANIFEST: Record<string, string> = manifest;

export function resolveHostedImage(sourceUrl: string): string {
  return MANIFEST[sourceUrl] ?? sourceUrl;
}
