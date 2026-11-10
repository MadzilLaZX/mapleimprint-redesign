// PREPARED, NOT EXECUTED. Requires explicit approval + a real DATABASE_URL to run -- this script
// does not run automatically, is not called by anything, and was not executed this session.
//
// Transitions 13 orphaned MasterProduct records from 'published' to 'hidden' (never 'discontinued'
// or 'blocked' -- see catalogue-engine/src/catalogue/curation.ts's own transition table and
// comments: 'hidden' is the correct, REVERSIBLE state for "real but not currently shown"; a
// mistaken hide can always be undone via transitionProductStatus(prisma, id, 'published') again,
// since hidden -> published is itself a valid transition).
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
// This does NOT delete or merge anything -- the row, its ProductImage rows, and its
// ProductVariant rows all remain in the database, simply no longer published/orderable. Reversing
// this is a one-line change (swap 'hidden' for 'published' below) if any of these turn out to be
// wanted after all.

import { PrismaClient } from '@prisma/client';
import { transitionProductStatus } from '../dist/index.js'; // run `npm run build` first if this is missing

const ORPHAN_MASTER_PRODUCT_IDS = [
  'cmtum8e1i00hqg5v43c629ic3', // berne-apparel-icecap-insulated-bib-overall-tall-sizes
  'cmtum838300hkg5v43ljhsoo3', // berne-apparel-men-s-heritage-tall-duck-insulated-coverall
  'cmtum7nip00hbg5v4v3a283u9', // berne-apparel-tall-acre-unlined-washed-bib-overall
  'cmtum8o2g002og5i0s5wr8nz8', // c2-sport-men-s-mesh-7-shorts
  'cmtum8tqp002rg5i052w4khog', // c2-sport-men-s-mesh-9-shorts
  'cmtum9ezw0033g5i0d7gxioan', // champion-unisex-9-mesh-shorts-with-pockets
  'cmtum9490002xg5i01rkyizkc', // champion-unisex-powerblend-open-bottom-sweatpants-with-pockets
  'cmtum9q3z0039g5i02sd7fm3g', // gildan-unisex-heavy-blend-pocket-sweatpants
  'cmtumaf08003lg5i0zenz3ti2', // gildan-unisex-softstyle-midweight-pocket-sweatpants
  'cmtuma49x003fg5i0uvndsc18', // gildan-youth-heavy-blend-sweatpants
  'cmtumbc4d0046g5i0n0btltir', // next-level-unisex-fleece-sweat-shorts
  'cmtumbspy00iqg5v4k8et83ns', // team-365-women-s-zone-performance-shorts
  'cmtumcd6u00j2g5v4w75fa7g4', // under-armour-youth-tech-vent-athletic-shorts
];

async function main() {
  if (process.argv[2] !== '--confirm') {
    console.log(`Dry run only. ${ORPHAN_MASTER_PRODUCT_IDS.length} products would be set to 'hidden'.`);
    console.log('Re-run with --confirm to actually apply (requires DATABASE_URL and explicit approval).');
    return;
  }
  const prisma = new PrismaClient();
  for (const id of ORPHAN_MASTER_PRODUCT_IDS) {
    const result = await transitionProductStatus(prisma, id, 'hidden');
    console.log(result.success ? `hidden: ${id}` : `SKIPPED (${result.reason}): ${id}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Unpublish script failed:', err);
  process.exit(1);
});
