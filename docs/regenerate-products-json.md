# Regenerating `src/lib/generated/products.json`

The static catalogue file the site actually serves has been stale since before this session
started -- it predates the 669 SanMar description backfill and the `stripHtml()` entity-decoding
fix (both applied directly to the database; see commit history on `checkout-square-payments`).
Neither change is visible on the live site until this file is regenerated for real.

## Update, 2026-11-11: an alternate path was actually built and run against live data this round

No sandbox in this engagement has ever had a real `DATABASE_URL` -- that remains true, and
`DATABASE_URL` was never exposed, invented, or committed. But `SUPABASE_SERVICE_ROLE_KEY` **was**
already present in the website's `.env.local` this round (the same key
`src/lib/server/supabaseAdmin.ts` uses for every checkout/order operation all engagement) -- an
"existing authorized secure environment," per your own Priority 3 wording. That made it possible
to actually build and run a real regeneration this round, not just document the Prisma procedure
for someone else to run later.

**`catalogue-engine/scripts/export-products-via-supabase-rest.mjs`** (new file) authenticates with
that key against Supabase's REST (PostgREST) API instead of Prisma, paginating through
`MasterProduct`/`ProductVariant`/`SupplierVariantOffer`/`SupplierProduct`/`ProductImage`/
`MarkupRule`/`SupplierProductSpec` directly. It reuses the exact same pricing/formatting logic as
the Prisma script below -- `stripHtml()`, `chartFor()`, `resolveMarkupRule()`,
`cheapestOrderableOffer()`, `buildPriceTiers()`, `resolveShippingWeightLb()`, and the real
`calculatePrice()` engine are all imported, none reimplemented. It writes to
**`src/lib/generated/products.staged-via-rest.json`** -- a new, separate file, never the live
`products.json` -- per the standing "do not overwrite the production catalog without validation
and approval" instruction.

**This was actually run against the live database this round.** Results, independently validated
(not just produced and trusted):

- **1782 published products** exported (the live file currently has 1749 -- 33 more have been
  published in the DB since the live file was last generated; nothing from the live file is
  missing in the new export).
- **669 description diffs** -- exactly matching the known SanMar description-backfill count. This
  confirms the regeneration genuinely picks up that already-applied database fix, which has never
  been visible on the live site until a real regeneration runs.
- **1203 `startingPrice` diffs, all increases, zero decreases** (ratios ranging +2.2% to +52.5%,
  not uniform). This was investigated before trusting it, not assumed benign: manually recomputing
  one product (`allpro-men-s-pro-lock-performance-t-shirt`) directly against the live database --
  its real cheapest wholesale cost ($8.09 CAD) run through the real `calculatePrice()` engine with
  the live database's one active `MarkupRule` (a global 40% markup, confirmed via a direct query)
  -- yields **$33.99**, exactly matching the new export, not the live file's stale $31.33. The
  non-uniform ratio spread is itself expected, not a red flag: printing cost is a fixed add-on
  (never marked up, per the pricing engine's own documented formula), so a flat markup-percentage
  change produces a *larger* total-price swing for wholesale-cost-dominated products and a
  *smaller* swing for printing-cost-dominated ones -- exactly the pattern observed. **Conclusion:
  the live `products.json` is pricing roughly two-thirds of the priced catalogue below what the
  real pricing engine would compute today against the live database's current markup rule and
  wholesale costs** -- a real, concrete, launch-relevant gap this regeneration would fix, not a
  cosmetic staleness issue.
- Size specs: 0 rows found (unchanged from the live file -- `sync-specs.mjs` still hasn't been run
  against real S&S credentials, as already documented elsewhere).

**Not yet done -- your decision, not executed without it:** promoting
`products.staged-via-rest.json` to replace the live `products.json`. The file is staged, committed
alongside this round's other changes for your review, and the comparison above is the validation
this document's own "After running" checklist calls for -- but the actual `mv`/overwrite is a
production-catalog change and needs your explicit go-ahead, especially given the price increases
are real and would visibly change what customers see across most of the priced catalogue.

### Running it again later

```bash
cd catalogue-engine
npm run build
node scripts/export-products-via-supabase-rest.mjs
```

Reads `SUPABASE_SERVICE_ROLE_KEY` from the website's `.env.local` automatically (same lookup
`supabaseAdmin.ts` uses) -- no extra setup beyond having that file in place, which it already is
in this repo. Pass `--force` only if you expect the staged count to legitimately fall below 50% of
the live file's count (mirrors the Prisma script's own safety guard).

