import { describe, it, expect } from 'vitest';
import { uploadImageToStorage, type StorageClient } from '../src/images/upload.js';

// Fake storage client -- no real Supabase project, bucket, or network call. Proves the
// orchestration logic (upload -> getPublicUrl -> map to a UploadImageResult) is correct in
// isolation, the same way ingest.ts's tests use a fake `fetcher` instead of real HTTP.
function fakeStorageClient(opts: { uploadError?: string; publicUrl?: string } = {}): StorageClient {
  return {
    from(_bucket: string) {
      return {
        async upload() {
          if (opts.uploadError) return { error: { message: opts.uploadError } };
          return { error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: opts.publicUrl ?? `https://storage.test/${path}` } };
        },
      };
    },
  };
}

describe('uploadImageToStorage', () => {
  it('returns the public URL on a successful upload', async () => {
    const client = fakeStorageClient();
    const result = await uploadImageToStorage(client, 'product-images', 'suppliers/ssactivewear/abc123.jpg', Buffer.from('fake-bytes'), 'image/jpeg');
    expect(result.outcome).toBe('uploaded');
    expect(result.hostedUrl).toBe('https://storage.test/suppliers/ssactivewear/abc123.jpg');
    expect(result.error).toBeNull();
  });

  it('reports a failed upload without throwing, and without a hostedUrl', async () => {
    const client = fakeStorageClient({ uploadError: 'bucket not found' });
    const result = await uploadImageToStorage(client, 'product-images', 'x.jpg', Buffer.from('bytes'), 'image/jpeg');
    expect(result.outcome).toBe('upload_failed');
    expect(result.hostedUrl).toBeNull();
    expect(result.error).toBe('bucket not found');
  });

  it('passes the exact bucket and path through to the client', async () => {
    let seenBucket: string | null = null;
    const client: StorageClient = {
      from(bucket: string) {
        seenBucket = bucket;
        return {
          async upload() {
            return { error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://storage.test/${path}` } };
          },
        };
      },
    };
    const result = await uploadImageToStorage(client, 'product-images', 'my/exact/path.jpg', Buffer.from('b'), 'image/png');
    expect(seenBucket).toBe('product-images');
    expect(result.hostedUrl).toBe('https://storage.test/my/exact/path.jpg');
  });
});
