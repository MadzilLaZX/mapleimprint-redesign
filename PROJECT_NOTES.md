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
  a real `POST /api/quote` round trip, and a generated reference number. It does not yet send
  email or write to a CRM — see Missing Inputs.
- The general inquiry form and order-tracking form are likewise real client/server round trips.
  Order tracking honestly reports "not found" for every lookup, since there is no order backend
  to check against yet — it does not fabricate order data.
- Sitemap, robots.txt, per-page metadata, Open Graph image, and Organization/LocalBusiness
  JSON-LD are all generated from real routes/data (see caveat on NAP data below).
- Real client-provided cover photography is in for all 8 product categories
  (`public/images/products/*.jpg`, sourced from `Mapleimprint LTD/Products/`) and 4 of the 6
  "Popular right now" picks (`public/images/popular/*.jpg`). These appear on the homepage bento
  grid, the `/products` grid, the `/products/[category]` cover banner, and the homepage popular
  rail. Originals were ~2.2MB PNGs each; `scripts/import-cover-photos.js` resizes/compresses them
  to web-appropriate JPEGs (~180-250KB) — re-run it if new source exports are dropped in.

Placeholder, clearly scoped as such:
- Everywhere else, photography is Lorem Picsum placeholder imagery, unified under one
  brand-consistent duotone treatment (`.img-brand` in `globals.css`) so it doesn't clash with the
  locked palette. This includes 2 of 6 "Popular right now" picks (tumblers, stickers — no cover
  photo provided yet), the "Our Work" gallery, subcategory tiles within each category page, and
  hero/about/solutions imagery. Swap in real photography as it's provided, following the pattern
  in `src/lib/constants.ts` (`cover` field) and `PopularCategories.tsx`.
- Category/solution/print-method copy is honest and non-fabricated, but not yet reviewed or
  approved by the client, and contains no real pricing (by design — see non-negotiable #4 in
  the master prompt: never imply pricing without a real product/pricing model behind it).
  "Our Work" explicitly labels itself as placeholder pending real project photography.
- Every page under `/policies/*` displays a visible "draft, pending legal review" banner. None
  of that legal copy should be treated as final or published as-is.
- Business phone/email/address used in the footer, contact page and JSON-LD
  (`(613) 555-0142`, `hello@mapleimprint.ca`, "Ottawa, Ontario, Canada") are placeholders
  matching the brief's example data, not verified real business details.
- `/account` is a sign-in gate (visibly disabled) rather than a working auth system.

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
- Verified legal business name, address, phone, email, hours, and pickup instructions.
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

## 7. Suggested next phases

1. Get authorized staging/admin access and run the full Phase 0 audit the master prompt
   describes (URL inventory, backend inspection, customizer audit).
2. Make the architecture decision (Gate A) with real backend constraints in hand.
3. Replace placeholder content module-by-module (`src/lib/constants.ts`, `src/lib/faq.ts`,
   `src/lib/solutionDetails.ts`, `src/lib/printMethodDetails.ts`) with client-approved copy
   and a real product data source.
4. Wire `/api/quote` and `/api/contact` to real email/CRM delivery.
5. Replace placeholder photography.
6. Legal review of everything under `/policies/*`.
7. Full accessibility (manual screen reader + axe) and performance (Lighthouse/CWV) passes
   against real content and images.
