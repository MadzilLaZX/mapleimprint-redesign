import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignProjectRecord } from "@/lib/studio/types";
import { DESIGN_UPLOADS_BUCKET } from "@/lib/studio/supabaseClient";
import { getSignedAssetUrl, resolveSecureAssetUrl } from "@/lib/server/signedStorageUrl";

/** `url: null` means "couldn't produce an accessible URL for this file right now" (signing
 *  failed, or the stored reference couldn't be resolved to a storage path at all) -- callers must
 *  render this as an explicit "temporarily unavailable" state, never omit it silently (the file
 *  still exists; a customer/admin seeing nothing at all would reasonably assume data loss) and
 *  never substitute a different, less-protected URL in its place. See signedStorageUrl.ts's own
 *  fail-secure contract. */
export interface FileInventoryAssetFile {
  originalFileName: string;
  url: string | null;
  fileSizeBytes: number | null;
}

export interface FileInventoryProductionFile {
  sideType: string;
  pngUrl: string | null;
  svgUrl: string | null;
}

export interface FileInventoryPreviewFile {
  sideType: string;
  url: string | null;
}

export interface LineFileInventory {
  lineIndex: number;
  productName: string;
  colourName: string | null;
  quantity: number;
  sizeBreakdown: { size: string; qty: number }[] | null;
  customizationType: string | null;
  designProjectId: string | null;
  exportStatus: string | null;
  exportError: string | null;
  designSnapshot: DesignProjectRecord | null;
  assets: FileInventoryAssetFile[];
  production: FileInventoryProductionFile[];
  preview: FileInventoryPreviewFile[];
  assistanceBrief: Record<string, unknown> | null;
}

interface LineLike {
  productName: string;
  colourName?: string | null;
  quantity: number;
  sizeBreakdown?: { size: string; qty: number }[] | null;
  customizationType?: string | null;
  designProjectId?: string | null;
  designSnapshot?: unknown;
  assistanceBrief?: Record<string, unknown> | null;
}

interface DesignProjectExportRow {
  id: string;
  exportStatus: string | null;
  exportError: string | null;
  exportedFiles: Record<string, { pngUrl: string; svgUrl: string | null }> | null;
  previewFiles: Record<string, { url: string }> | null;
}

interface AssetRow {
  id: string;
  originalFileName: string;
  storageBucket: string;
  storagePath: string;
  fileSizeBytes: number | null;
}

/** Signs a known (bucket, path) pair directly -- used for tracked Asset rows, which already have
 *  their real storage path as its own column, so there's no URL to parse first. Same fail-secure
 *  contract and caching rationale as resolveSecureAssetUrl in signedStorageUrl.ts (used below for
 *  the other three file categories, which only ever have a raw stored URL, not a separate path
 *  column) -- kept as a tiny separate helper rather than forcing a fake URL through
 *  resolveSecureAssetUrl just to re-extract the path we already have. */
