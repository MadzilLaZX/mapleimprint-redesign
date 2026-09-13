# Maple Imprint — Project Notes

Condensed working notes for this rebuild. This is the front-end-first phase described in
`Maple_Imprint_Claude_Code_Master_Prompt.md` and the accompanying redesign strategy brief,
scoped down to what could be delivered and verified in this session. Treat this file as the
starting point for the fuller research/approval-gate process the brief describes, not a
replacement for it.

## 1. What this build is

A from-scratch, premium marketing and informational website for Maple Imprint Ltd., built with
Next.js (App Router), TypeScript, Tailwind CSS v4 and Framer Motion. It covers the full
information architecture from the brief — homepage, product categories, solutions, how it
works, our work, print methods, resources/FAQ, about, contact/quote flow, cart and account
shells, and a policy section — with a working multi-step quote intake (real client/server
round trip, no fabricated data).

It intentionally does **not** include: a live product catalogue/pricing engine, a design
studio/customizer, real checkout/payment, real customer accounts, or a chosen commerce backend.
Those require the architecture decision and client inputs described below.

## 2. Current-site findings (lightweight audit)

A full crawl/audit as specified in the brief (CURRENT_SITE_AUDIT.md, full URL inventory, backend
inspection) was not performed — that requires authorized staging/admin access this session
didn't have. A lightweight public check of `mapleimprint.ca` confirmed the brief's diagnosis:

- The live homepage is a supplier-catalogue dump: the "Shop Our Top Brands" section surfaces
  raw supplier SKUs directly to customers (e.g. "ATC™ EUROSPUN® RING SPUN TEE. ATC8000"),
  with no curated hero, no clear H1, and no stated positioning.
- The homepage alone contains 2,000+ outbound links, consistent with the brief's "catalogue
  overload" and "crawl waste" diagnosis.
- This confirms (rather than assumes) the brief's core call: don't reuse the old theme,
  navigation, or product presentation. This rebuild starts from a curated taxonomy (8 categories,
  6 solutions) instead of a raw supplier feed.

A full audit (broken links, duplicate categories, policy inconsistencies, customizer inspection,
backend data model) still needs to happen against an authorized staging environment before any
migration/redirect work can be planned.

## 3. Architecture decision — status: not yet made

The brief requires comparing four paths (headless + existing backend, WooCommerce rebuild,
Shopify migration, fully custom commerce) **after** auditing the current WooCommerce backend,
customizer plugin, product data and order history. None of that access was available this
session, so no commerce architecture has been chosen.

This build is deliberately compatible with any of the four options: it's a standalone front-end
with no assumptions baked in about the commerce backend. Product/category/solution data currently
lives in `src/lib/constants.ts` as static, honest placeholder content (no invented prices, no
fake SKUs) so it can be swapped for a real data source (headless CMS, WooCommerce REST/Store API,
Shopify Storefront API, or a custom service) without restructuring the UI.

**This decision still needs to happen** before Phase 6 (commerce/personalization) work begins,
per the brief's Gate A.

## 4. What's real vs. placeholder in this build

Real / functional:
- Full responsive, accessible design system (colors, type, motion, components).
- All 34 routes render, build cleanly (`npm run build`), pass lint and typecheck.
- The quote request flow (`/contact`) is a genuine 7-step wizard with client validation,
  a real `POST /api/quote` round trip, and a generated reference number
  (`MI-YYYYMMDD-####`). Submissions are scored/tagged, appended as a row to a Google Sheet,
  and trigger a customer confirmation email, an owner notification email, and a Telegram alert
  (Resend + Google Sheets/Drive, see `AUTOMATION.md`). The Files step uploads real bytes to a
  Google Drive folder via `POST /api/upload` rather than only capturing file names. All of this
  degrades gracefully (submission still succeeds, still returns a reference) if those third-party
  accounts aren't configured — see `AUTOMATION.md`'s "Degrades gracefully" section.
- The general inquiry and appointment forms go through the same scoring/save/notify pipeline
  (`src/lib/automation/`). Order tracking is unchanged: it honestly reports "not found" for every
  lookup, since there is no order backend to check against yet — it does not fabricate order data.
