# Condé Systems — integration recon (2026-09-10)

First real investigation of conde.com beyond the surface "does an API exist" check.
No account login was used for this pass — all findings are from the public/anonymous site.
> **2026-09-10: the client decided NOT to do Condé.** This document is kept for reference
> only, in case that decision ever reverses. No Condé connector should be built.

## Headline

Condé has **no API and no pre-built data feed**, but the site is **completely open to
scraping** (no bot protection at all) and every product page carries **clean, complete
JSON-LD** structured data. A sitemap-driven scraper is entirely feasible. The main
unknown is pricing — public prices look like placeholders, not real dealer cost.

Contrast with Joto (see below / SUPPLIER_RESEARCH.md): Joto is hard-blocked by Cloudflare
at the IP level (the owner's own browser is blocked too, 2026-09-10) — no scrape path
exists there at all, only an outreach-for-a-feed path.

## Platform

- **DLSS ECommerce Templates** (classic ASP cart — sitemap generator signature
  "ECT Google Sitemap Generator v6 by DLSS").
- URL shapes:
  - Product: `https://www.conde.com/proddetail.asp?prod=<SKU>`
  - Category: `https://www.conde.com/products.asp?cat=<Name>&pg=<N>` (paginated, ~large
    product counts per category incl. cross-sell blocks)
  - `https://www.conde.com/sitemap.xml` — **complete**, one `<loc>` per product
- `robots.txt`: `User-agent: * / Allow: /` — nothing disallowed.
- Checked and **absent**: `GoogleBase.asp`, `froogle.asp`, `shopping.xml`, `products.xml`,
  `feed.xml`, `/g/feed`, `nextag.txt`, etc. — all 404. No merchant feed to piggyback on.

## What the sitemap gives us

- **1,715 product URLs** (`proddetail.asp?prod=`)
- **67 category URLs**
- Plus ~30 content/article pages.

This is the crawl seed — no need to walk category pagination if the sitemap is the
source of truth for the SKU list.

## Per-product data (anonymous)

Every product page has a `<script type="application/ld+json">` **Product** block:

| field | example (MUG15) | notes |
|---|---|---|
| `name` | "DyeTrans® Ceramic Mug - 15 oz" | HTML entities need decoding |
| `sku` / `mpn` | `MUG15` | matches the `prod=` code |
| `brand` | `Dyetrans` | sometimes `null` (e.g. SOCK46) |
| `description` | long HTML block | needs HTML-strip before storage/display (same XSS caution as the S&S import) |
| `image` | `images/prodimages/MUG15-LR_medium.jpg` | relative; also `og:image` absolute |
| `weight` | `{value: 1.09, unitText: "lb"}` | useful for shipping calc |
| `offers.price` | `"3.99"` | **USD**; see pricing caveat below |
| `offers.priceCurrency` | `USD` | |
| `offers.availability` | `InStock` / `OutOfStock` | **binary string only — no quantities** |
| `aggregateRating` / `review` | present | not needed |

Playwright-rendered price == JSON-LD price on every sample (MUG15 $3.99, 3001 $1.00,
SOCK46 $3.19) — **no client-side price rewriting**, so a plain HTTP + JSON-LD parse is
enough for attributes. No Playwright needed for the anonymous data.

## Pricing caveat — important

Public prices are **probably not real dealer/wholesale cost**. Tell: the "DyeTrans Morph
Mug" (`prod=3001`) shows **$1.00** — implausible for that product. Likely the real
wholesale price + quantity-break tiers are **dealer-login-gated**.

- The template has qty-break elements (`.detailqpqty` / `.detailqpprice`) and JS that
  populates them, but they were **empty for every anonymous sample** — consistent with
  dealer-gated pricing.
- Next step before any build: log in with the Maple Imprint Condé dealer account
  (the owner reportedly has one) and re-fetch 2–3 of these same SKUs to confirm what a
  logged-in session exposes (real price, qty tiers, and possibly stock quantities).

## Variants

Sampled products had **no variant dropdowns** (`proddropdown` / `optionname` absent).
Condé appears to use **one `prod=` code per colour/size** — each is its own page. That
maps cleanly to one `SupplierProduct` + one `SupplierVariantOffer` with no variant
explosion, unlike S&S.

## Currency

Condé is US-based, prices in **USD**. The pricing engine's currency-mismatch guard
(`calculatePrice`, expects CAD) will force `quote_required` on every Condé offer until an
FX policy exists. Open question for the client — does the Maple Imprint Condé account
bill in USD, and how should duty/FX/landed cost be handled for these goods?

## Recommended connector shape (if Condé is greenlit)

`src/integrations/suppliers/conde/CondeConnector.ts` — a **sitemap-driven scraper**:

1. `fetchProductCatalogue`: GET `sitemap.xml` → 1,715 `prod=` codes → GET each
   `proddetail.asp?prod=` → parse JSON-LD → map to `RawSupplierVariant`.
   ~1,715 light HTTP GETs per full sync; be polite (~1 req/s ≈ 30 min, or a small
   parallel pool). No documented rate limit.
2. `fetchPricing`: needs a **logged-in cookie jar** (dealer account) to get real cost +
   qty tiers. Store the Condé login in `.env` like the others.
3. `fetchInventory`: JSON-LD only gives InStock/OutOfStock. If the logged-in view shows
   quantities, use that; otherwise Condé is **binary-stock only** and
   `checkOrderAvailability` can't do size-curve math for Condé lines.
4. `submitOrder` / `getShipmentStatus`: no API — `NotImplementedError`, manual ordering,
   same as the untested S&S order path.

Effort estimate: smaller than S&S (no PromoStandards, no auth handshake, clean structured
data) once the dealer-pricing question is answered.

## Open questions for the client

1. **Is Condé actually in scope?** Still undecided. Its catalogue is sublimation
   hard-goods (mugs, metal/photo panels, ornaments, drinkware) — different product world
   from the S&S/SanMar apparel that's live now. Is this wanted now, or phase 2+?
2. Confirm the Condé **dealer login** and that it exposes real wholesale pricing + qty
   breaks (need to re-fetch sample SKUs logged in).
3. **USD pricing** — how should FX / duty / landed cost be handled for Condé goods?
4. Volume: 1,715 SKUs is a lot to publish. Curated subset first, or full import?
