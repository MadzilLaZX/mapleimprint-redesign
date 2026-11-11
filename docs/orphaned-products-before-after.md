# Orphaned products: before/after report

**EXECUTED 2026-11-11, following your approval.** A final reference check was re-run immediately
before the write (same three checks as below: `DesignProject.productSlug`,
`QuoteRequestLine.productSlug`, `MapleOrderLine` via both `designSnapshot->>'productSlug'` and a
`cartItemId ILIKE` match) -- all zero, no drift from the investigation below. All 13 were
confirmed still `status='published', isPublished=true` immediately before the write (no one had
changed in the interim).

Executed via a direct SQL `UPDATE ... WHERE id IN (<the exact 13 ids>) AND status='published' AND
"isPublished"=true` against the live `maple-imprint-catalogue` Supabase project (not the
`unpublish-orphaned-duplicates.mjs`/Prisma path below, which needs a `DATABASE_URL` this
engagement has never had -- same reasoning as the REST-based `products.json` regeneration: an
already-authorized connection, never `DATABASE_URL`). The `WHERE id IN (...)` clause makes it
structurally impossible for the statement to have touched any row outside the 13 approved ids --
confirmed afterward too: exactly 13 rows returned from the `UPDATE ... RETURNING` clause, all 13
now `status='hidden', isPublished=false`, `ProductVariant`/`ProductImage` row counts for these 13
unchanged (207 and 95 respectively, confirmed via a separate count query), and zero other rows in
the entire table carry this change (one unrelated, pre-existing hidden product elsewhere in the
catalog was found by a broader sanity check, but it predates this operation and was never part of
the 13 targets).

## Why these 13

Each has zero `SupplierProduct` rows linked to it (no real supplier backing, no price, no
inventory sync) and a "-2"-suffixed sibling created seconds later in the same 2026-09-09 import
run that IS properly linked to a real supplier product. Several siblings carry a dedup
`matchConfidence` of 0.6-0.68, confirming the import's own matcher flagged them as
likely-duplicates without auto-merging. Zero references anywhere -- no saved design, quote, or
order touches any of these 13 slugs (re-confirmed fresh, not relying on an earlier-round check).

## Before (current live state, all 13)

| Slug | status | isPublished | Variants | Images | Supplier products |
|---|---|---|---|---|---|
| berne-apparel-icecap-insulated-bib-overall-tall-sizes | published | true | 4 | 1 | 0 |
| berne-apparel-men-s-heritage-tall-duck-insulated-coverall | published | true | 12 | 2 | 0 |
| berne-apparel-tall-acre-unlined-washed-bib-overall | published | true | 14 | 2 | 0 |
| c2-sport-men-s-mesh-7-shorts | published | true | 7 | 3 | 0 |
| c2-sport-men-s-mesh-9-shorts | published | true | 7 | 3 | 0 |
| champion-unisex-9-mesh-shorts-with-pockets | published | true | 10 | 6 | 0 |
| champion-unisex-powerblend-open-bottom-sweatpants-with-pockets | published | true | 15 | 9 | 0 |
| gildan-unisex-heavy-blend-pocket-sweatpants | published | true | 24 | 6 | 0 |
| gildan-unisex-softstyle-midweight-pocket-sweatpants | published | true | 48 | 24 | 0 |
| gildan-youth-heavy-blend-sweatpants | published | true | 12 | 9 | 0 |
| next-level-unisex-fleece-sweat-shorts | published | true | 5 | 6 | 0 |
| team-365-women-s-zone-performance-shorts | published | true | 35 | 15 | 0 |
| under-armour-youth-tech-vent-athletic-shorts | published | true | 14 | 9 | 0 |

All 13 currently export as `startingPrice: null` (quote-required, not instantly purchasable) via
the existing `cheapestOrderableOffer()` safeguard -- this is not an active purchase-risk bug
today, just catalogue clutter.

## After (executed 2026-11-11)

Only `status` and `isPublished` changed, for all 13, confirmed via `UPDATE ... RETURNING`:

| Field | Before | After |
|---|---|---|
| `status` | `published` | `hidden` |
| `isPublished` | `true` | `false` |
| Variants | unchanged | unchanged (207 total across the 13, confirmed) |
| Images | unchanged | unchanged (95 total across the 13, confirmed) |
| `SupplierProduct` links | unchanged (still 0) | unchanged (still 0) |
| Any order/quote/design reference | none (confirmed, re-checked immediately before the write) | none (unaffected either way) |

Nothing was deleted or merged. The "-2" siblings (the real, properly-linked, purchasable products)
are completely unaffected by this change in either direction.

## Reversibility

`hidden -> published` is itself a valid transition (confirmed by this package's own
`catalogue-curation.test.ts`). To undo, run this against the live `maple-imprint-catalogue`
Supabase project (the exact inverse of the UPDATE actually executed):

```sql
update "MasterProduct"
set status = 'published', "isPublished" = true, "updatedAt" = now()
where id in (
  'cmtum8e1i00hqg5v43c629ic3','cmtum838300hkg5v43ljhsoo3','cmtum7nip00hbg5v4v3a283u9',
  'cmtum8o2g002og5i0s5wr8nz8','cmtum8tqp002rg5i052w4khog','cmtum9ezw0033g5i0d7gxioan',
  'cmtum9490002xg5i01rkyizkc','cmtum9q3z0039g5i02sd7fm3g','cmtumaf08003lg5i0zenz3ti2',
  'cmtuma49x003fg5i0uvndsc18','cmtumbc4d0046g5i0n0btltir','cmtumbspy00iqg5v4k8et83ns',
  'cmtumcd6u00j2g5v4w75fa7g4'
)
and status = 'hidden' and "isPublished" = false
returning id, slug, status, "isPublished";
```

## How this was executed

Via direct SQL against the live Supabase project (service-role equivalent access, already
authorized this engagement -- never `DATABASE_URL`), not the Prisma-based script below, which
remains the documented alternative for whoever has a real `DATABASE_URL`:

```bash
cd catalogue-engine
npm run build
# with a real DATABASE_URL available:
node scripts/unpublish-orphaned-duplicates.mjs --confirm
```

Without `--confirm`, the script only prints the dry-run count (already verified this session to
report "13 products would be set to 'hidden'" without touching the database).
