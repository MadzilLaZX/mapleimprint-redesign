const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC_ROOT = "C:/Reverie/MapleImprint/Mapleimprint LTD/Mapleimprint LTD/Products";

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const folders = {
  "Custom Apparel": "custom-apparel",
  "Business Printing": "business-printing",
  Drinkware: "drinkware",
  "Gifts & Promotional Products": "gifts-promo",
  "Hats & Accessories": "hats-accessories",
  "Signs & banners": "signs-banners",
  "Stickers & Labels": "stickers-labels",
  "Workwear & Uniforms": "workwear-uniforms",
};

async function run() {
  for (const [folder, catSlug] of Object.entries(folders)) {
    const srcDir = path.join(SRC_ROOT, folder);
    const outDir = path.resolve(__dirname, `../public/images/products/subcategories/${catSlug}`);
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".png"));
    for (const file of files) {
      const subSlug = slugify(path.basename(file, path.extname(file)));
      const src = path.join(srcDir, file);
      const out = path.join(outDir, `${subSlug}.jpg`);
      const meta = await sharp(src).metadata();
      await sharp(src)
        .resize({ width: Math.min(800, meta.width) })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(out);
      const stat = fs.statSync(out);
      console.log(`${catSlug}/${subSlug}: ${(stat.size / 1024).toFixed(0)}KB`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
