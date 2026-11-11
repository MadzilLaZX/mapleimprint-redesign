# Orphaned products: before/after report

Exact current state, re-verified live immediately before writing this report (2026-11-11) --
unchanged from every prior check this engagement, confirming no drift. **Not executed. Requires
your approval**, then a run of `catalogue-engine/scripts/unpublish-orphaned-duplicates.mjs --confirm`
with a real `DATABASE_URL`.

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

## After (proposed, pending approval)

Only `status` and `isPublished` change, for all 13, via `transitionProductStatus(prisma, id,
'hidden')`:

| Field | Before | After |
|---|---|---|
| `status` | `published` | `hidden` |
| `isPublished` | `true` | `false` |
| Variants | unchanged | unchanged |
| Images | unchanged | unchanged |
| `SupplierProduct` links | unchanged (still 0) | unchanged (still 0) |
| Any order/quote/design reference | none (confirmed) | none (unaffected either way) |

Nothing is deleted or merged. The "-2" siblings (the real, properly-linked, purchasable products)
are completely unaffected by this change in either direction.

## Reversibility

`hidden -> published` is itself a valid transition (confirmed by this package's own
`catalogue-curation.test.ts`). Undoing this exactly reverses the table above: run
`transitionProductStatus(prisma, id, 'published')` for the same 13 ids.

## Exact execution procedure, once approved

```bash
cd catalogue-engine
npm run build
# with a real DATABASE_URL available:
node scripts/unpublish-orphaned-duplicates.mjs --confirm
```

Without `--confirm`, the script only prints the dry-run count (already verified this session to
report "13 products would be set to 'hidden'" without touching the database).