- `/contact` now has four tabs (`src/components/contact/ContactTabs.tsx`): Location, Get a
  Project Quote, Book an Appointment, General Inquiry. Location reveals a Google Maps embed
  (`google.com/maps?q=...&output=embed`, no API key required for this basic query-based embed)
  plus deep links to Google Maps, Waze and Apple Maps built from the real address. Appointment
  is a custom month calendar (Sundays and past dates disabled) plus six hourly slots from
  12pm-6pm, using the maple gradient for the selected date/time (dark text on the gradient fill,
  same accessible pattern as the primary Button — see the contrast note below), backed by a real
  `POST /api/appointment` round trip. Neither the map embed nor the appointment slots check a
  real calendar for conflicts yet — see Missing Inputs.
- Sitemap, robots.txt, per-page metadata, Open Graph image, and Organization/LocalBusiness
  JSON-LD are all generated from real routes/data (see caveat on NAP data below).
- Real client-provided cover photography is in for all 8 product categories
  (`public/images/products/*.jpg`, sourced from `Mapleimprint LTD/Products/`), all 33 of their
  subcategory tiles (`public/images/products/subcategories/<category>/<subcategory>.jpg`,
  matched to `PRODUCT_CATEGORIES[].subcategories` names via `slugify()` in `src/lib/slugify.ts`
  — reuse that helper rather than hand-writing paths, so filenames always stay in sync with the
  constant), 4 of the 6 "Popular right now" picks (`public/images/popular/*.jpg`), all 6
  `/solutions` cards and detail heroes (`public/images/solutions/*.jpg`), the About page hero,
  the full 12-photo `/our-work` gallery, and all 6 tiles in the homepage's "materials behind
  every order" preview (`OurWorkPreview.tsx`, all reusing/extending `public/images/our-work/*.jpg`
  — real photos there get plain `object-cover`, no `.img-brand` filter). Originals were
  ~1.8-2.5MB PNGs each; the various `scripts/import-*-photos.js` scripts resize/compress them to
  web-appropriate JPEGs (~35-275KB) — re-run the relevant one if new source exports are dropped in.
- The `/our-work` masonry is built as three explicit column arrays (`columns` in
  `src/app/our-work/page.tsx`), not one flat list fed through CSS `columns-3`. That layout
  balances by cumulative height, not source order, so it wouldn't reliably put a given photo in
  a given column — explicit column arrays are the only way to control exact placement.
- A real, working shop and cart: `/shop` lists all 33 subcategory-derived products
  (`src/lib/shopProducts.ts` — one product per subcategory, since that's the honest grain of
  detail available without a real SKU/pricing catalogue), filterable by category and
  subcategory via chips and via `?category=`/`?subcategory=` query params. A category page's
  cover photo (`/products/[category]`) is now a full-bleed link button to `/shop?category=...`,
  and each subcategory tile links to the matching filtered shop view. "Add to Cart"
  (`src/components/cart/CartProvider.tsx`) is a real client-side cart persisted to
  localStorage, with a live count badge on the header's cart icon. There's deliberately no
  price anywhere in the shop or cart — per non-negotiable #4, there's no real pricing model to
  show one truthfully. Instead, the cart's "Get a quote for these items" button hands a plain
  summary string to the QuoteWizard via a one-shot `sessionStorage` key
  (`QUOTE_PREFILL_KEY` in `CartProvider.tsx`) that prefills the quote form's product
  description field on mount.
- Every interior page (everything using `PageHeader`, i.e. everything except the homepage) has
  a "Back" button (`src/components/ui/BackButton.tsx`, `router.back()`) at the top of the dark
  header band, below the sticky site header so it never competes with the logo/nav.
- The homepage's "Popular right now" rail (`PopularCategories.tsx`) has a single scroll arrow
  (right by default; flips to left once the rail reaches its end, never both at once), driven by
  a `scroll` listener on the rail ref rather than a fixed step count, so it stays correct if picks
  are added/removed.
- Print methods (`PRINT_METHODS` in `constants.ts`) are DTF & DTG Printing, Sublimation, Paper &
  Large Format and Laser Engraving — Screen Printing and Embroidery were removed sitewide (they
  aren't actually offered) and every copy reference (`/print-methods`, category pages, homepage
  preview, FAQ, resources, quote wizard placeholder, SEO keywords) was updated to match.

