# catalogue-engine

Supplier-independent product catalogue, inventory sync, and dynamic pricing engine for Maple
Imprint. This is a **standalone, backend-agnostic package**, not part of the Next.js frontend in
the parent `mapleimprint-redesign` repo — see "Why this is separate from the website" below.

## Status: Phase 1 + Phase 2 done, Phase 3 underway — 23 real, published products live on the site

**2026-08-03: real products are live on mapleimprint.ca's product pages.** 23 real T-shirts
imported from S&S Activewear's live API, promoted through the full curation pipeline to
`published`, and exported into the Next.js frontend at `mapleimprint-redesign/src/lib/generated/
products.json`. Visit `/products/custom-apparel/t-shirts` on the site to see them — real names,
descriptions, images (hotlinked from S&S's CDN), colours, sizes, and prices, all sourced from a
live supplier, not fixtures. See `scripts/import-ss-tshirts.mjs` and
`scripts/export-products-for-frontend.mjs` for how to run this again (e.g. after S&S data changes,
or to import a different product type). Full detail on how this works — schema addition
(`SupplierVariantOffer.colourName`/`size`), the new `promoteSupplierProductToCatalogue` curation
step, the pricing decision (chart price, not wholesale+markup), and the frontend routes built —
is in `PHASE_3_TSHIRTS.md`.

Buildable and testable without any real supplier account or database:

- `prisma/schema.prisma` — the full normalized data model (suppliers, master products, variants,
  supplier offers, warehouse inventory, images, dedup match candidates, pricing rules, append-only
  pricing snapshots, sync jobs).
- `src/integrations/suppliers/contract.ts` — the `SupplierConnector` interface every real
  connector (SanMar, S&S, Joto, Condé) will implement. Nothing outside `integrations/suppliers/*`
  should ever read a supplier-native field name directly.
- `src/integrations/suppliers/mock/MockConnector.ts` — an in-memory fake connector, used to prove
  the sync pipeline works before any real supplier credentials exist.
- `src/sync/change-detection.ts` — pure diff + safety-stop logic. A sync only commits if it passes
  configurable thresholds (e.g. abort if >30% of records go missing, or >20% of prices zero out).
- `src/sync/orchestrator.ts` — wires a connector to Prisma: fetch → diff → safety-check → commit
  in one transaction, or abort and leave the live catalogue untouched.
- `src/sync/dedup/matcher.ts` — confidence-scored product matching (brand+style = auto-approve,
  weak name similarity alone never merges). `review-queue.ts` persists match decisions.
- `src/pricing/engine.ts` — pure pricing calculator seeded from the client's current cost sheet
  (`src/pricing/rules/seed-data.ts`). Never fabricates a price: missing wholesale cost or an
  unconfigured markup rule resolves to `quote_required`, not a guessed number.
- `src/pricing/snapshot.ts` — builds the append-only `PricingSnapshot` payload. Refuses to build
  one from a `quote_required` breakdown.
- `src/admin/dashboard-queries.ts` — read-only query layer for the admin dashboard the
  architecture doc describes (Supplier Overview, Catalogue Review, Inventory Risks, Pricing
  Risks, Sync Activity). No UI framework assumed; just data, so it doesn't need Gate A resolved.
- `src/images/validate.ts` + `src/images/ingest.ts` — the image-ingestion pipeline (architecture
  doc §"Image Integration Strategy"): validates downloaded bytes (decodable, allowed format,
  minimum resolution — default 800×800), computes a sha256 checksum for cross-supplier dedup, and
  rejects non-image responses (e.g. an HTML error page served with a 200 status) without
  crashing. Deliberately stops right before uploading to cloud storage — that step needs real
  S3/Cloudflare credentials nobody has yet, so `ingestImage()` hands back validated bytes for the
  caller to upload once storage is configured. Fully testable without network access via a
  swappable `fetcher` and synthetic images generated with `sharp`.
- `src/index.ts` — the package's public API barrel (`@mapleimprint/catalogue-engine`). Import
  from here rather than reaching into individual `src/` files. `package.json` now has proper
  `main`/`types`/`exports` pointing at `dist/index.js` — `npm run build` compiles cleanly.
- `src/sync/report.ts` — turns a `ChangeSummary`/`SafetyStopResult` into a human-readable report
  (architecture doc §"Import Safety and Change Detection": "For every sync, produce a report
  showing new/updated/discontinued products, price changes, items flagged for review..."). Pure
  formatting, reusable by the admin dashboard, a CLI, or a future email/Slack notification.
- `src/integrations/suppliers/_template/` — a compiling `SupplierConnector` scaffold
  (`TemplateConnector.ts`) plus a step-by-step `README.md` for turning it into a real SanMar/S&S/
  Joto/Condé connector once API access exists. Not wired into anything; exists purely to remove
  friction from Phase 3 when the time comes.
- `src/sync/orchestrator.ts`'s `isSyncLocked()` + a database-level partial unique index —
  enforces "at most one running sync per supplier" (architecture doc §10: overlapping syncs are
  "a classic source of a corrupted staging table"). Two layers: a fast application-level
  pre-check, and a real `CREATE UNIQUE INDEX ... WHERE status = 'running'` constraint the
  database itself enforces (application-level check-then-create alone has a race condition;
  the DB constraint is the actual guarantee). `runPriceSync` returns `status: 'skipped_locked'`
  and creates no job row when locked.
- `src/checkout/availability.ts` — size-curve-aware order availability checking (architecture doc
  §10: "A 100-shirt order spanning 8 sizes... needs size-curve-aware availability checking, do
  you have enough of each size, not just 100 units total"). Every line item (variant + quantity)
  is checked independently against cached inventory summed across warehouses/offers — an order is
  only `fulfillable` if *every* line clears, never derived from a total-quantity sum. This checks
  cached data only; a final live check via `SupplierConnector.checkLiveAvailability` still belongs
  in the real checkout flow right before payment capture.
- `src/pricing/engine.ts` now also refuses to price (forces `quote_required`) when a supplier's
  wholesale cost currency doesn't match the expected pricing currency (defaults CAD/CAD) — closes
  a real fabrication risk (architecture doc §10 flags SanMar/S&S/Joto may quote inconsistently in
  USD/CAD) without needing an actual FX-conversion policy, which is a business decision, not an
  engineering one.
- `src/catalogue/curation.ts` — the product publication state machine (architecture doc
  §"Catalogue Curation": "the system should distinguish between: Imported, Approved, Published,
  Hidden, Discontinued, Blocked, Needs review"). `transitionProductStatus()` makes invalid jumps
  structurally impossible — e.g. `imported` can never go straight to `published` skipping review,
  and unblocking a product always routes back through `needs_review` rather than silently
  restoring its previous visibility. Keeps `isPublished` in sync automatically.
- **`src/integrations/suppliers/ssactivewear/SSActivewearConnector.ts` — the first REAL supplier
  connector, verified against S&S Activewear Canada's live API using MapleImprint's actual dealer
  credentials (account C05087).** Not a mock, not a guess — every endpoint, field name, and
  constraint documented in `src/integrations/suppliers/ssactivewear/README.md` was confirmed with
  live API calls in this session. Implements the full `fetchProductCatalogue` /
  `fetchInventory` / `fetchPricing` / `checkLiveAvailability` / `healthCheck` surface. Key finding
  worth knowing: the live `/products/` endpoint only filters by `style=` — every other filter
  param (`sku=`, `skuid=`, anything else) is silently ignored and returns the **entire ~80MB
  catalogue** instead of erroring, so this connector encodes `{styleID}:{sku}` as the opaque
  `supplierVariantId` to avoid ever needing that. `submitOrder`/`getShipmentStatus` are
  deliberately left unimplemented (`NotImplementedError`) — testing those live would place a real
  order on the client's real account.
- **`src/sync/catalogue-import.ts` (`runCatalogueImport`) — closes a real gap: `runPriceSync` only
  ever updated prices on `SupplierVariantOffer` rows that already existed; nothing previously
  CREATED those rows (or `SupplierProduct`/`SupplierWarehouseInventory`) from a connector's
  `fetchProductCatalogue()` output in the first place.** This is that missing first step. Per
  product: upsert `SupplierProduct`, run the dedup matcher against existing `MasterProduct`s for
  newly-created products only, upsert each variant as a `SupplierVariantOffer`, then fetch and
  write real `SupplierWarehouseInventory` rows for those variants. One bad item doesn't abort the
  whole run — recorded in `itemErrors`, job finishes `completed_with_warnings`. Takes an optional
  `limit` (caps how many supplier products to process) as a safety valve for a first real run
  against a large live catalogue. **Verified against the real S&S API + real database**: imported
  2 real styles end-to-end (`test/ssactivewear-catalogue-import.integration.test.ts`), confirmed
  real `SupplierProduct`/`SupplierVariantOffer`/`SupplierWarehouseInventory` rows landed with real
  CAD pricing and real warehouse quantities, then cleaned up. Note: match confidence is currently
  capped below auto-approve for everything, because `MasterProduct` has no `styleCode`/`upc`/
  `material` columns yet to feed the matcher's fast-path (see the file's header comment) — a real
  schema gap to fix before dedup can ever auto-approve a real supplier product, not a bug here.

**All 109 tests pass** (`npm test`, with `DATABASE_URL` and
`SSACTIVEWEAR_ACCOUNT_NUMBER`/`SSACTIVEWEAR_API_KEY` set in `.env`): 77 pure unit tests (every quantity-tier boundary in the architecture doc, safety-stop thresholds,
dedup confidence scoring, image validation against synthetic images, sync report formatting,
currency-mismatch refusal, catalogue state-machine rules) plus 32 real integration tests that
create real rows against the live Supabase project (and, for the S&S-specific ones, the live S&S
API) and clean up after themselves:

- `test/orchestrator.integration.test.ts` (2 tests) — runs `runPriceSync` through a
  `MockConnector`, verifies the price update landed, and exercises the dedup matcher's
  **auto-approve** path (exact brand+style match).
- `test/dedup-review-queue.integration.test.ts` (3 tests) — exercises the **needs_review** path:
  an ambiguous same-brand match lands in review (never auto-approved), `approveMatch` links it
  and stamps the reviewer, and `rejectMatch` on a second candidate confirms a rejected match is
  never linked to a master product. This is the "incorrectly merging two products is worse than
  temporarily showing duplicates" guarantee from the architecture doc, proven against real data.
- `test/dashboard-queries.integration.test.ts` (5 tests) — proves each dashboard query surfaces
  the right risk: a zero-cost offer, an expired-but-active pricing rule, out-of-stock vs. stale
  (non-zero but old) inventory as *distinct* risk categories, a supplier's failed-sync count, and
  the catalogue review backlog.
- `test/sync-lock.integration.test.ts` (4 tests) — proves both lock layers: `isSyncLocked()`
  correctly reports true/false, `runPriceSync` returns `skipped_locked` and creates no job row
  when locked, the database itself rejects a second concurrent `running` insert for the same
  supplier (proving the partial unique index actually works, not just the app-level check), and a
  sync proceeds normally once the blocking job is no longer `running`.
- `test/checkout-availability.integration.test.ts` (4 tests) — builds the exact trap a naive
  total-quantity check would miss (plenty of S/M stock, almost none of L) and confirms the
  per-line check catches it; also proves warehouse-summing, a fully-fulfillable order, and the
  "no offer at all" vs. "offer exists but zero stock" distinction.
- `test/catalogue-curation.integration.test.ts` (4 tests) — proves an invalid transition (e.g.
  `imported` straight to `published`) is rejected and writes nothing, a valid one updates the real
  row, `isPublished` toggles correctly both on entering and leaving `published`, and unblocking a
  product can't skip straight back to `published` without a `needs_review` step in between.
- `test/ssactivewear-connector.integration.test.ts` (6 tests) — calls the real, live S&S
  Activewear Canada API: authenticates, streams real products with real variants/pricing/images,
  fetches real per-warehouse inventory, fetches real CAD pricing, resolves live availability for a
  real SKU, and confirms a bare (non-composite) SKU is rejected with a clear error rather than
  silently mishandled.
- `test/catalogue-import.integration.test.ts` (3 tests) — MockConnector-based, proves
  `runCatalogueImport` creates real `SupplierProduct`/`SupplierVariantOffer`/
  `SupplierWarehouseInventory` rows from scratch, correctly routes an unmatched product to stay
  unmatched vs. a same-brand product into `needs_review`, and updates (not duplicates) on a
  second import of the same style.
- `test/ssactivewear-catalogue-import.integration.test.ts` (1 test) — the real proof: runs
  `runCatalogueImport` against the live S&S API AND the live database together, imports 2 real
  styles, confirms real CAD pricing and real warehouse quantities landed in real rows, cleans up.

Without `DATABASE_URL` set, the database integration tests self-skip cleanly. Without
`SSACTIVEWEAR_ACCOUNT_NUMBER`/`SSACTIVEWEAR_API_KEY` set, the S&S-dependent tests self-skip
cleanly. Every other test file is a pure unit test — always runs, no database or network needed.

**Note on running the suite:** `vitest.config.ts` sets `fileParallelism: false`. The Supabase
free-tier Session pooler this project uses caps concurrent connections at 15; with 7+ integration
test files each opening their own `PrismaClient` connection pool, running them in parallel (the
default) can exceed that cap and produce a `max clients reached` error that has nothing to do with
test correctness. Running files sequentially avoids it — the suite takes ~100s instead of ~25s, but
is reliable. Remove this if the project ever moves to a larger pool or a local/dedicated Postgres.

**⚠️ Incident, 2026-08-02 (resolved):** an earlier version of `dashboard-queries.integration.test.ts`'s
`afterAll` ran `prisma.pricingRule.deleteMany({ where: { id: expiredRuleId } })` after a
`beforeAll` hook timeout had left `expiredRuleId` as `undefined`. Prisma treats `{ id: undefined }`
as "no filter," so that call deleted all 18 real seeded `PricingRule` rows instead of the one
fixture row. Caught immediately via a routine post-test row-count check, root-caused, the 18 rows
were restored with the original seed values, and **every `deleteMany` in every
`*.integration.test.ts` file now guards against undefined ids first** (`if (id) await
prisma.x.deleteMany(...)`) — see the comment at the top of each file's `afterAll`. Verified with
two consecutive full `npm test` runs (53/53 both times) and a database row-count check after each.
If you add a new integration test with its own `afterAll`, follow the same guard pattern — do not
call `deleteMany` with a possibly-unset id.

The schema itself has also been validated directly via raw SQL: a full FK chain (Brand → Category
→ MasterProduct → ProductVariant → SupplierProduct → SupplierVariantOffer →
SupplierWarehouseInventory, plus a PricingSnapshot and SupplierSyncJob) was inserted and cleaned
up against the live project, confirming every constraint, JSONB column, decimal column, and array
column holds together correctly.

## Live staging database

A real Postgres database exists: Supabase project **maple-imprint-catalogue**
(`ovqkwedpwmuusnijbxro`, region `ca-central-1`, free tier — $0/month). The full schema
(`prisma/migration_init.sql`, generated from `prisma/schema.prisma` and applied via Supabase's
migration tool) is live there, with **RLS enabled and no anon/authenticated policies on every
table** — deny-all to the public API key, full access preserved for service-role/direct
connections only. It's seeded with the four known suppliers (SanMar, S&S Activewear, Joto active;
Condé present but `isActive: false` pending the client's decision) and all 18 `PricingRule` rows
from the client's cost sheet (apparel/hat/mug × 6 quantity tiers each).

`DATABASE_URL` is now configured in a local `.env` (git-ignored, never commit it). Important
gotcha hit while setting this up: the **direct** connection string
(`db.<ref>.supabase.co:5432`) only resolves to an IPv6 address, and this machine has no IPv6
route out, so it fails with `Can't reach database server`. Use the **Session pooler** connection
string instead (Supabase dashboard → Connect → Direct connection string panel → Connection
Method → Session pooler) — host like `aws-0-<region>.pooler.supabase.com`, same password, works
over plain IPv4. That's what `.env` points at.

Ongoing schema changes should go through Supabase's migration tooling (or `prisma migrate diff`
to generate SQL, applied the same way `migration_init.sql` was) rather than `prisma migrate dev`
directly.

## What's intentionally NOT built yet

- Real SanMar/Joto/Condé connectors — no account/API access confirmed for these three yet
  (S&S Activewear is now DONE — see above). Building each remaining one is purely a matter of
  implementing `SupplierConnector` once credentials and API access exist, following the same
  pattern as `src/integrations/suppliers/ssactivewear/`.
- S&S order submission and shipment tracking — connector exists but these two methods are
  deliberately untested against the live account (see above).
- Cloud storage upload for validated images (S3/Cloudflare/etc) — needs real storage credentials.
  `ingestImage()` stops right before this step; wiring in a real client is a small, isolated
  addition once credentials exist.
- Legal confirmation that supplier image redistribution is permitted (see architecture doc §
  "Image Integration Strategy") — get this in writing per supplier before ingesting real images at
  scale, independent of whether the pipeline is technically ready.
- Any UI (admin dashboard, storefront). This package only produces data; nothing here renders a
  page.
- Order submission / shipment tracking (Phase 8 territory).

## Why this is separate from the website

`mapleimprint-redesign` (the parent repo) is explicitly a front-end-only build — see its
`PROJECT_NOTES.md` §3: the commerce architecture decision (headless + existing WooCommerce backend
vs. WooCommerce rebuild vs. Shopify migration vs. fully custom commerce) has **not been made**, and
is gated behind an audit of the current backend that hasn't happened yet.

This package doesn't need that decision to exist. Supplier normalization, sync safety, dedup, and
pricing are the same problem regardless of which platform eventually serves the storefront — this
becomes the thing that feeds product/price/inventory data into whichever platform gets chosen,
via that platform's API, once Gate A is resolved. Keeping it separate means none of this work is
at risk of being thrown away by that decision.

## Running it

```bash
npm install
npm test              # runs the full suite; hits the live DB if DATABASE_URL is set in .env
npx prisma generate   # validates the schema, generates the Prisma client
```

`.env` (git-ignored) already has a working `DATABASE_URL` pointed at the Session pooler — see
"Live staging database" above if it needs to be recreated.

## Next steps (see the architecture doc's phased plan)

Everything buildable without external input — schema, staging pipeline, both dedup paths, pricing
engine, mock connector, admin dashboard read layer, image-ingestion pipeline, package
export/build config — is done and proven against the real database. Deliberately **not** started:
multi-supplier sourcing recommendations, checkout revalidation, and product substitution — the
architecture doc itself warns these are premature without real supplier data to test against, so
building them now would just be speculative code. What's left is blocked on things outside this
codebase — see "What I need from you" at the very bottom.

## Security

- `credentialsRef` on `Supplier` is a pointer into a secrets manager — never store a real API key
  or password in this database or in `.env`.
- `rawPayload` fields (JSONB on `SupplierProduct`) may contain supplier wholesale pricing. Treat
  the database itself as sensitive; never expose these fields to the browser or index them
  publicly.

## What I need from you (client/business decisions — nothing further to build until these land)

1. **~~Supplier API/account access~~ — S&S Activewear DONE** (real connector built and verified
   live, see above). **Still needed: SanMar, Joto, Condé.** SanMar is next priority — see
   "Supplier research findings" below. **Ready-to-send email drafts exist at
   [`OUTREACH_DRAFTS.md`](./OUTREACH_DRAFTS.md)** — copy, fill in the account number, send.
2. **Confirm whether Condé is needed** — currently seeded but `isActive: false`.
3. **Answers to the pricing-model questions** — markup basis, per-supplier margins, setup fees,
   etc. (the architecture doc's 30-question list). Each answer becomes a `PricingRule`/
   `MarkupRule` row, not a code change.
4. **The Gate A commerce-platform decision** (Shopify / WooCommerce / custom / headless) —
   determines where this data eventually gets pushed.
5. **Cloud storage account** (S3 or Cloudflare) for real product images, once there are real
   images to ingest.
6. **Written confirmation from each supplier** that image redistribution is permitted under the
   wholesale account terms.

## Supplier research findings (2026-08-02, from public sites — no account access yet)

Public-site reconnaissance for all four suppliers (owner-provided links: sanmarcanada.com,
ssactivewear.com, jotoimagingsupplies.ca, conde.com). This is desk research from what's publicly
visible, not confirmed via an actual account — treat as a starting point for the outreach in
"What I need from you" #1, not as verified integration specs.

**[`SUPPLIER_RESEARCH.md`](./SUPPLIER_RESEARCH.md) has the deep-dive**: full product category
lists, brand rosters (~90 brand names across all four), private-label product lines (Joto's Pearl
Coating/Paropy/Multicut), distribution center locations, and cross-supplier observations useful
for the dedup matcher later (e.g. ChromaLuxe/Unisub are industry-standard brands likely to recur
across suppliers). Deliberately **not** seeded into the live database — real API responses will
have canonical brand/category names that should be the source of truth, not guesses from
marketing copy. The summary below is the short version.

**SanMar — best-documented, contact first.** Runs a public "Electronic Integrations" program with
versioned Web Services Integration Guides (PDF, currently v24.3 / Feb 2026) covering Product
Info, Pricing, Inventory, Invoicing, and Purchase Ordering, **plus PromoStandards support**
(Product Data 1.0.0, Inventory V1.2.1, Order Shipment Notification V1.0.0 — an industry-standard
API spec used across the promo-products industry, so a PromoStandards-based connector could
plausibly work with more than one supplier down the line). Contact to start:
**sanmarintegrations@sanmar.com** or 206-727-6458. Auth uses the existing SanMar.com account
login once onboarded. **Unconfirmed: whether this applies identically to SanMar Canada** or needs
separate Canada-specific onboarding — ask this explicitly when reaching out.

**S&S Activewear — DONE, connector live against real data.** Real REST API at
`api-ca.ssactivewear.com/v2`, confirmed working end-to-end with MapleImprint's actual dealer
account (C05087). See `src/integrations/suppliers/ssactivewear/README.md` for the full
verification log. This is no longer speculative — full details above under "Status."

**Joto Imaging Supplies — likely Shopify-based, no public API found.** URL structure
(`/collections/...`, `/pages/...`) strongly suggests the storefront runs on Shopify. No developer
API or integration docs found anywhere publicly. Wholesale access appears to be a credit
application process (~3 week approval), not an API signup — plan for this one to mean a manual
CSV export or a direct conversation about whatever data-feed options they actually offer, not a
self-serve API like SanMar/S&S.

**Condé Systems — no API, but publicly shows pricing.** No developer/API resources found;
reads as a standard e-commerce storefront rather than a wholesale integration platform. Notably,
unlike SanMar/S&S (which hide pricing behind login), **Condé's pricing is publicly visible on the
site** — a data point suggesting a more retail-shaped catalogue than the other three, worth
factoring into the "do we need Condé" decision (item #2 above).

**Bottom line:** contact SanMar before S&S when pursuing item #1 above — reach out to
`sanmarintegrations@sanmar.com` first.
