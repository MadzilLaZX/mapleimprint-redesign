// Merges newly-hosted image URLs into the website's imageManifest.json
// (src/lib/images/imageManifest.json, consulted by resolveHostedImage() -- already wired into
// products.ts for every CatalogueProduct.images entry). Pure, no network/filesystem access, so
// it's fully unit-testable with synthetic fixtures -- the orchestration step that actually
// downloads+uploads a real image lives in ./upload.ts, kept separate for the same reason
// validate.ts and ingest.ts are separate (testability without a real network/storage dependency).
//
// Never silently overwrites: if an existing manifest entry already maps a sourceUrl to one
// hostedUrl and a new update tries to map the SAME sourceUrl to a DIFFERENT hostedUrl, that's
// returned as a conflict for a human to resolve, not applied -- the same "never guess, surface
// it" policy as everywhere else in this codebase (see normalizeWeight.ts, buildPriceTiers, etc.).

export interface ManifestUpdate {
  sourceUrl: string;
  hostedUrl: string;
}

export interface ManifestConflict {
  sourceUrl: string;
  existingHostedUrl: string;
  attemptedHostedUrl: string;
}

export interface MergeManifestResult {
  manifest: Record<string, string>;
  added: string[]; // sourceUrls newly added
  unchanged: string[]; // sourceUrls already present with the identical hostedUrl -- no-op, not an error
  conflicts: ManifestConflict[]; // sourceUrls present with a DIFFERENT hostedUrl -- not applied
}

export function mergeImageManifest(existing: Record<string, string>, updates: ManifestUpdate[]): MergeManifestResult {
  const manifest = { ...existing };
  const added: string[] = [];
  const unchanged: string[] = [];
  const conflicts: ManifestConflict[] = [];

  for (const update of updates) {
    const current = manifest[update.sourceUrl];
    if (current === undefined) {
      manifest[update.sourceUrl] = update.hostedUrl;
      added.push(update.sourceUrl);
    } else if (current === update.hostedUrl) {
      unchanged.push(update.sourceUrl);
    } else {
      conflicts.push({ sourceUrl: update.sourceUrl, existingHostedUrl: current, attemptedHostedUrl: update.hostedUrl });
    }
  }

  return { manifest, added, unchanged, conflicts };
}
