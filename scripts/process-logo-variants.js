const sharp = require("sharp");
const path = require("path");

const markPath = path.resolve(__dirname, "../brand-assets/source/maple-imprint-mark.png");
const outDir = path.resolve(__dirname, "../public/logo");

async function run() {
  // Trim transparent padding from the full lockup (leaf + wordmark).
  const trimmed = sharp(markPath).trim({ threshold: 10 });
  await trimmed.clone().png().toFile(path.join(outDir, "logo-lockup.png"));

  const meta = await sharp(path.join(outDir, "logo-lockup.png")).metadata();
  console.log("Trimmed lockup size:", meta.width, meta.height);

  // Crop just the leaf glyph (left ~28% of width) for a standalone icon mark.
  const full = sharp(path.join(outDir, "logo-lockup.png"));
  const fullMeta = await full.metadata();
  const leafWidth = Math.round(fullMeta.width * 0.285);
  await sharp(path.join(outDir, "logo-lockup.png"))
    .extract({ left: 0, top: 0, width: leafWidth, height: fullMeta.height })
    .trim({ threshold: 10 })
    .png()
    .toFile(path.join(outDir, "logo-leaf.png"));

  const leafMeta = await sharp(path.join(outDir, "logo-leaf.png")).metadata();
  console.log("Leaf icon size:", leafMeta.width, leafMeta.height);

  // Square favicon-friendly icon (padded, transparent bg) at a few sizes.
  const sizes = [32, 180, 512];
  for (const size of sizes) {
    await sharp(path.join(outDir, "logo-leaf.png"))
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, `leaf-${size}.png`));
  }
  console.log("Done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
