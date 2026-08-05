// Seeds the Category taxonomy (mirroring the frontend's PRODUCT_CATEGORIES list exactly, so
// slugs line up), imports curated slices of real S&S products across every mapped productType
// (T-shirts, Polos, Hoodies & sweatshirts, Jackets & outerwear, Caps, Beanies & toques, Bags —
// see route-map.mjs), and promotes each new one to a real, published MasterProduct.
//
// Supersedes import-ss-tshirts.mjs (T-shirts-only) now that more categories are mapped. Run with:
//   node scripts/import-ss-catalogue.mjs
// Per-category import cap (default 20, applies separately to EACH productType, not a shared
// total) via PER_CATEGORY_LIMIT env var. Requires DATABASE_URL and
// SSACTIVEWEAR_ACCOUNT_NUMBER/SSACTIVEWEAR_API_KEY in .env.
//
// Runtime note: this is genuinely slow (~1-4 min per style depending on variant/image count — see
// catalogue-engine/PHASE_3_TSHIRTS.md's "real performance finding" section), not a hang. A run
// across 7 categories at the default 20-per-category cap can take multiple hours. Run it in the
// background and check row counts in the DB directly if you need a progress read that doesn't
// wait for a whole category to finish.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  SSActivewearConnector,
  FilteredCatalogueConnector,
  runCatalogueImport,
  promoteSupplierProductToCatalogue,
  linkSupplierProductImages,
} from '../dist/index.js';
import { MAPPED_PRODUCT_TYPES, routeFor } from './route-map.mjs';

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

// Mirrors mapleimprint-redesign/src/lib/constants.ts's PRODUCT_CATEGORIES exactly.
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
  for (const top of CATEGORY_TAXONOMY) {
    const parent = await prisma.category.upsert({
      where: { slug: top.slug },
      update: { name: top.name },
      create: { name: top.name, slug: top.slug },
    });
    for (const subName of top.subcategories) {
      const subSlug = slugify(subName);
      await prisma.category.upsert({
        where: { slug: subSlug },
        update: { name: subName, parentCategoryId: parent.id },
        create: { name: subName, slug: subSlug, parentCategoryId: parent.id },
      });
    }
  }
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

  const PER_CATEGORY_LIMIT = Number(process.env.PER_CATEGORY_LIMIT ?? 20);
  // Optional comma-separated override, e.g. PRODUCT_TYPES=polo,hoodie — lets a re-run target only
  // the categories that haven't been done yet instead of re-processing everything (re-processing
  // is harmless/idempotent, just slow — see the runtime note at the top of this file).
  const productTypes = process.env.PRODUCT_TYPES
    ? process.env.PRODUCT_TYPES.split(',').map((s) => s.trim())
    : MAPPED_PRODUCT_TYPES;

  let totalPromoted = 0;

  for (const productType of productTypes) {
    console.log(`\n=== ${productType} (up to ${PER_CATEGORY_LIMIT} styles) ===`);
    const filtered = new FilteredCatalogueConnector(baseConnector, (p) => p.productType === productType);

    const importResult = await runCatalogueImport({
      prisma,
      connector: filtered,
      supplierId: supplier.id,
      limit: PER_CATEGORY_LIMIT,
    });
    console.log(`${productType} import result:`, JSON.stringify(importResult, null, 2));

    if (importResult.status === 'failed') {
      console.error(`${productType} import failed — skipping promotion for this type, continuing to the next.`);
      continue;
    }
    if (importResult.status === 'skipped_locked') {
      console.error('Another sync job is running for this supplier — stopping the whole run.');
      break;
    }

    // Only touch the exact rows THIS import call processed (by id, from the result) — never
    // re-query "any unpromoted row for this supplier", which would wrongly sweep up a row a
    // PREVIOUS productType's promotion attempt failed on and re-promote it under this category.
    const touched = await prisma.supplierProduct.findMany({
      where: { id: { in: importResult.supplierProductIds } },
    });
    const toPromote = touched.filter((sp) => !sp.masterProductId);
    const alreadyPromoted = touched.filter((sp) => sp.masterProductId);

    console.log(`Promoting up to ${toPromote.length} ${productType} supplier products...`);
    for (const sp of toPromote) {
      const route = routeFor(productType, sp.supplierProductName);
      if (!route) continue;

      try {
        const result = await promoteSupplierProductToCatalogue({
          prisma,
          supplierProductId: sp.id,
          categorySlug: route.subcategorySlug,
          productType,
        });
        if (!result.alreadyPromoted) {
          console.log(`  Promoted "${sp.supplierProductName}" -> ${result.masterProductId} (${result.variantsCreated} variants, ${result.imagesLinked} images) [${route.subcategorySlug}]`);
          totalPromoted++;
        }
      } catch (err) {
        console.error(`  FAILED to promote "${sp.supplierProductName}": ${err.message}`);
      }
    }

    // Repair pass: products promoted before the supplierProductId image-scoping fix existed
    // never got correctly-linked images and never will on their own (promotion is a one-time,
    // idempotent no-op). Re-link now that this run has re-persisted their images with
    // supplierProductId set (see catalogue-import.ts's backfill-on-re-import step).
    if (alreadyPromoted.length > 0) {
      console.log(`Re-linking images for ${alreadyPromoted.length} already-promoted ${productType} products...`);
      for (const sp of alreadyPromoted) {
        try {
          const linked = await linkSupplierProductImages(prisma, sp.id, sp.masterProductId);
          if (linked > 0) console.log(`  Linked ${linked} images for "${sp.supplierProductName}"`);
        } catch (err) {
          console.error(`  FAILED to link images for "${sp.supplierProductName}": ${err.message}`);
        }
      }
    }
  }

  console.log(`\nDone. ${totalPromoted} new products promoted and published across all categories.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