**Lesson learned — scroll-triggered reveals don't suit variable-height interactive grids.**
The shop's product grid initially reused the `RevealGroup`/`RevealItem` pattern (Framer Motion
`whileInView`, `amount: 0.2`) used elsewhere on the site. For a short, fixed grid (e.g. the 4 print
methods) that's fine. For a tall, filterable grid (33 products across ~9 rows), `amount: 0.2`
means 20% of the *entire grid's* height must be on-screen before anything fades in — on load,
only the top slice is visible, so the whole grid could sit at `opacity: 0` indefinitely without
a large scroll. Confirmed via a headless browser check that images were present in the DOM but
stuck at `opacity: 0` well above the fold. Fixed by switching to a mount-triggered stagger
(`initial`/`animate`, not `whileInView`), keyed by the active filter so it also replays on
filter changes. Rule of thumb: use `whileInView` reveals only for content whose full height
reasonably fits near the viewport; use mount-triggered animation for anything tall,
paginated, or filterable.

Placeholder, clearly scoped as such:
- Everywhere else, photography is Lorem Picsum placeholder imagery, unified under one
  brand-consistent duotone treatment (`.img-brand` in `globals.css`) so it doesn't clash with the
  locked palette. This is now down to 2 of 6 "Popular right now" picks (tumblers, stickers — no
  cover photo provided yet). Swap in real photography as it's provided, following the pattern in
  `src/lib/constants.ts` (`cover` field) and `PopularCategories.tsx`.
- Category/solution/print-method copy is honest and non-fabricated, but not yet reviewed or
  approved by the client, and contains no real pricing (by design — see non-negotiable #4 in
  the master prompt: never imply pricing without a real product/pricing model behind it).
  The `/our-work` gallery now shows real branded product photography, but it's still brand/product
  photography rather than a specific client's finished project — the page copy is careful to say
  real client project galleries and reviews will join later, not claim these already are that.
- Every page under `/policies/*` displays a visible "draft, pending legal review" banner. None
  of that legal copy should be treated as final or published as-is.
- `/account` is a sign-in gate (visibly disabled) rather than a working auth system.

Business contact details (address, phone, email, hours) are now the client's real, provided
values, centralized in `BUSINESS` / `BUSINESS_ADDRESS_ONE_LINE` in `src/lib/constants.ts` and
consumed by the footer, the contact page, the Location and Appointment panels, and the
Organization/LocalBusiness JSON-LD in `layout.tsx`. Update that one object if any of it changes.

## 4a. Header behavior and page transitions

