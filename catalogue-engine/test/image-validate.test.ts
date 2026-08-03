import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { validateImage, isDuplicateImage } from '../src/images/validate.js';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe('validateImage', () => {
  it('accepts a well-formed image at or above the minimum resolution', async () => {
    const bytes = await makePng(1000, 1200);
    const result = await validateImage(bytes);
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.width).toBe(1000);
    expect(result.height).toBe(1200);
    expect(result.format).toBe('png');
    expect(result.checksum).toHaveLength(64); // sha256 hex
  });

  it('accepts an image exactly at the minimum resolution boundary', async () => {
    const bytes = await makePng(800, 800);
    const result = await validateImage(bytes); // default min is 800x800
    expect(result.valid).toBe(true);
  });

  it('rejects an image below the minimum width', async () => {
    const bytes = await makePng(799, 1000);
    const result = await validateImage(bytes);
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/width 799px below minimum/);
  });

  it('rejects an image below the minimum height', async () => {
    const bytes = await makePng(1000, 799);
    const result = await validateImage(bytes);
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/height 799px below minimum/);
  });

  it('respects custom minWidth/minHeight options', async () => {
    const bytes = await makePng(500, 500);
    const result = await validateImage(bytes, { minWidth: 400, minHeight: 400 });
    expect(result.valid).toBe(true);
  });

  it('rejects a non-image buffer without throwing (e.g. an HTML error page mistakenly downloaded)', async () => {
    const htmlBytes = Buffer.from('<html><body>404 Not Found</body></html>', 'utf-8');
    const result = await validateImage(htmlBytes);
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/not a decodable image/);
    expect(result.checksum).not.toBeNull(); // checksum is still computed even for invalid bytes
  });

  it('rejects an empty buffer', async () => {
    const result = await validateImage(Buffer.alloc(0));
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/empty response body/);
  });

  it('rejects a disallowed format even at valid resolution', async () => {
    const bytes = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();
    const result = await validateImage(bytes, { allowedFormats: ['jpeg', 'png'] });
    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/unsupported format: webp/);
  });

  it('produces identical checksums for identical bytes, different for different bytes', async () => {
    const a1 = await makePng(900, 900);
    const a2 = await makePng(900, 900); // same params -> should encode identically
    const b = await makePng(900, 901); // one pixel different -> different bytes

    const resultA1 = await validateImage(a1);
    const resultA2 = await validateImage(a2);
    const resultB = await validateImage(b);

    expect(resultA1.checksum).toBe(resultA2.checksum);
    expect(resultA1.checksum).not.toBe(resultB.checksum);
  });
});

describe('isDuplicateImage', () => {
  it('detects a checksum already present in the known set', () => {
    const known = new Set(['abc123', 'def456']);
    expect(isDuplicateImage('abc123', known)).toBe(true);
  });

  it('returns false for a checksum not in the known set', () => {
    const known = new Set(['abc123']);
    expect(isDuplicateImage('zzz999', known)).toBe(false);
  });
});
