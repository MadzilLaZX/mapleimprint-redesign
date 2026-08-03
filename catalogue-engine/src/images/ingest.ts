// Orchestrates fetch -> validate -> (caller uploads to storage) for one image URL. Deliberately
// does NOT upload to S3/Cloudflare/etc itself — that needs real cloud storage credentials nobody
// has configured yet (see architecture doc §"Image Integration Strategy": "Download approved
// image -> Store in controlled cloud storage"). This module stops right before that step and
// hands the caller validated bytes + metadata; wiring in a real storage client is a small,
// isolated addition once credentials exist, and doesn't require touching this logic.

import { validateImage, isDuplicateImage, type ImageValidationOptions } from './validate.js';

/** Abstracts the actual HTTP fetch so tests can supply a fake without hitting the network. */
export type ImageFetcher = (url: string) => Promise<{ status: number; contentType: string | null; bytes: Buffer }>;

export const fetchImageBytes: ImageFetcher = async (url) => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    bytes: Buffer.from(arrayBuffer),
  };
};

export interface IngestImageResult {
  sourceUrl: string;
  outcome: 'validated' | 'rejected' | 'duplicate' | 'fetch_failed';
  reasons: string[];
  checksum: string | null;
  width: number | null;
  height: number | null;
  bytes: Buffer | null; // only present on 'validated' — caller uploads this to storage
}

export interface IngestImageOptions extends ImageValidationOptions {
  knownChecksums?: ReadonlySet<string>;
  fetcher?: ImageFetcher;
}

export async function ingestImage(
  sourceUrl: string,
  opts: IngestImageOptions = {},
): Promise<IngestImageResult> {
  const fetcher = opts.fetcher ?? fetchImageBytes;
  const knownChecksums = opts.knownChecksums ?? new Set<string>();

  let fetched: Awaited<ReturnType<ImageFetcher>>;
  try {
    fetched = await fetcher(sourceUrl);
  } catch (err) {
    return {
      sourceUrl,
      outcome: 'fetch_failed',
      reasons: [err instanceof Error ? err.message : String(err)],
      checksum: null,
      width: null,
      height: null,
      bytes: null,
    };
  }

  if (fetched.status !== 200) {
    return {
      sourceUrl,
      outcome: 'fetch_failed',
      reasons: [`HTTP ${fetched.status}`],
      checksum: null,
      width: null,
      height: null,
      bytes: null,
    };
  }

  if (fetched.contentType && !fetched.contentType.startsWith('image/')) {
    return {
      sourceUrl,
      outcome: 'rejected',
      reasons: [`unexpected content-type: ${fetched.contentType} (likely an HTML error page, not an image)`],
      checksum: null,
      width: null,
      height: null,
      bytes: null,
    };
  }

  const validation = await validateImage(fetched.bytes, opts);

  if (!validation.valid) {
    return {
      sourceUrl,
      outcome: 'rejected',
      reasons: validation.reasons,
      checksum: validation.checksum,
      width: validation.width,
      height: validation.height,
      bytes: null,
    };
  }

  if (validation.checksum && isDuplicateImage(validation.checksum, knownChecksums)) {
    return {
      sourceUrl,
      outcome: 'duplicate',
      reasons: ['identical bytes already ingested under a different URL (checksum match)'],
      checksum: validation.checksum,
      width: validation.width,
      height: validation.height,
      bytes: null,
    };
  }

  return {
    sourceUrl,
    outcome: 'validated',
    reasons: [],
    checksum: validation.checksum,
    width: validation.width,
    height: validation.height,
    bytes: fetched.bytes,
  };
}
