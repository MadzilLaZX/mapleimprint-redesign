const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC_ROOT = "C:/Reverie/MapleImprint/Mapleimprint LTD/Mapleimprint LTD";

const solutionsMap = {
  "For Business.png": "businesses",
  "Teams & Schools.png": "teams-schools",
  "Events & Fundraisers.png": "events-fundraisers",
  "Creators & Clothing Brands.png": "creators-clothing-brands",
  "Corporate merchandise.png": "corporate-merchandise",
  "Bulk Orders.png": "bulk-orders",
};

async function run() {
  const outDir = path.resolve(__dirname, "../public/images/solutions");
  fs.mkdirSync(outDir, { recursive: true });

  for (const [file, slug] of Object.entries(solutionsMap)) {
    const src = path.join(SRC_ROOT, "Solutions", file);
    const out = path.join(outDir, `${slug}.jpg`);
    const meta = await sharp(src).metadata();
    await sharp(src)
      .resize({ width: Math.min(1600, meta.width), withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(out);
    const stat = fs.statSync(out);
    console.log(`${slug}: ${meta.width}x${meta.height} -> ${(stat.size / 1024).toFixed(0)}KB`);
  }

  // About page photo (separate source location, top-level file).
  const aboutSrc = path.join(SRC_ROOT, "About.png");
  const aboutOut = path.resolve(__dirname, "../public/images/about.jpg");
  const aboutMeta = await sharp(aboutSrc).metadata();
  await sharp(aboutSrc)
    .resize({ width: Math.min(1600, aboutMeta.width), withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(aboutOut);
  console.log("about:", (fs.statSync(aboutOut).size / 1024).toFixed(0) + "KB");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
