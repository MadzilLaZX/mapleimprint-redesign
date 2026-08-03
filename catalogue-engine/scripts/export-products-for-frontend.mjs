// Exports published MasterProducts into a static JSON file the Next.js frontend can import
// directly, with no DB client of its own — matches the documented architecture (frontend stays
// decoupled from catalogue-engine's database until Gate A is resolved; this becomes "whichever
// platform Gate A picks" for now the static-JSON approach). Re-run this any time the catalogue
// changes; the frontend picks up new data on its next build.
//
// Pricing: per-unit price at each quantity tier comes straight from the client's own print-cost
// chart (src/pricing/rules/seed-data.ts's APPAREL_PRINT_TIERS) — NOT wholesale cost + markup.
// This is a deliberate choice, not an oversight: the client confirmed a plain tee at 1-2 units is
// $20 each, exactly the chart's first-print-cost value, with no separate blank-garment charge
// added on top. See catalogue-engine README / project memory for the full reasoning.
//
// Descriptions come from raw supplier HTML — stripped to plain text here before ever reaching the
// frontend, since dangerouslySetInnerHTML on un-sanitized third-party content is a real XSS risk.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { APPAREL_PRINT_TIERS, PRINT_RULE_VERSION } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// productType -> which category/subcategory slug pair it belongs to on the frontend. Grows as
// more product types get imported; t_shirt is the only one populated today.
const PRODUCT_TYPE_ROUTES = {
  t_shirt: { categorySlug: 'custom-apparel', subcategorySlug: 't-shirts' },
};

function priceTiersFor(productType) {
  if (productType === 't_shirt') {
    return APPAREL_PRINT_TIERS.map((t) => ({
      minQty: t.quantityMin,
      maxQty: t.quantityMax,
      pricePerUnit: t.firstPrintCost,
    }));
  }
  return null; // no chart mapped for this productType yet — export with priceTiers: null, not a guess
}

async function main() {
  const prisma = new PrismaClient();

  const products = await prisma.masterProduct.findMany({
    where: { status: 'published', isPublished: true },
    include: {
      brand: true,
      primaryCategory: true,
      variants: { where: { status: 'active' } },
      images: { where: { status: 'published' }, orderBy: { sortOrder: 'asc' } },
    },
  });

  const exported = [];
  for (const p of products) {
    const route = PRODUCT_TYPE_ROUTES[p.productType];
    if (!route) {
      console.warn(`Skipping "${p.name}" — no frontend route mapped for productType "${p.productType}"`);
      continue;
    }

    const colours = [...new Set(p.variants.map((v) => v.colourName))];
    const sizes = [...new Set(p.variants.map((v) => v.size))].sort((a, b) => {
      const va = p.variants.find((v) => v.size === a)?.sizeSortOrder ?? 99;
      const vb = p.variants.find((v) => v.size === b)?.sizeSortOrder ?? 99;
      return va - vb;
    });

    const priceTiers = priceTiersFor(p.productType);

    // Prefer real product photos over colour-swatch thumbnails as the lead image — swatches are
    // tiny colour chips, not product shots, and were ending up first purely by DB insertion order.
    const imageTypeRank = { front: 0, back: 1, side: 2, primary: 0 };
    const sortedImages = [...p.images].sort(
      (a, b) => (imageTypeRank[a.imageType] ?? 9) - (imageTypeRank[b.imageType] ?? 9),
    );

    exported.push({
      slug: p.slug,
      name: p.name,
      brandName: p.brand.name,
      categorySlug: route.categorySlug,
      subcategorySlug: route.subcategorySlug,
      description: stripHtml(p.fullDescription),
      images: sortedImages.map((img) => ({
        url: img.sourceUrl,
        colourName: img.colourName,
        imageType: img.imageType,
      })),
      colours,
      sizes,
      variants: p.variants.map((v) => ({ colourName: v.colourName, size: v.size })),
      priceTiers,
      startingPrice: priceTiers ? priceTiers[0].pricePerUnit : null,
      printRuleVersion: PRINT_RULE_VERSION,
    });
  }

  const outDir = resolve(here, '..', '..', 'src', 'lib', 'generated');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'products.json');
  writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf-8');

  console.log(`Exported ${exported.length} products to ${outPath}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
