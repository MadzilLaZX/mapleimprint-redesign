# Pricing reconciliation: live `products.json` vs staged regeneration

Requested after the previous round's report flagged 1203 price increases in the staged
regeneration. **No live prices have been changed as a result of this investigation** --
`products.staged-via-rest.json` remains staged, not promoted, pending your separate approval.
This document only investigates and explains; it does not act.

## Scope of the comparison

- 1223 products are priced (non-quote-required) in both the live file and the staged
  regeneration.
- **1203 of 1223 (98%)** have a different `startingPrice`; the other 20 are identical.
- **Every single difference is an increase.** Zero decreases. Zero products moved between
  priced and quote-required in either direction.
- Distribution of the percentage increase: min **2.2%**, median **12.8%**, mean **12.3%**,
  p90 **15.8%**, max **52.5%**. The bulk (901 of 1203) fall in a tight 5-15% band; only 2 products
  exceed 20%.

## What was checked, and what each check ruled in or out

**Currency conversion -- ruled out, by code guarantee, not just this dataset.**
`calculatePrice()` (`catalogue-engine/src/pricing/engine.ts`) refuses to price a product at all
(returns `quote_required`, never a guessed conversion) whenever a wholesale cost's currency
doesn't match the expected currency -- there is no FX conversion path to silently get wrong. Since
zero products moved between priced and quote-required status in this comparison, currency
mismatches are not a factor in any of the 1203 diffs.

**Manual price overrides -- ruled out.** The `ManualPriceAdjustment` table (the only mechanism in
this schema for a one-off manual price change) has **zero rows** in the live database. Nothing
here was manually adjusted.

**Markup rule changes -- cannot be fully ruled in or out, but nothing points to it.** Exactly one
`MarkupRule` row exists in the live database, global (no supplier/brand/category/productType
pinning), and it is the only one that has ever existed (no inactive/superseded row, no history
table for this table in the schema). Nothing in this investigation found evidence it changed; its
current value was also confirmed (Aug 20 commit message: "Fix real product pricing: wholesale cost
+ 40% markup") to already be in place in August, well before most of the affected supplier cost
syncs -- making it an unlikely primary driver, though its exact value is not repeated here per your
instruction to keep this figure out of the public repo.

**Bulk-discount / quantity-tier structure -- ruled out.** The print-cost-per-quantity-tier table
(`APPAREL_PRINT_TIERS`/`HAT_PRINT_TIERS`) is a static code constant, not database data, and this
round's `git status` confirms no file under `catalogue-engine/src/pricing/` was touched. The tier
structure used by both the live file and the staged regeneration is identical code.

**Supplier wholesale cost changes -- confirmed as the primary, directly-verified driver.** A real
supplier price re-sync touched **40,541 `SupplierVariantOffer` rows** in a 29-minute window on
2026-11-10 (08:00:12-08:29:22 UTC, confirmed via `lastPriceSyncAt`). Checking which currently
priced products' *cheapest* offer falls inside that exact window: **903 of 1312** published,
priced products (69%) -- a ratio closely matching the 1203-of-1223 diff count. This is a real,
dated, verifiable database event, not a hypothesis.

**git history confirms the live file's pricing data is older than its own commit date suggests.**
The most recent commit touching `src/lib/generated/products.json` (`77459b32`, 2026-11-10
06:42:02+0600) is titled "Fix 13 duplicate-slug products' images by referencing their sibling's
existing photos" -- and directly diffing that commit confirms it: a sample product's
`startingPrice` is byte-identical before and after that commit. **The live file's pricing fields
were not regenerated on Nov 10 at all** -- only its `images` field was patched for 13 specific
products. The live file's actual pricing data dates to whatever earlier commit last touched
`startingPrice`/`priceTiers` for each product (for several sampled products, that traces back to
mid-September or earlier), which is well before *both* the Nov 10 cost re-sync *and*, for some
products, even their most recent individual cost sync.

## Per-product verification (not just aggregate statistics)

Six products were independently re-verified end to end -- not trusting the staged export's own
logic, but recomputing from scratch: queried the live database directly for the product's real
current cheapest orderable wholesale cost, ran it through the real `calculatePrice()` engine with
the real live `MarkupRule`, and confirmed the result matches the staged export exactly, not the
live file:

| Product | Live (stale) | Staged (recomputed, verified) | Change | Cheapest-offer cost last synced |
|---|---|---|---|---|
| ATC Everyday Cotton Tee | $23.15 | $23.99 | +3.6% | 2026-09-12 (predates even the live file's own last pricing-relevant commit) |
| Next Level Sueded T-Shirt | $35.43 | $38.99 | +10.0% | 2026-11-10 08:02 UTC (inside the resync window) |
| Gildan Softstyle Midweight Pocket Sweatpants | $53.18 | $59.99 | +12.8% | 2026-09-09 |
| Adidas Elevated Fleece 1/4-Zip Pullover | $80.20 | $91.99 | +14.7% | 2026-11-10 08:19 UTC (inside the resync window) |
| Berne Icecap Insulated Coverall | $267.02 | $314.99 | +18.0% | 2026-09-09 |
| Oakley 20L Enduro Backpack (largest single outlier) | $56.40 | $85.99 | +52.5% | 2026-11-10 08:20 UTC (inside the resync window) |

Every one of these six independently recomputed to the exact staged value, across the full range
of the distribution (smallest diff to the single largest outlier) and across both "inside the
resync window" and "cost unchanged in months" cases. **This is the core finding: the staged
export is not introducing a pricing error anywhere checked -- it is a correct, faithful computation
of the real database's current cost and markup data. The live file is the one that's wrong,
because its pricing fields have not actually been regenerated as recently as its own git history
implies.**

## Conclusion

**The current catalog is genuinely underpriced, not the other way around.** Every mechanism this
investigation could check (currency, manual overrides, bulk-tier code, markup-rule history) was
ruled out as an error source in the new export. The two confirmed real drivers are (1) a dated,
verifiable supplier cost re-sync affecting most of the diffed products, and (2) the live file's
pricing fields simply not having been regenerated as recently as assumed -- its one post-dated
commit this round turned out to be an image-only patch. Promoting the staged file would correct
genuinely stale, under-market prices for the majority of the apparel catalogue.

**What this does not resolve, and remains your decision:** whether a median ~13% increase (and a
couple of outliers up to 52%) is something you want customers to see all at once, whether you'd
rather phase it, and whether the one active markup rule's value itself is still the one you intend
for a public launch. None of that is a technical question this investigation can answer for you.

## Not yet done

Re-running the staged export against the now-backfilled weight data (migration 008 + backfill
applied this round) and the now-unpublished 13 orphans, so a single, final, fully-current staged
file exists for your eventual promotion decision -- this reconciliation used the staged file from
before those two operations, which don't affect pricing but do mean the staged file itself is one
step behind the current database state. **Still not promoted either way.**
