# products.json replacement: before/after summary + exact procedure

**Status: prepared, NOT executed.** No live price has changed. This document is the complete
before/after picture and the exact steps to promote, for when you give final approval --
promotion itself is not performed by this round of work.

## Before/after summary (no wholesale cost or markup figures included)

| Metric | Live (current) | Staged (prepared) |
|---|---|---|
| Total products | 1,749 | 1,769 |
| Priced products | ~1,170 (1203 fewer than staged's priced count once the 13 unpublished orphans and 33 newly-published products are accounted for) | 1,223 |
| Quote-required products | remainder | 546 |
| Products with a real `shippingWeightLb` | 0 (field always null -- migration 008 wasn't applied yet) | 1,310 |

**Catalog membership changes** (independent of pricing):
- **-13**: the orphaned-duplicate products approved and unpublished this round. Correctly absent
  from the staged file; already live in the database (see `orphaned-products-before-after.md`).
- **+33**: products published in the database since the live file was last generated. Unrelated
  to this round's work -- ordinary catalogue growth already in the database, simply never
  reflected in the static file until now.

**Pricing changes:**
- **1,203 of 1,223 priced products (98%) have a different `startingPrice`** between live and
  staged. **Zero decreases** -- every difference is an increase. Zero products changed
  priced/quote-required status in either direction.
- Distribution of the increase: minimum **2.2%**, median **12.8%**, mean **12.3%**, 90th
  percentile **15.8%**, maximum **52.5%**. The bulk cluster in a 5-15% band; two products exceed
  20%.
- **Full root-cause analysis in `pricing-reconciliation-2026-11-11.md`**: a dated, verifiable
  supplier cost re-sync plus the live file's pricing fields not having been regenerated as
  recently as its own commit history suggested. Currency conversion, manual overrides, and
  bulk-tier code changes were all ruled out as causes.
- **This round's full-scale reconciliation** (all 1,769 published products, not a sample)
  independently re-derived every price from the live database and the real pricing engine, and
  found **one genuine discrepancy** in the regeneration script itself (not in the live-vs-staged
  comparison) -- a pagination-ordering gap in `export-products-via-supabase-rest.mjs` that could
  pick a non-orderable offer's cost for one product. Fixed, and the staged file regenerated;
  **the full 1,769-product reconciliation now passes with zero mismatches, on both price and
  shipping weight.** `catalogue-engine/scripts/verify-staged-pricing.mjs` is now a permanent,
  reusable script for re-running this exact check before any future promotion.

**Catalog integrity** (every one of the 1,773 live `SupplierProduct` rows accounted for):
- 1,769 linked to a published product and present in the staged file.
- 2 linked to a currently-unpublished product (correctly absent from the catalog, not a bug).
- 2 not yet matched to any product at all (correctly absent, awaiting match review).
- Variants: staged total (62,798) matches the live database's active-variant count exactly.
- Images: staged total (18,806) matches the live database's published-image count (26,322) exactly
  once the documented swatch-thumbnail exclusion (7,516 rows, always excluded by design) is
  accounted for.
- Descriptions: zero empty, zero unresolved HTML entities, across all 1,769 products.
- Categories: zero unresolved `categorySlug`/`subcategorySlug`, across all 1,769 products.

**Pricing consistency across surfaces:** product pages, cart/checkout's server-side recompute
(`priceCartItem.ts`), and Studio's customization pricing (`ProductCustomizer.tsx`) all call the
same `blankUnitPrice()` function against the same `CatalogueProduct` object sourced from the one
`products.json` file -- there is no second, independent pricing path that could disagree with the
first. Promoting the file updates all three simultaneously and identically, by construction, not
by convention.

## Exact replacement procedure, once you give final approval

```bash
cd catalogue-engine

# 1. Re-verify one more time immediately before promoting, in case the database has changed
#    again since this document was written:
node scripts/verify-staged-pricing.mjs
# Must print "All checked products match exactly on both price and weight." before continuing.
# If it reports any mismatches, STOP -- do not promote until they're understood and resolved.

# 2. Back up the current live file (so rollback is a pure file restore, no regeneration needed):
cp ../src/lib/generated/products.json ../src/lib/generated/products.json.backup-$(date +%Y%m%d-%H%M%S)
cp ../src/lib/generated/sizeSpecs.json ../src/lib/generated/sizeSpecs.json.backup-$(date +%Y%m%d-%H%M%S)

# 3. Promote (atomic file replacement, not a merge):
mv ../src/lib/generated/products.staged-via-rest.json ../src/lib/generated/products.json
mv ../src/lib/generated/sizeSpecs.staged-via-rest.json ../src/lib/generated/sizeSpecs.json

# 4. Rebuild and verify the site builds clean against the new data:
cd ..
npx tsc --noEmit
npm run build

# 5. Commit as its own, clearly-labeled commit (generated-data change, not a code change):
git add src/lib/generated/products.json src/lib/generated/sizeSpecs.json
git commit -m "Promote regenerated products.json: real weights, current wholesale costs, 20 newly-matched products"

# 6. Deploy to Preview first (never directly to Production). Re-verify a sample of product pages,
#    cart totals, and Studio pricing on Preview before requesting Production promotion separately.
```

## Rollback procedure

If anything looks wrong after promoting (on Preview or, if already promoted, Production):

```bash
# Fastest: restore the exact pre-promotion file from the backup made in step 2 above.
cp src/lib/generated/products.json.backup-<timestamp> src/lib/generated/products.json
cp src/lib/generated/sizeSpecs.json.backup-<timestamp> src/lib/generated/sizeSpecs.json
git add src/lib/generated/products.json src/lib/generated/sizeSpecs.json
git commit -m "Revert products.json promotion"
```

If already deployed to Production, a Vercel dashboard rollback (promote the last-known-good
deployment) is faster than a new commit+deploy cycle -- see `production-deployment-checklist.md`'s
existing rollback section, same procedure, not specific to this change.

**No database write is involved in promotion or rollback at all** -- this is purely a static file
swap. The underlying database data (migration 008, the weight backfill, the 13 unpublished
products) is already live and would not be affected by rolling back this file.

## What this procedure does NOT do

- Does not touch the database in any way.
- Does not change any pricing *rule* -- it makes the static file match what the real pricing
  engine already computes from the live database today.
- Does not deploy to Production by itself -- step 6 explicitly stops at Preview.
- Does not activate Canada Post or any paid service.