- The header nav shows a "Home" tab only when off the homepage, and hides the "Start Designing"
  CTA while already on `/products*` (it links there, so it's redundant on that section). Both
  animate in/out (`src/components/layout/Header.tsx`) using `AnimatePresence mode="popLayout"`
  plus `layout` on the nav `<li>`s, so siblings smoothly reflow instead of snapping.
- Site-wide page transitions (`src/components/layout/PageTransition.tsx`, wrapped around
  `{children}` in `layout.tsx`) use a **manual crossfade**, not `template.tsx` + `AnimatePresence`
  keyed by pathname. That more "standard" approach was tried first and confirmed, via
  instrumented testing, to not animate at all on client-side navigation in this Next.js version
  (the route swap happens outside a lifecycle AnimatePresence can intercept for exit animations).
  The working approach keeps a local `displayed` snapshot in state and only swaps it to the new
  `children` after playing an exit animation itself, so it doesn't depend on Next's router
  internals. Verified with real screenshots mid-transition (style/opacity polling via
  `getComputedStyle` is unreliable for this — it doesn't reflect the true animated value; a
  screenshot does).

## 5. Accessibility notes worth keeping

- Contrast audit: Maple Orange (`#FF6A00`) measures ~2.9:1 against white/canvas — it fails
  WCAG AA even at large-text/UI-component thresholds (needs 3:1) and fails badly for body text
  (needs 4.5:1). The master brief explicitly warns against orange body text on white, and this
  confirms it numerically. **Rule applied throughout:** Maple Orange is only used as text/icon
  color on dark (`ink-950`) backgrounds, or as a filled background with dark text on top
  (buttons, step indicators). On light backgrounds, Crimson (`#D41414`, ~5.4:1 on white) is used
  instead for the same accent role. Keep this rule for any new component.
- Global `prefers-reduced-motion` handling in `globals.css` plus per-component
  `useReducedMotion()` checks in `Reveal`/`RevealGroup`/`RevealItem`.
- Skip-to-content link, semantic landmarks, labelled nav regions, visible focus states
  (`:focus-visible` outline), and label/error association on all form fields.
- Not yet done: a manual screen-reader pass and automated axe/Lighthouse run, which the brief
  requires before launch.

## 6. Missing inputs (blocking a real launch — condensed from the brief's section 15)

- Admin/staging access to the current WooCommerce site, customizer plugin, hosting and database.
- A real scheduling backend for the Appointment tab (the current 12-6 slots and calendar are not
  checked against actual staff availability, and the map embed's basic query-based mode should
  move to a proper Google Maps Embed API key before launch, for reliability/quota reasons).
- Real product catalogue with accurate pricing rules (what's included, minimums, bulk tiers,
  setup/rush fees, taxes).
- Real production/shipping timelines per product and decoration method.
- Return, defect, cancellation, artwork and proof policies reviewed by a qualified advisor.
- Payment provider, deposit/invoicing rules.
- Real finished-work photography, shop/process photography, and any testimonials/client logos
  with permission to publish.
- Brand assets in vector format (the two PNG/JPEG logo files provided were rasterized into a
  clean transparent lockup for this build — see `scripts/process-logo-variants.js` — but a
  vector source would be more durable long-term).
- Search Console, Analytics, Google Business Profile, Merchant Center access.
- Live Resend, Google Cloud service account (Sheets + Drive) and Telegram accounts/credentials to
  activate the contact automation built in this session — the code is in place and degrades
  gracefully without them, but no real email/lead-log/alert will go out until someone sets these
  up per `AUTOMATION.md`.

## 7. Suggested next phases

1. Get authorized staging/admin access and run the full Phase 0 audit the master prompt
   describes (URL inventory, backend inspection, customizer audit).
2. Make the architecture decision (Gate A) with real backend constraints in hand.
3. Replace placeholder content module-by-module (`src/lib/constants.ts`, `src/lib/faq.ts`,
   `src/lib/solutionDetails.ts`, `src/lib/printMethodDetails.ts`) with client-approved copy
   and a real product data source.
4. `/api/quote`, `/api/contact` and `/api/appointment` are now wired to real
   email/lead-log/Telegram delivery via `src/lib/automation/` — see `AUTOMATION.md` for the
   Resend/Google Cloud/Telegram account setup needed to actually activate delivery. Still open: a
   dashboard beyond the spreadsheet itself (status changes/notes are manual sheet edits for now),
   and converting the quote wizard's free-text quantity/budget fields to the original spec's
   dropdown tiers for more precise lead scoring.
5. Replace placeholder photography.
6. Legal review of everything under `/policies/*`.
7. Full accessibility (manual screen reader + axe) and performance (Lighthouse/CWV) passes
   against real content and images.

## 8. Related subsystem: `catalogue-engine/` (supplier catalogue, inventory sync, pricing)

A second, independent piece of work lives at `catalogue-engine/` in this same repo: a
supplier-independent product catalogue, inventory-sync, and dynamic-pricing engine, covering the
business problem described in the client's separate catalogue/pricing brief (normalizing SanMar,
S&S Activewear, Joto, and possibly Condé into one internal product model instead of four raw
supplier feeds).

It is **deliberately decoupled from this frontend and from the Gate A decision above** — it's a
standalone Node/TypeScript package with its own `package.json`, schema, and test suite, backed by
a real Supabase Postgres project (`maple-imprint-catalogue`, see `catalogue-engine/README.md` for
connection details). The reasoning: supplier normalization, sync safety, product deduplication,
and pricing calculation are the same problem regardless of which commerce platform Gate A lands
on (WooCommerce rebuild, Shopify migration, or custom) — so it can be built and proven now without
waiting for that decision, and becomes the thing that feeds product/price/inventory data into
whichever platform gets chosen, via that platform's API, once Gate A resolves.

