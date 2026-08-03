import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { ingestImage, type ImageFetcher } from '../src/images/ingest.js';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 100, b: 200 } },
  })
    .png()
    .toBuffer();
}

function fakeFetcher(response: { status: number; contentType: string | null; bytes: Buffer }): ImageFetcher {
  return async () => response;
}

describe('ingestImage', () => {
  it('validates and returns bytes for a good image', async () => {
    const bytes = await makePng(1000, 1000);
    const result = await ingestImage('https://supplier.example/image.png', {
      fetcher: fakeFetcher({ status: 200, contentType: 'image/png', bytes }),
    });

    expect(result.outcome).toBe('validated');
    expect(result.bytes).not.toBeNull();
    expect(result.width).toBe(1000);
    expect(result.checksum).toHaveLength(64);
  });

  it('marks a non-200 response as fetch_failed, never as a valid image', async () => {
    const result = await ingestImage('https://supplier.example/missing.png', {
      fetcher: fakeFetcher({ status: 404, contentType: 'text/html', bytes: Buffer.from('not found') }),
    });
    expect(result.outcome).toBe('fetch_failed');
    expect(result.reasons.join(' ')).toMatch(/HTTP 404/);
    expect(result.bytes).toBeNull();
  });

  it('rejects an HTML error page served with a 200 status via content-type check', async () => {
    const result = await ingestImage('https://supplier.example/weird.png', {
      fetcher: fakeFetcher({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        bytes: Buffer.from('<html>oops</html>'),
      }),
    });
    expect(result.outcome).toBe('rejected');
    expect(result.reasons.join(' ')).toMatch(/unexpected content-type/);
  });

  it('rejects an undersized image via the validation pipeline', async () => {
    const bytes = await makePng(200, 200);
    const result = await ingestImage('https://supplier.example/small.png', {
      fetcher: fakeFetcher({ status: 200, contentType: 'image/png', bytes }),
    });
    expect(result.outcome).toBe('rejected');
    expect(result.bytes).toBeNull();
  });

  it('flags a duplicate when the checksum matches a known image', async () => {
    const bytes = await makePng(1000, 1000);
    const validation = await ingestImage('https://supplier.example/first.png', {
      fetcher: fakeFetcher({ status: 200, contentType: 'image/png', bytes }),
    });
    expect(validation.outcome).toBe('validated');

    const duplicate = await ingestImage('https://another-supplier.example/same-image.png', {
      fetcher: fakeFetcher({ status: 200, contentType: 'image/png', bytes }), // identical bytes
      knownChecksums: new Set([validation.checksum!]),
    });
    expect(duplicate.outcome).toBe('duplicate');
    expect(duplicate.bytes).toBeNull();
  });

  it('reports fetch_failed (not a crash) when the fetcher itself throws, e.g. network error', async () => {
    const throwingFetcher: ImageFetcher = async () => {
      throw new Error('ECONNRESET');
    };
    const result = await ingestImage('https://supplier.example/flaky.png', { fetcher: throwingFetcher });
    expect(result.outcome).toBe('fetch_failed');
    expect(result.reasons.join(' ')).toMatch(/ECONNRESET/);
  });
});
