// Fetches garment-measurement specs for every published product from suppliers whose connector
// supports it (fetchSpecs is optional on SupplierConnector — see contract.ts), normalizes them via
// src/sync/normalizeSpecs.ts, and upserts into SupplierProductSpec. Meant to run periodically as
// part of supplier sync, NOT on-demand when a customer opens a size chart (see PROJECT_NOTES.md's
// "S&S API safety" note — this respects the same 60 req/min throttle the connector already
// enforces internally, batched by style like every other S&S call).
//
// NOT YET RUN AGAINST THE LIVE API — the /v2/specs/ endpoint's real field vocabulary
// (`specName`/`value` strings) is unconfirmed; run this once with real credentials, inspect the
// `unmapped specName values seen` log line it prints, and extend normalizeSpecs.ts's pattern list
// to cover whatever S&S actually sends before trusting the Size Guide's structured display.
//
// Usage: node scripts/sync-specs.mjs [--limit=N]
// Requires DATABASE_URL and SSACTIVEWEAR_ACCOUNT_NUMBER/SSACTIVEWEAR_API_KEY in .env.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { SSActivewearConnector } from '../dist/index.js';
import { normalizeSpecName, parseSpecValue } from '../dist/sync/normalizeSpecs.js';

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

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : undefined;

async function main() {
  const prisma = new PrismaClient();

  const supplier = await prisma.supplier.findUnique({ where: { code: 'ss_activewear' } });
  if (!supplier) {
    console.error('No ss_activewear Supplier row found — run the main catalogue sync first.');
    process.exit(1);
  }

  const connector = new SSActivewearConnector({
    accountNumber: process.env.SSACTIVEWEAR_ACCOUNT_NUMBER,
    apiKey: process.env.SSACTIVEWEAR_API_KEY,
  });
  if (typeof connector.fetchSpecs !== 'function') {
    console.error('SSActivewearConnector does not implement fetchSpecs — nothing to sync.');
    process.exit(1);
  }

  // One styleID per distinct supplier style backing a published MasterProduct, not one row per
  // SKU/variant — specs are per-style-per-size, not per-colour, so fetching once per style covers
  // every colour variant of that style.
  const supplierProducts = await prisma.supplierProduct.findMany({
    where: { supplierId: supplier.id, masterProductId: { not: null } },
    select: { supplierStyleCode: true, masterProductId: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  const styleIdToMasterProductId = new Map(supplierProducts.map((p) => [p.supplierStyleCode, p.masterProductId]));
  const styleIds = [...styleIdToMasterProductId.keys()];
  console.log(`Fetching specs for ${styleIds.length} styles...`);

  const rawSpecs = await connector.fetchSpecs(styleIds);
  console.log(`Received ${rawSpecs.length} raw spec rows.`);

  const unmappedSpecNames = new Set();
  let written = 0;

  for (const raw of rawSpecs) {
    const normalizedSpecType = normalizeSpecName(raw.specName);
    if (!normalizedSpecType) unmappedSpecNames.add(raw.specName);

    const parsed = parseSpecValue(raw.value);

    await prisma.supplierProductSpec.upsert({
      where: {
        supplierId_supplierStyleId_sizeName_specName: {
          supplierId: supplier.id,
          supplierStyleId: raw.supplierStyleId,
          sizeName: raw.sizeName,
          specName: raw.specName,
        },
      },
      create: {
        supplierId: supplier.id,
        supplierStyleId: raw.supplierStyleId,
        masterProductId: styleIdToMasterProductId.get(raw.supplierStyleId) ?? null,
        sizeName: raw.sizeName,
        sizeOrder: raw.sizeOrder ?? null,
        specName: raw.specName,
        normalizedSpecType,
        value: parsed ? String(parsed.value) : raw.value,
        unit: parsed?.unit ?? null,
        rawValue: raw.value,
      },
      update: {
        normalizedSpecType,
        value: parsed ? String(parsed.value) : raw.value,
        unit: parsed?.unit ?? null,
        rawValue: raw.value,
        syncedAt: new Date(),
      },
    });
    written++;
  }

  console.log(`Wrote ${written} spec rows.`);
  if (unmappedSpecNames.size > 0) {
    console.log(`Unmapped specName values seen (extend normalizeSpecs.ts's SPEC_TYPE_PATTERNS for these):`);
    console.log([...unmappedSpecNames].join(', '));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Spec sync failed:', err);
  // Deliberately does NOT touch any existing SupplierProductSpec rows on failure — a failed sync
  // leaves the previous valid data in place rather than clearing it, per the brief's "if a spec
  // sync fails, do not break the product page; use the previous valid data" requirement.
  process.exit(1);
});
