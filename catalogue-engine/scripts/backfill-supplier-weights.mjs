// PREPARED, NOT EXECUTED. Requires migration 008 to be applied first (adds the columns this
// writes to), a real DATABASE_URL, and explicit approval -- this script does not run
// automatically and was not executed this session.
//
// Populates SupplierProduct.unitWeightLb/caseWeightLb/caseQty/caseLengthIn/caseWidthIn/
// caseHeightIn/weightConfidence/dimensionsConfidence from the already-ingested rawPayload data
// every SupplierProduct row already has, using buildWeightBackfillRows() (tested against
// representative fixtures including the full 671+1102 scale -- see
// catalogue-engine/test/build-weight-backfill-rows.test.ts). Never invents a value: a product
// with nothing extractable from rawPayload is simply skipped, left exactly as before (every new
// column stays null), not defaulted to zero or any guessed number.
//
// REVERSIBLE: this only ever writes to the 8 new nullable columns migration 008 added -- no
// other column on SupplierProduct (or any other table) is touched. To undo entirely:
//   update "SupplierProduct" set "unitWeightLb" = null, "caseWeightLb" = null, "caseQty" = null,
//     "caseLengthIn" = null, "caseWidthIn" = null, "caseHeightIn" = null,
//     "weightConfidence" = null, "dimensionsConfidence" = null;
// (or just re-run migration 008's DROP COLUMN variant, which removes the columns entirely).
//
// Batched (BATCH_SIZE rows per UPDATE round-trip) rather than one UPDATE per row or one giant
// UPDATE for the whole table, matching this package's existing fetchAllPublishedProducts()
// cursor-pagination convention (export-products-for-frontend.mjs) for the same reason: bounded
// query size regardless of how large the catalogue grows.
//
// IDEMPOTENT: every field is re-derived from rawPayload (which this script never modifies) and
// SET to that computed value, never incremented/appended/merged -- running this script twice in
// a row recomputes and writes the exact same values both times (buildWeightBackfillRows() itself
// is a pure function with an explicit idempotency test -- see build-weight-backfill-rows.test.ts).
// A product with no extractable data is skipped on every run, not defaulted, so re-running never
// changes which products have data vs. remain null.
//
// UNTOUCHED BY DESIGN: the Prisma `update` below names exactly the 8 new columns and nothing
// else -- it cannot touch wholesaleCost, isOrderable, matchStatus, supplierSku, or any other
// pricing/inventory/mapping field on SupplierProduct, and never references MasterProduct,
// ProductVariant, SupplierVariantOffer, or any other table at all.

import { PrismaClient } from '@prisma/client';
import { buildWeightBackfillRows } from '../dist/index.js'; // run `npm run build` first if this is missing

const BATCH_SIZE = 200;

async function fetchAllSupplierProducts(prisma) {
  const products = [];
  let cursor;
  for (;;) {
    const page = await prisma.supplierProduct.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, rawPayload: true, supplier: { select: { name: true } } },
    });
    products.push(...page);
    if (page.length < BATCH_SIZE) break;
    cursor = page[page.length - 1].id;
  }
  return products;
}

function supplierCodeFor(supplierName) {
  if (supplierName === 'SanMar Canada') return 'sanmar';
  if (supplierName === 'S&S Activewear Canada') return 'ssactivewear';
  return null; // any other/future supplier: skip rather than guess at its rawPayload shape
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const supplierProducts = await fetchAllSupplierProducts(prisma);
  const forBackfill = supplierProducts
    .map((sp) => ({ supplierProductId: sp.id, supplierCode: supplierCodeFor(sp.supplier?.name), rawPayload: sp.rawPayload }))
    .filter((sp) => sp.supplierCode !== null);

  const rows = buildWeightBackfillRows(forBackfill);
  console.log(`${supplierProducts.length} supplier products scanned, ${rows.length} have extractable weight/dimension data.`);

  if (!confirm) {
    console.log('Dry run only -- no rows written. Re-run with --confirm to apply (requires migration 008 already applied).');
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((row) =>
        prisma.supplierProduct.update({
          where: { id: row.supplierProductId },
          data: {
            unitWeightLb: row.unitWeightLb,
            caseWeightLb: row.caseWeightLb,
            caseQty: row.caseQty,
            caseLengthIn: row.caseLengthIn,
            caseWidthIn: row.caseWidthIn,
            caseHeightIn: row.caseHeightIn,
            weightConfidence: row.weightConfidence,
            dimensionsConfidence: row.dimensionsConfidence,
          },
        }),
      ),
    );
    written += batch.length;
    console.log(`  ${written}/${rows.length} written`);
  }

  console.log(`Backfill complete: ${written} SupplierProduct rows updated.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
