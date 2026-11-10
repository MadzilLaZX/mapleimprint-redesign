// PREPARED, NOT EXECUTED. Requires explicit approval + a real DATABASE_URL to run -- this script
// does not run automatically, is not called by anything, and was not executed this session.
//
// Transitions 13 orphaned MasterProduct records from 'published' to 'hidden' (never 'discontinued'
// or 'blocked' -- see catalogue-engine/src/catalogue/curation.ts's own transition table and
// comments: 'hidden' is the correct, REVERSIBLE state for "real but not currently shown"; a
// mistaken hide can always be undone via transitionProductStatus(prisma, id, 'published') again,
// since hidden -> published is itself a valid transition -- confirmed by this package's own
// catalogue-curation.test.ts).
//
// WHY these 13 specifically (investigated 2026-11-11, not guessed):
//   - Each has ZERO SupplierProduct rows linked to it at all (confirmed live) -- no real supplier
//     backing, no price, no inventory sync. Already safely exports as quote-required
//     (startingPrice: null) via the existing cheapestOrderableOffer() safeguard -- not an active
//     purchase-risk bug, but genuine catalogue clutter.
//   - Each has a "-2"-suffixed sibling with an identical name, created literally seconds later in
//     the same 2026-09-09 21:33-21:36 import run, which DOES have a real, properly-linked
//     SupplierProduct -- several of those siblings carry a dedup matchConfidence of 0.6-0.68
//     (SupplierProduct.matchConfidence), confirming the import's own dedup matcher flagged these
//     as likely-the-same-product pairs without auto-merging them.
//   - Confirmed zero references anywhere: no DesignProject.productSlug, QuoteRequestLine.productSlug,
//     or MapleOrderLine match any of these 13 slugs. Unpublishing cannot orphan a real customer's
//     saved design, quote, or order.
//
// This does NOT delete or merge anything, and does not touch pricing, inventory, or any
// SupplierProduct/SupplierVariantOffer mapping -- the row, its ProductImage rows, and its
// ProductVariant rows all remain in the database, simply no longer published/orderable.
//
// IDEMPOTENT: transitionProductStatus() only transitions a product currently in a state that
// legally allows 'hidden' (i.e. 'published' or 'approved' -- see PRODUCT_STATUS_TRANSITIONS).
// Running this script twice in a row is safe: the second run finds every target already 'hidden',
// isValidTransition('hidden','hidden') is false by design (see curation.ts), and
// transitionProductStatus() returns success:false with a clear reason instead of erroring or
// double-applying anything -- confirmed by the "never allows a same-status transition" test in
// catalogue-curation.test.ts, not a new assumption made here.

import { PrismaClient } from '@prisma/client';
import { transitionProductStatus } from '../dist/index.js'; // run `npm run build` first if this is missing
import { planUnpublish } from './orphanedDuplicatesPlan.mjs';

async function main() {
  const plan = planUnpublish();

  if (process.argv[2] !== '--confirm') {
    console.log(`Dry run only. ${plan.count} products would be set to '${plan.targetStatus}'.`);
    console.log('Re-run with --confirm to actually apply (requires DATABASE_URL and explicit approval).');
    return;
  }

  const prisma = new PrismaClient();
  for (const id of plan.ids) {
    const result = await transitionProductStatus(prisma, id, plan.targetStatus);
    console.log(result.success ? `${plan.targetStatus}: ${id}` : `SKIPPED (${result.reason}): ${id}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Unpublish script failed:', err);
  process.exit(1);
});