**Status as of 2026-08-02:** Phase 1 (schema, staged sync with safety-stop thresholds, product
dedup with a full auto-approve/needs_review/reject flow, pricing engine seeded from the client's
real cost sheet, admin dashboard read queries, image-ingestion pipeline short of cloud upload) is
complete and proven end-to-end — 75 tests passing against the live database, including real
integration tests, not just mocks. Blocked on: real supplier API/account access (the actual next
phase — see `catalogue-engine/README.md`'s "What I need from you" section for the full list),
plus several business decisions (Condé, full pricing rules, Gate A itself, image-storage/rights).

See `catalogue-engine/README.md` for full details — it's kept current and is the fastest way to
get back up to speed on that subsystem.

**2026-09-13 size guide + background removal (Priorities 1-3 and 6 of the size/asset-expansion
brief):** researched, then built what's honestly buildable today; explicitly deferred what isn't.

- **S&S's `/v2/specs/` garment-measurement endpoint is real** (confirmed via public S&S API docs —
  `GET /v2/specs/?style=<id>`, same dealer Basic Auth already used, documented on the CA endpoint)
  but has never been called — the existing sync only ever pulled `/v2/products/`, which carries
  zero measurements (confirmed directly against every stored `SupplierProduct.rawPayload` row, not
  assumed). Built the full pipeline ready to receive real data the moment someone runs it with live
  credentials (none available in this environment): `SupplierProductSpec` table + Prisma model,
  `SSActivewearConnector.fetchSpecs()` (added as an *optional* method on `SupplierConnector` — not
  every supplier needs to implement it), `sync/normalizeSpecs.ts` (maps raw supplier spec labels to
  a small set of `NormalizedSpecType`s — **vocabulary is an educated guess, not observed from a
  real response**, flagged clearly in that file; verify and extend once real data lands), and
  `scripts/sync-specs.mjs`. `export-products-for-frontend.mjs` now also writes
  `src/lib/generated/sizeSpecs.json` (currently `{}` for every product, honestly, since nothing's
  been synced yet).
- **Size Guide ships today**, not gated behind a flag — `SizeGuidePanel.tsx`, wired into
  `ProductCustomizer.tsx` next to "Quantity per size." Shows a real measurement table (chest
  width/body length/etc., with an explicit "laid flat, not body circumference" clarification, a
  small diagram, and an IN/CM toggle) *only* when `sizeSpecs.json` actually has rows for that
  product slug — right now that's zero products, so every product honestly shows "Detailed
  measurements aren't available for this style yet" with an escape hatch to ask Maple directly,
  never a fabricated chart. Verified both code paths render correctly (temporarily injected fake
  spec data locally to confirm the structured-table path works, then reverted to the honest `{}`
  before committing — never shipped fake data).
- **Find My Size (fit recommender) deliberately NOT built.** The brief's own Priority 3 already
  ruled out a height/weight/age estimator as irresponsible without real fit data, and pivoted to a
  "measure a shirt you own" comparison against real garment measurements — which needs the same
  synced spec data Size Guide needs, which doesn't exist yet either. Building the UI now would mean
  it's empty/non-functional for literally every product on the site. Revisit once `sync-specs.mjs`
  has run for real.
- **Vexels: researched, not integrated.** No self-serve API (Enterprise-only, unpriced, unscoped),
  and their standard license never addresses the specific "end customer browses/selects inside a
  third-party app" pattern Studio needs — silence, not permission, the same gap that already ruled
  out Flaticon/Vecteezy. Do not build against Vexels without written confirmation from their
  Business team covering that exact scenario.
- **Photoroom Remove Background: built, server-side, degrades gracefully.**
  `/api/studio/remove-background` follows the exact same pattern as every other optional
  integration in this codebase (Resend/Google/Telegram) — missing `PHOTOROOM_API_KEY` env var
  → friendly "not available yet" message, never a raw vendor error, verified live (see screenshot
  history in the batch this shipped with). Original upload is never overwritten; the removed
  version is a separate derived file (`<original>-nobg.png` in the same Supabase Storage path),
  with a HEAD-request existence check before ever calling Photoroom again for the same source
  image — the customer can click the button repeatedly without Maple paying twice. Customer chooses
  "Use removed version" or "Keep original" from a side-by-side preview; nothing is swapped
  automatically.
- **Maple Templates and the Vexels/Noun asset library: not started.** No licensed graphic content
  exists to build either from — this is real design/licensing work, not something to improvise.

**2026-08-25 pricing-consistency audit (Priority 0 of the size/asset-expansion brief):** found and
fixed a real bug — the product page's top-of-page headline showed `product.startingPrice` labelled
"custom printed" (e.g. $31.33), while the customizer panel a few inches below it showed "Blank
$11.33 · Customize from $51.33" for the exact same product/quantity — two different numbers both
claiming to be the "customize" price, a $20 gap (exactly the design/setup fee) present in one
calculation and silently missing from the other. Root cause: `startingPrice`/`priceTiers` (from
the earlier catalogue pricing fix) represent blank-garment-plus-one-print-location and were never
meant to represent the *full* customize price once the Studio brief introduced a separate $20
design fee on top — but the product-page headline and the "Pricing by quantity" table kept reading
those fields directly and labelling them as if they were the final customized price.

