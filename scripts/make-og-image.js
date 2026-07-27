const sharp = require("sharp");
const path = require("path");

async function run() {
  const width = 1200;
  const height = 630;
  const logo = await sharp(path.resolve(__dirname, "../public/logo/logo-lockup.png"))
    .resize({ width: 820 })
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const bg = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 9, g: 9, b: 9, alpha: 1 },
    },
  });

  const glowSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="70%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#FF6A00" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#FF6A00" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
    </svg>
  `);

  const left = Math.round((width - logoMeta.width) / 2);
  const top = Math.round((height - logoMeta.height) / 2);

  await bg
    .composite([
      { input: glowSvg, top: 0, left: 0 },
      { input: logo, left, top },
    ])
    .png()
    .toFile(path.resolve(__dirname, "../public/og-image.png"));

  console.log("OG image written");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
