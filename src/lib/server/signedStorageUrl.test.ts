import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSignedAssetUrl,
  extractStoragePathFromPublicUrl,
  extractStoragePathFromAnyKnownUrl,
  normalizeToStableStorageUrl,
  resolveSecureAssetUrl,
} from "./signedStorageUrl.ts";

// Fake Supabase client covering exactly the one call shape getSignedAssetUrl uses:
// .storage.from(bucket).createSignedUrl(path, expiresInSeconds) -- same inline-fake pattern as
// every other *.test.ts in this codebase (see freeze.test.ts's own note on why there's no shared
// Supabase-mocking helper yet).
function fakeSupabaseStorage(opts: {
  signedUrl?: string | null;
  error?: { message: string } | null;
  throws?: boolean;
  onCall?: (bucket: string, path: string, expiresInSeconds: number) => void;
}) {
  return {
    storage: {
      from(bucket: string) {
        return {
          createSignedUrl: async (path: string, expiresInSeconds: number) => {
            opts.onCall?.(bucket, path, expiresInSeconds);
            if (opts.throws) throw new Error("network error");
            if (opts.error) return { data: null, error: opts.error };
            return { data: { signedUrl: opts.signedUrl ?? null }, error: null };
          },
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("getSignedAssetUrl: returns the signed URL on success, requesting the exact bucket/path/ttl given", async () => {
  const calls: { bucket: string; path: string; ttl: number }[] = [];
  const client = fakeSupabaseStorage({
    signedUrl: "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz",
    onCall: (bucket, path, expiresInSeconds) => calls.push({ bucket, path, ttl: expiresInSeconds }),
  });
  const url = await getSignedAssetUrl(client, "design-uploads", "a/b.png", 300);
  assert.equal(url, "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz");
  assert.deepEqual(calls, [{ bucket: "design-uploads", path: "a/b.png", ttl: 300 }]);
});

test("getSignedAssetUrl: defaults to a 600-second (10 minute) expiry when none is given", async () => {
  let seenTtl: number | null = null;
  const client = fakeSupabaseStorage({
    signedUrl: "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz",
    onCall: (_bucket, _path, ttl) => (seenTtl = ttl),
  });
  await getSignedAssetUrl(client, "design-uploads", "a/b.png");
  assert.equal(seenTtl, 600);
});

test("getSignedAssetUrl: returns null (never throws) when Supabase returns an error -- callers must treat this as unavailable, never fall back to a public URL", async () => {
  const client = fakeSupabaseStorage({ error: { message: "object not found" } });
  const url = await getSignedAssetUrl(client, "design-uploads", "missing/file.png");
  assert.equal(url, null);
});

test("getSignedAssetUrl: returns null (never throws) when the Storage call itself throws (network error etc)", async () => {
  const client = fakeSupabaseStorage({ throws: true });
  const url = await getSignedAssetUrl(client, "design-uploads", "a/b.png");
  assert.equal(url, null);
});

test("getSignedAssetUrl: returns null immediately for an empty path, without calling Storage at all", async () => {
  let called = false;
  const client = fakeSupabaseStorage({ signedUrl: "https://irrelevant", onCall: () => (called = true) });
  const url = await getSignedAssetUrl(client, "design-uploads", "");
  assert.equal(url, null);
  assert.equal(called, false);
});

test("extractStoragePathFromPublicUrl: recovers the exact path from a real-shaped Supabase public URL", () => {
  const publicUrl = "https://ovqkwedpwmuusnijbxro.supabase.co/storage/v1/object/public/design-uploads/production-exports/abc-123/front.png";
  assert.equal(extractStoragePathFromPublicUrl(publicUrl, "design-uploads"), "production-exports/abc-123/front.png");
});

test("extractStoragePathFromPublicUrl: decodes URL-encoded characters in the path (e.g. a session token or filename with special characters)", () => {
  const publicUrl = "https://project.supabase.co/storage/v1/object/public/design-uploads/sess%2Dtoken/file%20name.png";
  assert.equal(extractStoragePathFromPublicUrl(publicUrl, "design-uploads"), "sess-token/file name.png");
});

test("extractStoragePathFromPublicUrl: returns null for a URL that doesn't match the expected bucket", () => {
  const publicUrl = "https://project.supabase.co/storage/v1/object/public/a-different-bucket/a/b.png";
  assert.equal(extractStoragePathFromPublicUrl(publicUrl, "design-uploads"), null);
});

test("extractStoragePathFromPublicUrl: returns null for a completely unrelated URL, never guesses", () => {
  assert.equal(extractStoragePathFromPublicUrl("https://example.com/not-supabase-at-all.png", "design-uploads"), null);
  assert.equal(extractStoragePathFromPublicUrl("", "design-uploads"), null);
});

test("resolveSecureAssetUrl: returns null immediately for a null/empty input, no Storage call made", async () => {
  let called = false;
  const client = fakeSupabaseStorage({ signedUrl: "https://irrelevant", onCall: () => (called = true) });
  assert.equal(await resolveSecureAssetUrl(client, new Map(), "design-uploads", null), null);
  assert.equal(await resolveSecureAssetUrl(client, new Map(), "design-uploads", ""), null);
  assert.equal(called, false);
});

test("resolveSecureAssetUrl: a data: URI is passed through UNCHANGED, never signed -- it isn't a Storage reference at all", async () => {
  let called = false;
  const client = fakeSupabaseStorage({ signedUrl: "https://irrelevant", onCall: () => (called = true) });
  const dataUri = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
  const result = await resolveSecureAssetUrl(client, new Map(), "design-uploads", dataUri);
  assert.equal(result, dataUri);
  assert.equal(called, false, "a data: URI must never trigger a Storage signing call");
});

test("resolveSecureAssetUrl: a real Supabase public URL is resolved to a signed URL", async () => {
  const client = fakeSupabaseStorage({ signedUrl: "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz" });
  const publicUrl = "https://project.supabase.co/storage/v1/object/public/design-uploads/a/b.png";
  const result = await resolveSecureAssetUrl(client, new Map(), "design-uploads", publicUrl);
  assert.equal(result, "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz");
});

test("resolveSecureAssetUrl: FAIL-SECURE -- an unparseable URL (not a data: URI, not a recognizable Supabase public URL) resolves to null, never the raw URL", async () => {
  const client = fakeSupabaseStorage({ signedUrl: "https://irrelevant" });
  const result = await resolveSecureAssetUrl(client, new Map(), "design-uploads", "https://example.com/mystery-file.png");
  assert.equal(result, null);
});

test("resolveSecureAssetUrl: caches by the raw input URL -- the same URL requested twice only signs once", async () => {
  let callCount = 0;
  const client = fakeSupabaseStorage({
    signedUrl: "https://project.supabase.co/storage/v1/object/sign/design-uploads/a/b.png?token=xyz",
    onCall: () => callCount++,
  });
  const cache = new Map();
  const publicUrl = "https://project.supabase.co/storage/v1/object/public/design-uploads/a/b.png";
  const first = await resolveSecureAssetUrl(client, cache, "design-uploads", publicUrl);
  const second = await resolveSecureAssetUrl(client, cache, "design-uploads", publicUrl);
  assert.equal(first, second);
  assert.equal(callCount, 1);
});

test("extractStoragePathFromAnyKnownUrl: recovers the path from a plain public URL (same as extractStoragePathFromPublicUrl)", () => {
  const url = "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/a.png";
  assert.equal(extractStoragePathFromAnyKnownUrl(url, "design-uploads"), "sess/a.png");
});

test("extractStoragePathFromAnyKnownUrl: recovers the path from a SIGNED URL, stripping the token query string", () => {
  const url = "https://project.supabase.co/storage/v1/object/sign/design-uploads/sess/a.png?token=abc123.xyz";
  assert.equal(extractStoragePathFromAnyKnownUrl(url, "design-uploads"), "sess/a.png");
});

test("extractStoragePathFromAnyKnownUrl: returns null for a URL that's neither shape", () => {
  assert.equal(extractStoragePathFromAnyKnownUrl("https://example.com/not-supabase.png", "design-uploads"), null);
});

test("normalizeToStableStorageUrl: SECURITY/CORRECTNESS -- rewrites a signed URL back to the stable public-URL shape, dropping the token", () => {
  const signed = "https://project.supabase.co/storage/v1/object/sign/design-uploads/sess/a.png?token=abc123.xyz";
  const normalized = normalizeToStableStorageUrl(signed, "design-uploads");
  assert.equal(normalized, "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/a.png");
});

test("normalizeToStableStorageUrl: a URL already in the stable public shape is returned unchanged", () => {
  const publicUrl = "https://project.supabase.co/storage/v1/object/public/design-uploads/sess/a.png";
  assert.equal(normalizeToStableStorageUrl(publicUrl, "design-uploads"), publicUrl);
});

test("normalizeToStableStorageUrl: a data: URI is returned unchanged", () => {
  const dataUri = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E";
  assert.equal(normalizeToStableStorageUrl(dataUri, "design-uploads"), dataUri);
});

test("normalizeToStableStorageUrl: null stays null", () => {
  assert.equal(normalizeToStableStorageUrl(null, "design-uploads"), null);
});

test("normalizeToStableStorageUrl: an unrecognized URL shape is returned UNCHANGED, never discarded -- this is a write path, losing customer design data is worse than storing an unexpected value as-is", () => {
  const mystery = "https://example.com/some-other-url.png";
  assert.equal(normalizeToStableStorageUrl(mystery, "design-uploads"), mystery);
});