Fixed by making `src/lib/studio/pricing.ts` (`blankUnitPrice()`/`calculateCustomizePrice()`) the
**only** place any customize-inclusive price is computed anywhere in the app — the product-page
headline (`ProductDetail.tsx`) and the "Pricing by quantity" table (`page.tsx`) now both call it
directly instead of reading `priceTiers`/`startingPrice` raw, so they're structurally unable to
drift from the customizer panel/Studio/Review/cart again (all of which already called this module).
Verified: headline, panel, and quantity table now show identical numbers at every quantity tier.
Shop cards and subcategory listing tiles were deliberately left untouched — they only ever claimed
"From $X / unit" (no "customized"/"printed" wording), so there was no false claim there to fix, and
their number is still the real, differentiated, wholesale-derived price the client confirmed is
working correctly; only the product detail page conflated two different definitions of the same
word.

Checked and confirmed clean elsewhere: no per-product JSON-LD/structured data exists yet to be
inconsistent (only site-wide `LocalBusiness` schema in `layout.tsx`) — worth adding real
`Product`/`Offer` schema off this same pricing module once the catalogue stabilizes further, noted
as a real SEO gap, not an inconsistency.

**2026-08-24 Studio expansion batch — responsive canvas fix, Surprise Me, left-chest location:**

- **Real bug fixed: the Studio/Review canvas clipped on narrower layouts.** Root cause was two
  compounding issues, both now fixed in `CanvasStage.tsx`/`ReviewPanel.tsx`: (1) a Konva `<Stage>`'s
  `width`/`height` are its actual pixel-buffer size, not CSS — wrapping it in a `max-width: 100%`
  div does nothing, since the canvas doesn't shrink on its own. Fixed with a `ResizeObserver` that
  measures the container and drives Konva's own `scaleX`/`scaleY`, which resizes the real pixel
  buffer (and keeps pointer coordinates correctly mapped, unlike a CSS transform). (2) Review's
  `grid md:grid-cols-2` children had no `min-width: 0`, so a grid item containing a
  fixed-intrinsic-width canvas couldn't shrink below that width — the container was *genuinely*
  520px wide even in a 375px viewport, overflowing the page. Verified against real pixel
  measurements (not just screenshots) across 375/768/1024/1440px, in both the editor and Review,
  confirming zero overflow at every width.
- **Product-page pricing language**: "Blank $X / unit · Customize from $Y" now shows even before a
  size is chosen (previously blank until qty > 0), and says "from" rather than a bare number —
  the customize total is the *current* configuration's price (front-only by default), not a fixed
  figure, since it changes live if the customer adds locations in Studio.
- **"Leave It to Us" → "Surprise Me — Designer's Choice"**: replaced the weak text-link with a
  genuinely distinct third tier — black card, gradient-accent border, ✦ mark, gradient CTA —
  matching Customize/Buy-Blank in visual weight without matching their exact treatment.
  `SurpriseMePanel.tsx` (replacing the old `LeaveItToUsPanel.tsx`) asks purpose/vibe/notes/upload/
  avoid, matching the brief's mystery-brief question set. `customizationType: "MAPLE_DESIGNER"`
  (renamed from `MAPLE_ASSISTED`) always funnels through the existing cart→quote pipeline and
  always ends in a digital proof before production — never blind printing.
- **Print locations expanded to three: Front, Back, Left Chest** — `src/lib/studio/printAreas.ts`
  now keys print-area geometry per location instead of one global box.
  `locationsFor(categorySlug)` only offers left-chest on real apparel (custom-apparel,
  workwear-uniforms) — hats/bags/aprons have no "chest." Left-chest deliberately reuses the front
  garment photo (a smaller print-area box positioned on the same image) rather than needing new
  photography. **Sleeve/collar/shoulder/upper-back were deliberately NOT added** — S&S's product
  photography here is front/back only, so there is no real image to show what a sleeve print would
  look like on a given garment, and Maple hasn't confirmed those positions are physically supported
  across the catalogue. Adding a location with no matching mockup would show a front-view photo
  while claiming to preview a different placement — see `printAreas.ts`'s comment for the full
  reasoning. `PRINT_AREA_TEMPLATE_VERSION` bumped to `v2-apparel-front-back-leftchest`.
