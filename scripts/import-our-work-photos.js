const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC_ROOT = "C:/Reverie/MapleImprint/Mapleimprint LTD/Mapleimprint LTD/Our Work";

const map = {
  "3.png": "premium-metal-card",
  "4.png": "tumbler-cap-box",
  "5.png": "catalogue-laser-spread",
  "6.png": "cutting-board-trophy",
  "7.png": "bottle-notebook-pen",
  "8.png": "hoodie-flatlay",
  "9.png": "mug-plaque-array",
  "10.png": "hoodie-tote-cap-mug",
  "11.png": "laser-engraving-action",
  "12.png": "printer-apparel-catalogue",
};

async function run() {
  const outDir = path.resolve(__dirname, "../public/images/our-work");
  fs.mkdirSync(outDir, { recursive: true });

  for (const [file, slug] of Object.entries(map)) {
    const src = path.join(SRC_ROOT, file);
    const out = path.join(outDir, `${slug}.jpg`);
    const meta = await sharp(src).metadata();
    await sharp(src)
      .resize({ width: Math.min(900, meta.width) })
      .jpeg({ quality: 87, mozjpeg: true })
      .toFile(out);
    const outMeta = await sharp(out).metadata();
    const h700 = Math.round((700 * outMeta.height) / outMeta.width);
    console.log(`${slug}: ${outMeta.width}x${outMeta.height} -> h@700w=${h700}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