## The original Prisma-based procedure (unchanged, remains the primary path if you have a real `DATABASE_URL`)

This has not been run this session via Prisma specifically, because no sandbox in this engagement
has ever had a real `DATABASE_URL`. Nothing was invented or guessed to work around that -- this
section is the exact procedure for whoever has real credentials, independent of the REST-based
path above.

## What the script does (unchanged, not modified this session)

`catalogue-engine/scripts/export-products-for-frontend.mjs`:
- Reads every `published` `MasterProduct` from the live Postgres database via Prisma.
- Recomputes `startingPrice`/`priceTiers` by calling the real `calculatePrice()` engine against
  each product's current `MarkupRule` -- this is the same pricing logic the site already uses
  everywhere else, not a new or different calculation. Running this script does **not** change
  any pricing rule; it re-renders the existing rules' current output.
- Strips HTML from descriptions via `stripHtml()` (now including the `&reg;`/`&trade;`/etc. fix).
- Writes `src/lib/generated/products.json` and `src/lib/generated/sizeSpecs.json`.

**Built-in safety guard, already present, not added this session:** the script refuses to write
if the new export has fewer than 50% of the previous file's product count (`MIN_SURVIVING_FRACTION`),
on the theory that a shrink that large is almost always a bad DB read, not a real catalogue
change. It exits with an error instead of overwriting in that case. Use `--force` only if a large
drop is genuinely intended (e.g. a deliberate mass-unpublish) -- not for routine regeneration.

## Prerequisites (none of these are supplied by Claude -- they must come from you)

1. **`DATABASE_URL`** -- the real Postgres connection string for the `maple-imprint-catalogue`
   Supabase project (`ovqkwedpwmuusnijbxro`). Get it from the Supabase dashboard: Project Settings
   → Database → Connection string → use the **service-role / direct connection** form, not the
   anon-key pooler URL (RLS would block Prisma's reads otherwise). `.env.example` in
   `catalogue-engine/` documents the exact variable name and format.
2. Run from a machine/environment you trust with that connection string -- it is a real secret.
   Never commit it, never paste it into chat with an AI assistant, never put it in a shared
   environment.

## Procedure

```bash
cd catalogue-engine
# one-time per machine, or after a fresh checkout:
npm install
npx prisma generate

# put the real DATABASE_URL in catalogue-engine/.env (git-ignored) or export it in your shell:
echo 'DATABASE_URL="postgresql://...">' > .env

npm run build
node scripts/export-products-for-frontend.mjs
```

Expected output: `Exported N products to .../src/lib/generated/products.json`, plus a
priced/quote-required split count and a size-specs count. If it instead prints `Refusing to
write...`, stop and investigate why the count dropped before considering `--force`.

## After running

1. `git diff --stat src/lib/generated/products.json` -- review the size of the diff before
   committing. Expect widespread but shallow changes (every product's `description` field at
   minimum, since `stripHtml()` changed); do **not** expect `startingPrice`/`priceTiers` to move
   for products whose `MarkupRule` hasn't changed.
2. Spot-check a few SanMar products (e.g. search the diff for `"WindWall"` or `"FlexVent"`) to
   confirm descriptions now contain real text with correctly decoded `™`/`®`/smart quotes, not
   raw `&trade;`/`&reg;` entities.
3. Run the existing test/build/lint suite (`npm test` at the repo root, `npm run build`,
   `npx tsc --noEmit`) before committing -- same as any other change to this branch.
4. Commit only `src/lib/generated/products.json` (and `sizeSpecs.json` if it changed) -- this is
   a generated-data commit, not a code change, so keep it in its own commit with a clear message
   (e.g. "Regenerate products.json: SanMar description backfill + entity-decoding fix").
5. Push to both `origin` (MadzilLaZX) and `fork` (ishaatlabib-tech), same as every other commit
   this session.

## If `DATABASE_URL` is never available to Claude

This procedure is written so a human with real Supabase credentials can run it directly --
nothing here requires Claude's involvement once the connection string exists. If you'd rather
have Claude run it in a future session, the one thing that would need to change is providing a
real `DATABASE_URL` in that session's environment; no code change is needed first.
