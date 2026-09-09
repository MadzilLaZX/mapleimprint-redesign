// SMALL, CAPPED TEST import for SanMar Canada, closely modeled on import-ss-catalogue.mjs, but
// this is deliberately NOT a full production run — see HARD_CAP below. Its purpose is to prove
// SanMarConnector works end-to-end against the live DB with real data, so a human can review
// results before scaling up.
//
// Unlike S&S's per-category cap, this uses one ABSOLUTE total cap across all productTypes
// combined (SanMar's bulk data has no category field to split runCatalogueImport's `limit` by —
// see SanMarConnector.ts's resolveProductType() heuristic comment). The cap is enforced on
// IMPORT itself (runCatalogueImport's own `limit` option), not just on promotion — a full,
// uncapped import would DB-write (SupplierProduct + variant offers + inventory + images) for
// EVERY SanMar style in the bulk pull, which is explicitly not what this test run is for.
//
// Full-catalogue classification stats (total styles, classified vs unclassified) are gathered
// separately via a read-only pass over connector.fetchProductCatalogue() BEFORE the capped
// import runs — this is free, since SanMarConnector caches the underlying bulk data in memory
// for the life of the connector instance (see loadBulkData()), so it does not trigger a second
// live/rate-limited call.
//
// Run with: node scripts/import-sanmar-catalogue.mjs
// Requires DATABASE_URL and SANMAR_CUSTOMER_ID/SANMAR_EDI_EMAIL in .env.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  SanMarConnector,
  runCatalogueImport,
  promoteSupplierProductToCatalogue,
} from '../dist/index.js';
import { routeFor } from './route-map.mjs';

const HARD_CAP = 15; // ABSOLUTE total products imported+promoted for this test run — not per category.

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

async function main() {
  const prisma = new PrismaClient();

  // A Supplier row with code 'sanmar' already exists in the DB (checked before writing this
  // script) — upsert is still used so this script is idempotent/safe if run against a fresh DB.
  const supplier = await prisma.supplier.upsert({
    where: { code: 'sanmar' },
    update: {},
    create: { name: 'SanMar Canada', code: 'sanmar', integrationType: 'api' },
  });
  console.log(`Using real supplier row: ${supplier.id} (sanmar)`);

  const connector = new SanMarConnector({
    customerId: process.env.SANMAR_CUSTOMER_ID,
    ediEmail: process.env.SANMAR_EDI_EMAIL,
  });
  await connector.authenticate();
  console.log('SanMar SOAP client authenticated (WSDL reachable).');

  // --- Read-only stats pass over the FULL bulk pull, before the capped import runs. ---
  console.log('\nFetching full SanMar bulk data for classification stats (this is the one live, rate-limited getBulkData call for today, unless already cached on disk for this calendar date)...');
  const productTypeByStyle = new Map();
  let totalStyles = 0;
  let totalUnclassified = 0;
  for await (const raw of connector.fetchProductCatalogue()) {
    totalStyles++;
    productTypeByStyle.set(raw.supplierStyleCode, { productType: raw.productType, productName: raw.productName });
    if (!raw.productType) totalUnclassified++;
  }
  console.log(`Full bulk data: ${totalStyles} distinct styles, ${totalStyles - totalUnclassified} classified, ${totalUnclassified} unclassified.`);

  // --- Capped import: writes DB rows for at most HARD_CAP styles. ---
  console.log(`\nRunning capped import (limit=${HARD_CAP})...`);
  const importResult = await runCatalogueImport({
    prisma,
    connector,
    supplierId: supplier.id,
    limit: HARD_CAP,
  });
  console.log('\nImport result:', JSON.stringify(importResult, null, 2));

  if (importResult.status === 'failed') {
    console.error('\nImport FAILED — no promotion attempted.');
    await prisma.$disconnect();
    process.exit(1);
  }
  if (importResult.status === 'skipped_locked') {
    console.error('\nAnother sync job is already running for this supplier — nothing to promote.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const touched = await prisma.supplierProduct.findMany({
    where: { id: { in: importResult.supplierProductIds } },
  });
  const toPromote = touched.filter((sp) => !sp.masterProductId);
  const alreadyPromoted = touched.filter((sp) => sp.masterProductId);

  let promotedCount = 0;
  let failedCount = 0;
  let skippedUnroutedCount = 0;
  let skippedUnclassifiedCount = 0;
  const classifiedCounts = new Map();

  console.log(`\n=== Promoting ${toPromote.length} imported SanMar products (already capped at ${HARD_CAP} by import step) ===`);
  for (const sp of toPromote) {
    const info = productTypeByStyle.get(sp.supplierStyleCode);
    const productType = info?.productType;

    if (!productType) {
      skippedUnclassifiedCount++;
      console.log(`  UNCLASSIFIED: "${sp.supplierProductName}" (style ${sp.supplierStyleCode}) — no productType keyword match, not promoted.`);
      continue;
    }
    classifiedCounts.set(productType, (classifiedCounts.get(productType) ?? 0) + 1);

    const route = routeFor(productType, sp.supplierProductName);
    if (!route) {
      skippedUnroutedCount++;
      console.log(`  SKIPPED (no route for productType "${productType}"): "${sp.supplierProductName}"`);
      continue;
    }

    try {
      const result = await promoteSupplierProductToCatalogue({
        prisma,
        supplierProductId: sp.id,
        categorySlug: route.subcategorySlug,
        productType,
      });
      if (!result.alreadyPromoted) {
        console.log(`  PROMOTED [${productType}]: "${sp.supplierProductName}" -> ${result.masterProductId} (${result.variantsCreated} variants, ${result.imagesLinked} images) [${route.subcategorySlug}]`);
        promotedCount++;
      } else {
        console.log(`  ALREADY PROMOTED [${productType}]: "${sp.supplierProductName}" -> ${result.masterProductId}`);
      }
    } catch (err) {
      failedCount++;
      console.error(`  FAILED to promote "${sp.supplierProductName}" [${productType}]: ${err.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total distinct SanMar styles in today's full bulk data: ${totalStyles}`);
  console.log(`  Classified: ${totalStyles - totalUnclassified}`);
  console.log(`  Unclassified: ${totalUnclassified}`);
  console.log(`Imported this run (capped at HARD_CAP=${HARD_CAP}): ${importResult.supplierProductsProcessed} styles considered (${importResult.supplierProductsCreated} new, ${importResult.supplierProductsUpdated} updated)`);
  console.log(`Skipped/not reached because of the ${HARD_CAP}-item cap: ${Math.max(0, totalStyles - importResult.supplierProductsProcessed)}`);
  console.log(`Already promoted before this run: ${alreadyPromoted.length}`);
  console.log(`Considered for promotion this run: ${toPromote.length}`);
  console.log(`  Unclassified (skipped, not promoted): ${skippedUnclassifiedCount}`);
  console.log(`  Classified but no route mapping (skipped): ${skippedUnroutedCount}`);
  console.log(`  Classification breakdown among products considered:`);
  for (const [pt, count] of classifiedCounts) console.log(`    ${pt}: ${count}`);
  console.log(`Successfully promoted to live catalogue: ${promotedCount}`);
  console.log(`Promotion failures: ${failedCount}`);
  if (importResult.itemErrors.length > 0) {
    console.log(`Item-level errors during import (${importResult.itemErrors.length}):`);
    for (const e of importResult.itemErrors.slice(0, 20)) console.log(`  - ${e}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
