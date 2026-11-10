// Pure data + plan logic for unpublish-orphaned-duplicates.mjs, split out so it's importable and
// testable without pulling in Prisma or touching any database. See that script for the full
// rationale (investigated 2026-11-11): each of these 13 MasterProduct ids has zero SupplierProduct
// linkage, a "-2"-suffixed sibling created seconds later in the same import run that DOES have
// real supplier backing, and zero references from any order/quote/saved design.

export const ORPHAN_MASTER_PRODUCT_IDS = Object.freeze([
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
]);

export const UNPUBLISH_TARGET_STATUS = 'hidden'; // never 'discontinued'/'blocked' -- see script header

/** Pure plan summary -- no DB access, safe to call from a test or a dry-run CLI alike. */
export function planUnpublish() {
  const ids = [...new Set(ORPHAN_MASTER_PRODUCT_IDS)]; // de-duplicate defensively, even though the source list has none
  return {
    count: ids.length,
    ids,
    targetStatus: UNPUBLISH_TARGET_STATUS,
  };
}
