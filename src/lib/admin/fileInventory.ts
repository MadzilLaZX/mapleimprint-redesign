import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignProjectRecord } from "@/lib/studio/types";
import { DESIGN_UPLOADS_BUCKET } from "@/lib/studio/supabaseClient";
import { getSignedAssetUrl, extractStoragePathFromPublicUrl } from "@/lib/server/signedStorageUrl";

export interface FileInventoryAssetFile {
  originalFileName: string;
  url: string;
  fileSizeBytes: number | null;
}

export interface FileInventoryProductionFile {
  sideType: string;
  pngUrl: string;
  svgUrl: string | null;
}

export interface FileInventoryPreviewFile {
  sideType: string;
  url: string;
}

export interface LineFileInventory {
  lineIndex: number;
  productName: string;
  colourName: string | null;
  quantity: number;
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
  publicUrl: string;
  storageBucket: string;
  storagePath: string;
  fileSizeBytes: number | null;
}

/** Resolves the real URL a browser should fetch for a file in the (currently public)
 *  design-uploads bucket, preferring a short-lived signed URL over the stored plain public one.
 *
 *  PRIVACY DESIGN (2026-11-19): the bucket itself is still public (a Production storage-policy
 *  change, not something this code makes) — this function doesn't change what's fetchable TODAY,
 *  it changes WHAT URL gets handed out. A signed URL from createSignedUrl() is real and valid
 *  regardless of the bucket's public/private flag, so every call site that adopts this (both
 *  below) is already serving the secure form the moment the bucket is flipped to private, with no
 *  further code change needed then. Falls back to the known plain URL on any failure (missing
 *  path, signing error) so today's functionality is never at risk — see signedStorageUrl.ts's own
 *  comment for the full reasoning.
 *
 *  `cache` is required, not optional: signing the same (bucket, path) twice within one
 *  buildFileInventory() call would mint two DIFFERENT signed URLs (each createSignedUrl() call
 *  embeds a fresh token) for what is the SAME underlying file — besides the redundant Storage
 *  calls, that would silently break addAsset()'s own de-duplication below, which used to rely on
 *  the (previously stable) URL being identical for the same asset. Memoizing on the identifying
 *  key, not the resulting signed URL, keeps both the de-dup and the output stable per call. */
async function resolveSecureUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  cache: Map<string, Promise<string>>,
  bucket: string,
  path: string | null,
  fallbackUrl: string,
): Promise<string> {
  if (!path) return fallbackUrl;
  const cacheKey = `${bucket}:${path}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const promise = getSignedAssetUrl(supabaseAdmin, bucket, path).then((signed) => signed ?? fallbackUrl);
  cache.set(cacheKey, promise);
  return promise;
}

/** Shared by the admin order/quote detail pages (rendering links) and the bulk-ZIP routes
 *  (fetching the same files) — one place that knows how to walk a frozen designSnapshot plus a
 *  Designer's Choice assistanceBrief and resolve every real Asset/Design/Production/Preview file
 *  behind a set of order or quote lines, so the two call sites can't silently drift apart. */
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
    ? await supabaseAdmin.from("Asset").select("id, originalFileName, publicUrl, storageBucket, storagePath, fileSizeBytes").in("id", [...assetIds])
    : { data: [] as AssetRow[] };
  const assetById = new Map((assetRows ?? []).map((a: AssetRow) => [a.id, a]));
  // Shared across every line in this call, not per-line -- the same uploaded asset can legitimately
  // appear on more than one line (e.g. a logo placed on both a front and back design).
  const signedUrlCache = new Map<string, Promise<string>>();

  return Promise.all(
    lines.map(async (line, lineIndex) => {
      const snapshot = (line.designSnapshot as DesignProjectRecord | null) ?? null;
      const project = line.designProjectId ? designProjectById.get(line.designProjectId) : null;

      // De-dup key is the STABLE identifier (asset id, or the resolved storage path/fallback URL)
      // decided BEFORE signing -- signed URLs embed a fresh token per call, so de-duping on the
      // final url would never match even for the exact same underlying file.
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
            const url = await resolveSecureUrl(supabaseAdmin, signedUrlCache, asset.storageBucket, asset.storagePath, asset.publicUrl);
            addAsset(`asset:${asset.id}`, { originalFileName: asset.originalFileName, url, fileSizeBytes: asset.fileSizeBytes });
          } else if (obj.assetUrl) {
            // No tracked Asset row (an older upload, or a template-provided image) — still try to
            // sign it by recovering a path from the stored URL itself; falls back to the plain URL
            // exactly like the tracked-Asset case above if that doesn't resolve.
            const path = extractStoragePathFromPublicUrl(obj.assetUrl, DESIGN_UPLOADS_BUCKET);
            const url = await resolveSecureUrl(supabaseAdmin, signedUrlCache, DESIGN_UPLOADS_BUCKET, path, obj.assetUrl);
            addAsset(`url:${obj.assetUrl}`, { originalFileName: obj.assetUrl.split("/").pop() ?? "asset", url, fileSizeBytes: null });
          }
        }
      }
      const uploadedAssetId = line.assistanceBrief?.uploadedAssetId;
      if (typeof uploadedAssetId === "string") {
        const asset = assetById.get(uploadedAssetId);
        if (asset) {
          const url = await resolveSecureUrl(supabaseAdmin, signedUrlCache, asset.storageBucket, asset.storagePath, asset.publicUrl);
          addAsset(`asset:${asset.id}`, { originalFileName: asset.originalFileName, url, fileSizeBytes: asset.fileSizeBytes });
        }
      }

      const exportedFiles = project?.exportedFiles ?? {};
      const previewFiles = project?.previewFiles ?? {};

      const production: FileInventoryProductionFile[] = await Promise.all(
        Object.entries(exportedFiles).map(async ([sideType, f]) => ({
          sideType,
          pngUrl: await resolveSecureUrl(supabaseAdmin, signedUrlCache, DESIGN_UPLOADS_BUCKET, extractStoragePathFromPublicUrl(f.pngUrl, DESIGN_UPLOADS_BUCKET), f.pngUrl),
          svgUrl: f.svgUrl
            ? await resolveSecureUrl(supabaseAdmin, signedUrlCache, DESIGN_UPLOADS_BUCKET, extractStoragePathFromPublicUrl(f.svgUrl, DESIGN_UPLOADS_BUCKET), f.svgUrl)
            : null,
        })),
      );
      const preview: FileInventoryPreviewFile[] = await Promise.all(
        Object.entries(previewFiles).map(async ([sideType, f]) => ({
          sideType,
          url: await resolveSecureUrl(supabaseAdmin, signedUrlCache, DESIGN_UPLOADS_BUCKET, extractStoragePathFromPublicUrl(f.url, DESIGN_UPLOADS_BUCKET), f.url),
        })),
      );

      return {
        lineIndex,
        productName: line.productName,
        colourName: line.colourName ?? null,
        quantity: line.quantity,
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
