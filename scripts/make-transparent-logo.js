const sharp = require("sharp");
const path = require("path");

const src = path.resolve(__dirname, "../brand-assets/source/maple-imprint-black.png");
const out = path.resolve(__dirname, "../brand-assets/source/maple-imprint-mark.png");

async function run() {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Sample corner pixel to find the background color (should be near-black).
  const bg = [data[0], data[1], data[2]];
  console.log("Detected background color:", bg);

  const threshold = 40; // distance tolerance for chroma-keying near-black bg
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    if (dist < threshold) {
      data[i + 3] = 0; // fully transparent
    } else if (dist < threshold * 2.2) {
      // soft edge anti-aliasing
      const alpha = Math.min(255, Math.round(((dist - threshold) / (threshold * 1.2)) * 255));
      data[i + 3] = alpha;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(out);
  console.log("Wrote", out);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
