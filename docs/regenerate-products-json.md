# Regenerating `src/lib/generated/products.json`

The static catalogue file the site actually serves has been stale since before this session
started -- it predates the 669 SanMar description backfill and the `stripHtml()` entity-decoding
fix (both applied directly to the database; see commit history on `checkout-square-payments`).
Neither change is visible on the live site until this file is regenerated for real.

This has not been run this session in any environment Claude has access to, because no sandbox
in this engagement has ever had a real `DATABASE_URL`. Nothing was invented or guessed to work
around that -- this document is the exact procedure for whoever has real credentials.

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
