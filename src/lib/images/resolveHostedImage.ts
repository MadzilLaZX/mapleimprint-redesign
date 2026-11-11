// Maps a supplier-hotlinked image URL to our own hosted copy, when one exists. Empty today — no
// images have been uploaded to Supabase Storage's `product-images` bucket pending confirmation
// that our supplier agreements permit re-hosting (see 2026-11-10 investigation). Populating
// imageManifest.json (sourceUrl -> hostedUrl) is the entire migration step once that's resolved;
// every consumer of CatalogueProduct.images already resolves through here via products.ts, so no
// further site code changes will be needed.
// Explicit import attribute -- required by plain `node --test` (this file's own test imports it
// directly), and standard/stable syntax Next.js's bundler already supports too.
import manifest from "./imageManifest.json" with { type: "json" };

const MANIFEST: Record<string, string> = manifest;

// `manifest` defaults to the real imported one -- the optional override exists purely so a test
// can inject a synthetic manifest without touching the real (currently empty) JSON file. Every
// real call site (products.ts) uses the default and is unaffected by this parameter existing.
export function resolveHostedImage(sourceUrl: string, manifest: Record<string, string> = MANIFEST): string {
  return manifest[sourceUrl] ?? sourceUrl;
}
