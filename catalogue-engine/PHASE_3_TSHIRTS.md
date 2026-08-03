# Phase 3 milestone: real T-shirts, live on the website (2026-08-03)

The client asked for products to actually appear on the website, organized into categories
(Products > Custom Apparel > T-Shirts), with real images/names/descriptions/sizes, priced per
their print-cost chart. This is what got built to make that real, end to end — not a mock, not
placeholder data.

## What's live right now

23 real T-shirt products from S&S Activewear, imported via their live API, sitting in the
Supabase database as `published` `MasterProduct` rows, and exported into the Next.js frontend.
Visit `mapleimprint-redesign`'s `/products/custom-apparel/t-shirts` to see them. Each product page
shows: real supplier images (hotlinked from `cdn.ssactivewear.com`), real name/brand/description,
real colours and sizes, and a price-by-quantity table.

One product ("Infant Jersey One Piece") got swept in by S&S's own category bucketing but isn't
actually a T-shirt — it was promoted then immediately hidden (`transitionProductStatus` to
`hidden`) rather than deleted, so it's cleanly excluded without losing the data.

## How pricing works — deliberately NOT wholesale + markup

The client was explicit: a single tee at 1-2 units is $20, exactly matching the first row of the
"Printing Cost" chart they provided. The displayed price is the print-cost chart's per-tier price
directly (`APPAREL_PRINT_TIERS` in `src/pricing/rules/seed-data.ts`), not wholesale cost plus a
markup. No markup percentage was ever requested or guessed — this sidesteps that open business
question entirely for now, since it wasn't needed. See `scripts/export-products-for-frontend.mjs`'s
`priceTiersFor()`.

## New pieces built this session

- **Schema change**: `SupplierVariantOffer` gained `colourName`/`size` columns (previously only
  `RawSupplierVariant` in-memory had this — nothing persisted it, which meant `promote.ts`
  couldn't reconstruct variants from the database alone). Applied via `prisma db push` (table was
  empty at the time, confirmed before altering — see project memory for how that was checked
  without the Supabase MCP tools, which disconnected mid-session).
- **`src/integrations/suppliers/filtered/FilteredCatalogueConnector.ts`** — a generic decorator
  that narrows any `SupplierConnector`'s `fetchProductCatalogue()` to a predicate (e.g. "only
  `productType === 't_shirt'`"), without teaching the generic sync pipeline anything
  supplier-specific. Reusable for any future supplier/category combination.
- **`SSActivewearConnector` now tags `productType`** for T-shirt `baseCategory` values
  (`T-Shirts - Premium`/`Core`/`Long Sleeve`, confirmed live), leaves everything else untagged
  rather than guessing.
- **`catalogue-import.ts` now persists images** — previously the connector computed
  `RawSupplierProduct.images` but nothing wrote them to `ProductImage`. Now every import records
  them (`source: supplier`, `status: pending`), even for products nobody's promoted yet.
- **`src/catalogue/promote.ts`** (`promoteSupplierProductToCatalogue`) — turns a raw, imported
  `SupplierProduct` into a real `MasterProduct`: creates/reuses a `Brand`, one `ProductVariant`
  per distinct colour+size, links offers and images, and walks the existing curation state machine
  (`imported → needs_review → approved → published`) — calling this function IS the approval
  decision, not a bypass. **Found and fixed a real bug during testing**: the first version never
  wrote `masterProductId` back onto the `SupplierProduct` row, so idempotency was broken (a second
  call would create a duplicate `MasterProduct` instead of recognizing the product was already
  promoted). Caught by the integration test's second "call it again" case, fixed, verified.
- **`scripts/import-ss-tshirts.mjs`** — seeds the category taxonomy (mirrors the frontend's
  `PRODUCT_CATEGORIES` in `mapleimprint-redesign/src/lib/constants.ts` exactly, same slugs), runs
  a filtered catalogue import, then promotes everything new. `IMPORT_LIMIT` env var caps how many
  styles to pull (used 6 for a dry run, then 24 for the real batch).
- **`scripts/export-products-for-frontend.mjs`** — queries `published` `MasterProduct`s and writes
  `mapleimprint-redesign/src/lib/generated/products.json`. Strips supplier HTML descriptions down
  to plain text before export (rendering raw third-party HTML via `dangerouslySetInnerHTML` would
  be a real XSS surface — this avoids it entirely rather than trying to sanitize HTML).
- **Frontend** (`mapleimprint-redesign/src/`): `lib/products.ts` (typed loader for the generated
  JSON), `app/products/[category]/[subcategory]/page.tsx` (new — product grid), `app/products/
  [category]/[subcategory]/[product]/page.tsx` (new — product detail with images/description/
  colours/sizes/price table), and `app/products/[category]/page.tsx`'s subcategory tiles now link
  to real pages and show a real cover photo + product count when data exists. `next.config.ts`
  whitelists `cdn.ssactivewear.com` for `next/image`. Full production build verified (`npm run
  build`), and the actual rendered HTML was checked (`next start` + `curl`) to confirm real prices/
  images/text are in the page output, not just that it compiles.

## A real performance finding, not a bug

The 24-style import took roughly 90+ minutes end to end — not a hang, confirmed by watching
`SupplierProduct`/`SupplierVariantOffer`/`ProductImage` row counts climb steadily via direct DB
queries while it ran. Some T-shirt styles have 500+ SKU variants and 250+ images (colour × size
combinations across a huge colour range) — the current code does one Prisma call per row
(upsert-per-variant, findFirst-then-create per image) over the Supabase Session pooler's WAN
latency, which adds up fast at that scale. Fine for a one-off scripted import; would need
batching (`createMany`, bulk upserts) before this could run as a frequent/scheduled sync job
against the full ~1092-style catalogue.

## Image sourcing: hotlinked, not rehosted — still worth settling

Product images point directly at `cdn.ssactivewear.com` — nothing is downloaded or rehosted on
Maple Imprint's own infrastructure. This is a deliberately lower-risk stance than rehosting
(no image-redistribution-rights question triggered the way it would be for downloading and
serving copies from Maple Imprint's own CDN), but it's still worth getting written confirmation
from S&S eventually (see README's "What I need from you" #6) — and hotlinking means these images
are only as reliable as S&S's own CDN uptime, with no fallback if a URL changes or 404s later.

## What's still not done

- Only T-shirts, only from S&S. Other product types (polos, hoodies, hats...) and other suppliers
  need the same treatment once there's data/access for them.
- No customization function yet (the client's explicit next step — printing/decoration options,
  colour/size selection into an actual order) — this phase was scoped to "get real products on the
  site," not checkout/customization.
- Bulk-import performance (see above) if this needs to run unattended/frequently later.
