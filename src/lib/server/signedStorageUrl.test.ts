import { test } from "node:test";
import assert from "node:assert/strict";
import { getSignedAssetUrl, extractStoragePathFromPublicUrl } from "./signedStorageUrl.ts";

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

test("getSignedAssetUrl: returns null (never throws) when Supabase returns an error -- callers fall back to the known public URL", async () => {
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
