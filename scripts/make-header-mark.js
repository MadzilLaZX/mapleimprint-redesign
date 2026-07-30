const sharp = require("sharp");
const path = require("path");

async function run() {
  const src = path.resolve(__dirname, "../public/logo/logo-lockup.png");
  const out = path.resolve(__dirname, "../public/logo/logo-mark-no-tagline.png");

  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Blank out the tagline strip (right of the leaf, below the wordmark) so we
  // can render the leaf+wordmark bigger in the header and add a crisp HTML
  // tagline instead of a tiny illegible raster one.
  const xStart = 460;
  const yStart = 315;
  const yEnd = 400;

  for (let y = yStart; y < yEnd && y < height; y++) {
    for (let x = xStart; x < width; x++) {
      const idx = (y * width + x) * channels;
      data[idx + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 10 })
    .png()
    .toFile(out);

  const meta = await sharp(out).metadata();
  console.log("Wrote", out, meta.width, meta.height);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