- **Researched, not implemented (pending your decision):**
  - *Size Guide / Find My Size*: **no real per-garment measurement data exists anywhere in this
    system.** Checked the actual S&S `rawPayload` in the database directly — it contains only
    style/brand/description metadata, no chest-width/body-length/sleeve-length figures. Building
    either feature now would mean fabricating a size chart, which this project's own rules
    (and this brief's own instruction) explicitly forbid. Not built. Real next step: S&S's API
    likely has a separate size-chart endpoint that was never fetched during import — worth checking
    in a future catalogue-engine session before revisiting this.
  - *Ready-made design assets / clipart library*: researched Noun Project, Flaticon, Freepik,
    Vecteezy, Iconscout, Canva Connect, Creative Fabrica. **Important finding: Flaticon's and
    Vecteezy's licenses explicitly prohibit the exact workflow Studio needs** — embedding a library
    where the end customer selects an asset that ends up on a physical product. The Noun Project
    (API + NounPro subscription, ~$25/mo minimum) is the cleanest legally-defensible starting
    point; Iconscout is architecturally built for embedding but needs a direct licensing
    confirmation before committing. Not built — no licensed content exists to ship yet, and the
    brief explicitly says not to scrape or fabricate a library.
  - *Background removal*: researched remove.bg, Photoroom, Cloudinary, Slazzer, Clipdrop/Jasper,
    Pixian.ai, BRIA AI. **Recommendation: Photoroom API** ($20/mo + $0.02/image, ~300ms latency,
    best third-party accuracy score, explicit no-training-on-API-images policy, simple single-REST-
    call integration) with remove.bg as a documented fallback. Not built — this is a real recurring
    paid-vendor decision, not something to wire up without your sign-off.

**2026-08-20 Maple Studio MVP + product experience rebuild (Phase 2+ of the Studio brief):** the
biggest single addition to the site so far — a real, working design customizer, not a stub.

- **New runtime dependency:** the frontend now talks to a database at request time for the first
  time (`@supabase/supabase-js`, `src/lib/studio/supabaseClient.ts`). Everything else on the site
  is still static-JSON-only; this is scoped to Studio's own three new tables
  (`DesignProject`/`DesignSide`/`DesignObject`, migration `add_design_studio_tables` on the same
  `maple-imprint-catalogue` Supabase project) and a `design-uploads` storage bucket. Access uses
  the anon/publishable key (safe to ship in the client bundle, hardcoded rather than an env var —
  see that file's comment for why) with RLS policies scoping every row to the caller's
  `x-mi-session` header/cookie (`src/lib/studio/session.ts`) — an anonymous-session-ownership
  pattern, not Supabase Auth. Verified end-to-end against the live project, not just locally
  mocked: autosave round-trips really persist and really reload.
- **Product colour → image**: `ProductGallery.tsx` now shows the real supplier photo for whichever
  colour is selected (150-250ms crossfade, thumbnail sync, reduced-motion aware), instead of a
  static gallery that ignored colour selection entirely. 98.8% of colour/product pairs have a real
  matching photo (7,084/7,171, checked directly against the DB); the rest fall back to the
  product's default image with a visible "photo not available in this colour" note rather than
  silently showing the wrong garment.
- **Colour-change availability**: changing colour used to silently wipe every quantity you'd
  entered. Now only sizes that don't exist in the new colour get cleared, with an explicit message
  naming which size and why.
- **Product page action hierarchy**: replaced the single "Add to Cart" button with three real,
  independently-functional paths — Customize This Shirt (enters Studio), Buy It Blank
  (`customizationType: "BLANK"`, no $20 design fee, added straight to cart), Leave It to Us
  (`LeaveItToUsPanel.tsx`, a short brief + optional upload, `customizationType: "MAPLE_ASSISTED"`,
  reuses the existing cart → quote pipeline rather than a new lead-capture system). `CartView.tsx`
  now labels each line's customization type explicitly ("Blank — no printing" etc.) — the brief
  called this out as needing to be unmistakable.
- **Blank vs. customize pricing**: `src/lib/studio/pricing.ts` derives a pure blank-garment price
  algebraically from the *existing* `priceTiers` (`blankPrice = priceTiers[0].pricePerUnit -
  chartTier1Cost`) rather than adding a second pricing pipeline — the chart values it subtracts are
  the same public print-cost chart already duplicated once in `catalogue-engine`'s
  `seed-data.ts`; if that chart ever changes, both copies need updating. This is deliberately NOT a
  change to `priceTiers`/`startingPrice` themselves — the shop's "From $X" pricing from the
  previous fix is untouched.
- **Maple Studio MVP** (`/studio/[id]`, `StudioClient.tsx` + `CanvasStage.tsx`): react-konva-based
  (open source, no licensing decision pending — see the architecture report from this
  conversation for the full SDK comparison; upgrade path to Polotno stays open later since it's
  Konva-based). Real features, not stubs: upload (PNG/JPG; SVG deliberately deferred until it can
  be sanitized safely), text with font/size/colour, move/resize/rotate/delete/duplicate, full
  undo/redo, front/back sides, live price breakdown (blank + $20 design fee + chart printing cost,
  recalculated as sides gain/lose artwork), autosave with a real Saving/Saved indicator, a
  first-time onboarding choice, and a Review screen (read-only canvas preview, full price
  breakdown, Approve & add to cart). Verified with a full Playwright run of the real user journey:
  shop → View Item → colour change → quantities → Customize → Studio (correct product/colour
  already loaded, confirmed via screenshot) → add text → autosave confirmed saved → Review → Approve
  → real cart line with the right price. Print geometry is `src/lib/studio/printAreas.ts`'s
  `PRINT_AREA_TEMPLATE_VERSION = "v1-apparel-front-back"` — one representative print-area box
  applied to every apparel product, not real per-garment production measurements (documented there
  as a deliberate MVP simplification; stored on every DesignProject so a future real template
  doesn't retroactively shift existing designs).
- **Not built yet, by design**: real production-file rendering (server-side PDF/CMYK/vector
  export — Studio currently produces a preview, not a print master, exactly as the brief's Phase
  14 asked for architecture-not-implementation here), colour-changing inside an existing Studio
  session, per-product print-area calibration, an admin/staff order view, and everything in the
  original brief's Phase 9 ("Studio MVP → generalize across all product types").
- **Shop card CTA changed again**: "Customize" (from the previous pricing-fix batch) is now "View
  Item" — the catalogue is for discovering products; committing to Customize/Buy Blank/Leave It to
  Us happens on the product page once colour/size are chosen, not from the card. Near-black button
  by default, full Maple gradient only on hover/focus — reserving the strongest brand treatment for
  higher-intent actions per this batch's explicit visual-hierarchy note.

**2026-08-20 shop rebuild (Phase 1 of the Studio brief):** `/shop` was a fully client-filtered
blob (all products shipped to the browser, filtered in a `useState`) with misaligned cards on
uneven titles and an "Add to Cart" that silently added unconfigured items. Rebuilt as a real
server-rendered, paginated (24/page), sortable (featured/price asc/price desc — no fake "Popular"
or "Newest," since no real view-count or import-date data exists to sort by honestly), searchable
catalogue: `src/lib/shopQuery.ts` (URL-state helpers), `ShopFilters`/`ShopPagination` (server,
plain `<Link>`s — crawlable, no client JS needed), `ShopSearchInput` (client, debounced), `loading.tsx`
skeleton. Card CTA is now "Customize" linking to the real product page, not a cart mutation.
Sort/search URL variants are `noindex` and canonicalize back to the clean category URL; category/
subcategory/page URLs stay indexable and self-canonical. This was step 2 of a much larger brief
(full "Maple Imprint Studio" design-customizer product) — see the audit report delivered in
conversation for the full architecture plan; card/pricing/pagination was the "fix the shop before
building Studio" phase, Studio itself hasn't been started.

**2026-08-20 pricing fix:** every one of the 1,021 real products was showing an identical
placeholder-looking price ($20 apparel/workwear, $12 hats) — a real bug in the export pipeline
(it exported the decoration-cost chart as if it were the retail price, never touching real
wholesale cost or the 40% markup rule). Fixed and 848 products now show correct, varied,
wholesale-derived pricing; 173 honestly show `quote_required`. Full incident writeup, including a
false-alarm "the database lost all its data" scare that turned out to be Supabase restore lag, is
in `catalogue-engine/README.md`'s "2026-08-20: fixed a real pricing bug" section.

**Build note:** a separate, more recent change wired ~545 real S&S Activewear products directly
into the frontend as static routes (`src/lib/generated/products.json`, `src/lib/products.ts`,
`generateStaticParams` in `src/app/products/[category]/[subcategory]/[product]/page.tsx`) — over
600 static routes total. `next build`'s static-generation worker pool defaults to one worker per
CPU core, which OOM'd on this ~16GB dev machine (32 logical cores) once that many routes were
being generated concurrently. Fixed by capping `experimental.cpus: 4` in `next.config.ts` — bounds
peak memory at the cost of some build wall-clock time. Raise that cap on a machine with more RAM
per core, or investigate `--experimental-build-mode` if the route count keeps growing.