async function signKnownPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  cache: Map<string, Promise<string | null>>,
  bucket: string,
  path: string,
): Promise<string | null> {
  const cacheKey = `${bucket}:${path}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const promise = getSignedAssetUrl(supabaseAdmin, bucket, path);
  cache.set(cacheKey, promise);
  return promise;
}

/** Shared by the admin order/quote detail pages (rendering links) and the bulk-ZIP routes
 *  (fetching the same files) — one place that knows how to walk a frozen designSnapshot plus a
 *  Designer's Choice assistanceBrief and resolve every real Asset/Design/Production/Preview file
 *  behind a set of order or quote lines, so the two call sites can't silently drift apart.
 *
 *  AUTHORIZATION: this function trusts `lines` completely and applies no access check of its own
 *  — every caller (see the six call sites under src/app/) must already have verified the caller
 *  is allowed to see exactly these lines (a reference-scoped lookup, or the admin session gate in
 *  proxy.ts) BEFORE calling this. Signing only ever happens for files that were already reachable
 *  through an authorized, single-record lookup — never for an arbitrary/caller-supplied path. */
export async function buildFileInventory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  lines: LineLike[],
): Promise<LineFileInventory[]> {
  const designProjectIds = [...new Set(lines.map((l) => l.designProjectId).filter((id): id is string => Boolean(id)))];
  const { data: designProjectRows } = designProjectIds.length
    ? await supabaseAdmin
        .from("DesignProject")
        .select("id, exportStatus, exportError, exportedFiles, previewFiles")
        .in("id", designProjectIds)
    : { data: [] as DesignProjectExportRow[] };
  const designProjectById = new Map((designProjectRows ?? []).map((p: DesignProjectExportRow) => [p.id, p]));

  const assetIds = new Set<string>();
  for (const line of lines) {
    const snapshot = line.designSnapshot as DesignProjectRecord | null | undefined;
    for (const side of snapshot?.sides ?? []) {
      for (const obj of side.objects) {
        if (obj.assetId) assetIds.add(obj.assetId);
      }
    }
    const uploadedAssetId = line.assistanceBrief?.uploadedAssetId;
    if (typeof uploadedAssetId === "string") assetIds.add(uploadedAssetId);
  }
  const { data: assetRows } = assetIds.size
    ? await supabaseAdmin.from("Asset").select("id, originalFileName, storageBucket, storagePath, fileSizeBytes").in("id", [...assetIds])
    : { data: [] as AssetRow[] };
  const assetById = new Map((assetRows ?? []).map((a: AssetRow) => [a.id, a]));
  // Both shared across every line in this call, not per-line -- the same uploaded asset or export
  // can legitimately appear on more than one line (e.g. a logo placed on both a front and back
  // design). Two separate caches because they're keyed differently (bucket:path vs. raw URL).
  const pathSignCache = new Map<string, Promise<string | null>>();
  const urlSignCache = new Map<string, Promise<string | null>>();

  return Promise.all(
    lines.map(async (line, lineIndex) => {
      const snapshot = (line.designSnapshot as DesignProjectRecord | null) ?? null;
      const project = line.designProjectId ? designProjectById.get(line.designProjectId) : null;

      // De-dup key is the STABLE identifier (asset id, or the original stored URL) decided BEFORE
      // signing -- signed URLs embed a fresh token per call, so de-duping on the final url would
      // never match even for the exact same underlying file.
      const seenKeys = new Set<string>();
      const assets: FileInventoryAssetFile[] = [];
      const addAsset = (dedupeKey: string, file: FileInventoryAssetFile) => {
        if (seenKeys.has(dedupeKey)) return;
        seenKeys.add(dedupeKey);
        assets.push(file);
      };

      for (const side of snapshot?.sides ?? []) {
        for (const obj of side.objects) {
          // Per renderDesignForExport.ts's own drawObject logic, a QR placement is written to the
          // wire as an ordinary "image" object — this check intentionally mirrors that, not just
          // obj.type === "image" vs some separate "qr" case.
          if (obj.type !== "image") continue;
          const asset = obj.assetId ? assetById.get(obj.assetId) : null;
          if (asset) {
            const url = await signKnownPath(supabaseAdmin, pathSignCache, asset.storageBucket, asset.storagePath);
            addAsset(`asset:${asset.id}`, { originalFileName: asset.originalFileName, url, fileSizeBytes: asset.fileSizeBytes });
          } else if (obj.assetUrl) {
            // No tracked Asset row -- either an older upload (recover its path from the stored URL
            // and sign it) or a template-provided graphic (a self-contained data: URI, passed
            // through unchanged -- see resolveSecureAssetUrl's own comment on why that's correct,
            // not a security hole: it isn't a Storage reference at all).
            const url = await resolveSecureAssetUrl(supabaseAdmin, urlSignCache, DESIGN_UPLOADS_BUCKET, obj.assetUrl);
            addAsset(`url:${obj.assetUrl}`, { originalFileName: obj.assetUrl.split("/").pop() ?? "asset", url, fileSizeBytes: null });
          }
        }
      }
      const uploadedAssetId = line.assistanceBrief?.uploadedAssetId;
      if (typeof uploadedAssetId === "string") {
        const asset = assetById.get(uploadedAssetId);
        if (asset) {
          const url = await signKnownPath(supabaseAdmin, pathSignCache, asset.storageBucket, asset.storagePath);
          addAsset(`asset:${asset.id}`, { originalFileName: asset.originalFileName, url, fileSizeBytes: asset.fileSizeBytes });
        }
      }

      const exportedFiles = project?.exportedFiles ?? {};
      const previewFiles = project?.previewFiles ?? {};

      const production: FileInventoryProductionFile[] = await Promise.all(
        Object.entries(exportedFiles).map(async ([sideType, f]) => ({
          sideType,
          pngUrl: await resolveSecureAssetUrl(supabaseAdmin, urlSignCache, DESIGN_UPLOADS_BUCKET, f.pngUrl),
          svgUrl: f.svgUrl ? await resolveSecureAssetUrl(supabaseAdmin, urlSignCache, DESIGN_UPLOADS_BUCKET, f.svgUrl) : null,
        })),
      );
      const preview: FileInventoryPreviewFile[] = await Promise.all(
        Object.entries(previewFiles).map(async ([sideType, f]) => ({
          sideType,
          url: await resolveSecureAssetUrl(supabaseAdmin, urlSignCache, DESIGN_UPLOADS_BUCKET, f.url),
        })),
      );

      return {
        lineIndex,
        productName: line.productName,
        colourName: line.colourName ?? null,
        quantity: line.quantity,
        sizeBreakdown: line.sizeBreakdown ?? null,
        customizationType: line.customizationType ?? null,
        designProjectId: line.designProjectId ?? null,
        exportStatus: project?.exportStatus ?? null,
        exportError: project?.exportError ?? null,
        designSnapshot: snapshot,
        assets,
        production,
        preview,
        assistanceBrief: line.assistanceBrief ?? null,
      };
    }),
  );
}
