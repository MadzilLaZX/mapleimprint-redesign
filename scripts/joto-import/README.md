# Joto product import

Turns Joto Imaging Supplies Canada product links into finished Maple Imprint listings: name,
description, options, pack size, photos, and retail prices with the house markup.

## What comes from where

| Data | Source | Automatic? |
|---|---|---|
| Title, SKU, options (colour/size/shape), price, sale/regular price, availability, photos | Joto's public catalogue (`products.json`) — prices verified identical to the Mapleimprint dealer account on all 61 hand-imported products | Yes |
| Pack size per option | The product page's own `HulkTierData` block | Yes |
| "Buy more, save more" quantity tiers | Joto's discount app, which only answers real shoppers' browsers | One click per page — see bookmarklet |
| Category | Keyword rules in `build.mjs` (override in the manifest) | Yes, reviewable |

## Workflow

1. `node scripts/joto-import/feed.mjs` — refresh the catalogue cache (prices change; do this per batch).
2. Add links to `manifest.json`:
   ```json
   { "products": [ { "handle": "https://jotoimagingsupplies.ca/products/..." } ] }
   ```
   Optional per product: `category` ("drinkware/bottles"), `name`, `description`, `packSize`,
   `sellUnit` ("pack" | "case" | "unit"), `excludeVariants` (["Silver"]), `slug`, `maxImages`.
3. Optional, for quantity tiers: open each product on Joto (logged in), click the **Save Joto tiers**
   bookmark, and move the downloaded `joto-tiers-*.json` files into `scripts/joto-import/tiers/`.
4. `node scripts/joto-import/build.mjs --dry` — review the report (prices before → after markup,
   duplicates skipped, warnings), then run without `--dry` to write the files and download photos.
5. `npm run build`, commit, deploy.

## Rules the builder enforces

- Markup from `src/lib/houseProducts/pricing/margin.ts`: under $7 +30%, $7–15 +25%, $15–25 +20%,
  $25–35 +15%, $35+ +10% — bracket chosen by the **per-piece** cost; a sale item's first tier is marked
  up from Joto's **regular** price.
- Exact Joto costs go only to `jotoImportedInternalOnly.ts` (never imported by the site).
- Products whose SKU is already anywhere in `src/lib/houseProducts` are skipped (no duplicates).
- Sold-out Joto options are kept and listed in the report.

## Installing the bookmark (once)

Run `node scripts/joto-import/make-bookmarklet.mjs`, copy the whole contents of `bookmarklet.txt`,
then in Chrome: Bookmarks bar → right-click → Add page… → Name `Save Joto tiers`, URL = the copied text.
