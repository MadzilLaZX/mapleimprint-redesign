// ONE-OFF backfill, not part of the regular pipeline. SanMarConnector.ts previously stored
// productName raw (with HTML entities like "&reg;"/"&trade;" undecoded) for every SanMar product
// imported before the 2026-09-12 fix (commit 0c043c6). That fix only changes what NEW imports
// write — it does nothing for the 548 SanMar products already sitting in the database with
// entity-encoded names. This script re-applies the same decode to the names already there, for
// both SupplierProduct.supplierProductName and the promoted MasterProduct.name, scoped to
// supplier code 'sanmar' only (S&S/other suppliers were never affected by this bug).
//
// Safe to re-run: decoding an already-clean string is a no-op (no "&" sequences left to match).
//
// Run with: node scripts/backfill-sanmar-entity-names.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

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

// Mirrors SanMarConnector.ts's cleanDescription() entity handling exactly, so a name that goes
// through both paths (raw import vs. this backfill) ends up identical.
function decodeEntities(text) {
  if (!text) return text;
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const prisma = new PrismaClient();

  const supplierProducts = await prisma.supplierProduct.findMany({
    where: { supplier: { code: 'sanmar' } },
    select: { id: true, supplierProductName: true, masterProductId: true },
  });

  let spUpdated = 0;
  let mpUpdated = 0;

  for (const sp of supplierProducts) {
    const decoded = decodeEntities(sp.supplierProductName);
    if (decoded !== sp.supplierProductName) {
      await prisma.supplierProduct.update({
        where: { id: sp.id },
        data: { supplierProductName: decoded },
      });
      spUpdated++;
    }

    if (sp.masterProductId) {
      const mp = await prisma.masterProduct.findUnique({
        where: { id: sp.masterProductId },
        select: { id: true, name: true },
      });
      if (mp) {
        const mpDecoded = decodeEntities(mp.name);
        if (mpDecoded !== mp.name) {
          await prisma.masterProduct.update({
            where: { id: mp.id },
            data: { name: mpDecoded },
          });
          mpUpdated++;
        }
      }
    }
  }

  console.log(`SupplierProduct.supplierProductName updated: ${spUpdated} / ${supplierProducts.length}`);
  console.log(`MasterProduct.name updated: ${mpUpdated}`);
  console.log('\nRe-run scripts/export-products-for-frontend.mjs to pick these up in the frontend JSON.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('backfill-sanmar-entity-names failed:', err?.message ?? err);
  process.exit(1);
});
