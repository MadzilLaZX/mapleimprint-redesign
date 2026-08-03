// Image validation for the ingestion pipeline (architecture doc §"Image Integration Strategy").
// Pure function over image bytes — no network/storage dependency, so it's fully unit-testable
// without a real supplier image URL or cloud storage account. The orchestration step that
// actually fetches a URL and uploads to storage lives in ./ingest.ts.

import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';

export interface ImageValidationOptions {
  /** Architecture doc's default: reject primary images below this on either dimension. */
  minWidth?: number;
  minHeight?: number;
  allowedFormats?: string[]; // sharp's format names, e.g. 'jpeg' | 'png' | 'webp'
}

export interface ImageValidationResult {
  valid: boolean;
  reasons: string[];
  width: number | null;
  height: number | null;
  format: string | null;
  checksum: string | null; // sha256 of the raw bytes — used for cross-supplier dedup
  byteSize: number;
}

const DEFAULT_OPTIONS: Required<ImageValidationOptions> = {
  minWidth: 800,
  minHeight: 800,
  allowedFormats: ['jpeg', 'png', 'webp'],
};

/**
 * Validates downloaded image bytes before they're allowed into storage. Never throws on bad
 * input — a corrupt/non-image response is exactly the case this exists to catch, so it must
 * resolve to `{ valid: false, reasons: [...] }` rather than crash the sync job that called it.
 */
export async function validateImage(
  bytes: Buffer,
  opts: ImageValidationOptions = {},
): Promise<ImageValidationResult> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const reasons: string[] = [];
  const byteSize = bytes.byteLength;

  if (byteSize === 0) {
    return { valid: false, reasons: ['empty response body'], width: null, height: null, format: null, checksum: null, byteSize };
  }

  const checksum = createHash('sha256').update(bytes).digest('hex');

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    return {
      valid: false,
      reasons: ['not a decodable image (corrupt file or non-image response, e.g. an HTML error page)'],
      width: null,
      height: null,
      format: null,
      checksum,
      byteSize,
    };
  }

  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  const format = metadata.format ?? null;

  if (format === null || !options.allowedFormats.includes(format)) {
    reasons.push(`unsupported format: ${format ?? 'unknown'} (allowed: ${options.allowedFormats.join(', ')})`);
  }
  if (width === null || height === null) {
    reasons.push('could not determine image dimensions');
  } else {
    if (width < options.minWidth) reasons.push(`width ${width}px below minimum ${options.minWidth}px`);
    if (height < options.minHeight) reasons.push(`height ${height}px below minimum ${options.minHeight}px`);
  }

  return { valid: reasons.length === 0, reasons, width, height, format, checksum, byteSize };
}

/** True if this checksum has already been ingested — the caller supplies known checksums (e.g.
 * from ProductImage.checksum), since this module has no database dependency of its own. */
export function isDuplicateImage(checksum: string, knownChecksums: ReadonlySet<string>): boolean {
  return knownChecksums.has(checksum);
}
