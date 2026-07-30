const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC_ROOT = "C:/Reverie/MapleImprint/Mapleimprint LTD/Mapleimprint LTD";

const productMap = {
  "Custom Apparel.png": "custom-apparel",
  "Workwear & Uniforms.png": "workwear-uniforms",
  "Hats & Accessories.png": "hats-accessories",
  "Business Printing.png": "business-printing",
  "Signs & Banners.png": "signs-banners",
  "Stickers & Labels.png": "stickers-labels",
  "Drinkware.png": "drinkware",
  "Gifts & Promotional Products.png": "gifts-promo",
};

const popularMap = {
  "Staff Polos.png": "staff-polos",
  "Custom Hoodies.png": "custom-hoodies",
  "Event Banners.png": "event-banners",
  "Business Cards.png": "business-cards",
};

async function processSet(subdir, map, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, slug] of Object.entries(map)) {
    const src = path.join(SRC_ROOT, subdir, file);
    const out = path.join(outDir, `${slug}.jpg`);
    const beforeMeta = await sharp(src).metadata();
    await sharp(src)
      .resize({ width: Math.min(1920, beforeMeta.width), withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(out);
    const stat = fs.statSync(out);
    console.log(`${slug}: ${beforeMeta.width}x${beforeMeta.height} -> ${(stat.size / 1024).toFixed(0)}KB`);
  }
}

async function run() {
  await processSet("Products", productMap, path.resolve(__dirname, "../public/images/products"));
  await processSet(
    "Popular right now section",
    popularMap,
    path.resolve(__dirname, "../public/images/popular"),
  );
  console.log("Done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
