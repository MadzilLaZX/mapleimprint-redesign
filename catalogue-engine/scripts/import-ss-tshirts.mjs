// One-off script: seeds the Category taxonomy (mirroring the frontend's PRODUCT_CATEGORIES list
// exactly, so slugs line up), imports a curated slice of real T-shirts from the live S&S API,
// and promotes each one to a real, published MasterProduct. Run with:
//   node scripts/import-ss-tshirts.mjs
// Requires DATABASE_URL and SSACTIVEWEAR_ACCOUNT_NUMBER/SSACTIVEWEAR_API_KEY in .env.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  SSActivewearConnector,
  FilteredCatalogueConnector,
  runCatalogueImport,
  promoteSupplierProductToCatalogue,
} from '../dist/index.js';

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

// Mirrors mapleimprint-redesign/src/lib/constants.ts's PRODUCT_CATEGORIES exactly — same slugs,
// same subcategory labels — so data imported here lines up with the site's existing routes
// without needing the frontend to change its category structure.
const CATEGORY_TAXONOMY = [
  {
    slug: 'custom-apparel',
    name: 'Custom Apparel',
    subcategories: ['T-shirts', 'Polos', 'Hoodies & sweatshirts', 'Jackets & outerwear', 'Youth & performance'],
  },
  {
    slug: 'workwear-uniforms',
    name: 'Workwear & Uniforms',
    subcategories: ['Business uniforms', 'Construction', 'Hospitality', 'Healthcare', 'Safety apparel'],
  },
  {
    slug: 'hats-accessories',
    name: 'Hats & Accessories',
    subcategories: ['Caps', 'Beanies & toques', 'Bags', 'Aprons'],
  },
  {
    slug: 'business-printing',
    name: 'Business Printing',
    subcategories: ['Business cards', 'Postcards', 'Brochures & flyers', 'Posters'],
  },
  {
    slug: 'signs-banners',
    name: 'Signs & Banners',
    subcategories: ['Vinyl banners', 'Indoor signs', 'Outdoor signs', 'Decals'],
  },
  {
    slug: 'stickers-labels',
    name: 'Stickers & Labels',
    subcategories: ['Die-cut', 'Kiss-cut', 'Clear', 'Sheets'],
  },
  { slug: 'drinkware', name: 'Drinkware', subcategories: ['Mugs', 'Tumblers', 'Bottles'] },
  {
    slug: 'gifts-promo',
    name: 'Gifts & Promotional Products',
    subcategories: ['Coasters', 'Magnets', 'Photo panels', 'Stationery'],
  },
];

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

async function seedCategories(prisma) {
  const bySlug = new Map();
  for (const top of CATEGORY_TAXONOMY) {
    const parent = await prisma.category.upsert({
      where: { slug: top.slug },
      update: { name: top.name },
      create: { name: top.name, slug: top.slug },
    });
    bySlug.set(top.slug, parent.id);

    for (const subName of top.subcategories) {
      const subSlug = slugify(subName);
      await prisma.category.upsert({
        where: { slug: subSlug },
        update: { name: subName, parentCategoryId: parent.id },
        create: { name: subName, slug: subSlug, parentCategoryId: parent.id },
      });
    }
  }
  return bySlug;
}

async function main() {
  const prisma = new PrismaClient();

  console.log('Seeding category taxonomy...');
  await seedCategories(prisma);
  console.log('Categories seeded.');

  const supplier = await prisma.supplier.upsert({
    where: { code: 'ss_activewear' },
    update: {},
    create: { name: 'S&S Activewear Canada', code: 'ss_activewear', integrationType: 'api' },
  });
  console.log(`Using real supplier row: ${supplier.id} (ss_activewear)`);

  const baseConnector = new SSActivewearConnector({
    accountNumber: process.env.SSACTIVEWEAR_ACCOUNT_NUMBER,
    apiKey: process.env.SSACTIVEWEAR_API_KEY,
  });
  await baseConnector.authenticate();

  const tshirtConnector = new FilteredCatalogueConnector(
    baseConnector,
    (p) => p.productType === 't_shirt',
  );

  const IMPORT_LIMIT = Number(process.env.IMPORT_LIMIT ?? 24);
  console.log(`Importing up to ${IMPORT_LIMIT} real T-shirt styles from S&S...`);
  const importResult = await runCatalogueImport({
    prisma,
    connector: tshirtConnector,
    supplierId: supplier.id,
    limit: IMPORT_LIMIT,
  });
  console.log('Import result:', JSON.stringify(importResult, null, 2));

  if (importResult.status === 'failed' || importResult.status === 'skipped_locked') {
    console.error('Import did not complete successfully — stopping before promotion.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const toPromote = await prisma.supplierProduct.findMany({
    where: { supplierId: supplier.id, masterProductId: null },
  });
  console.log(`Promoting ${toPromote.length} supplier products to the live catalogue...`);

  let promoted = 0;
  for (const sp of toPromote) {
    try {
      const result = await promoteSupplierProductToCatalogue({
        prisma,
        supplierProductId: sp.id,
        categorySlug: 't-shirts',
        productType: 't_shirt',
      });
      console.log(`  Promoted "${sp.supplierProductName}" -> MasterProduct ${result.masterProductId} (${result.variantsCreated} variants, ${result.imagesLinked} images)`);
      promoted++;
    } catch (err) {
      console.error(`  FAILED to promote "${sp.supplierProductName}": ${err.message}`);
    }
  }

  console.log(`\nDone. ${promoted}/${toPromote.length} products promoted and published.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
