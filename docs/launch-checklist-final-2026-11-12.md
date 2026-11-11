# Final launch checklist

As of commit `30cb9ad` (catalog promoted to development/Preview, not Production).

## Ready

- Checkout/payment pipeline: Square Sandbox integration, atomic payment-confirmation function,
  order/line creation, idempotency -- verified across every prior round.
- Catalog: reconciled pricing (1,769/1,769 products, zero mismatches), real supplier shipping
  weights, descriptions, categories, images (except S&S CDN, see below) -- promoted to
  development/Preview.
- Weight → shipping integration: built, tested, wired into `CanadaPostShippingProvider` (still
  inactive). No further code needed once Gate 1 below clears.
- Owner/customer notification logic: built, tested, isolated so one failing independently of the
  other. `OWNER_NOTIFICATION_EMAIL` deliberately unset -- needs only an address, not code.
- GST/HST calculation: fully built (`CanadianSalesTaxProvider`, real CRA rate table), **not
  activated** -- one-line swap once the business decision below is made. No API/credential
  needed; this is a static rate table, not a live lookup service.
- Admin auth, order management, design/artwork persistence, mobile responsiveness: verified in
  earlier rounds, unchanged this round.
- Our own image ingest/validation pipeline (`ingestImage`/`validateImage` in catalogue-engine):
  built and tested (fetch → content-type check → corruption/dimension validation → checksum
  dedup). Stops right before a cloud-storage upload step that was never wired to real credentials.

## Needs business-owner approval (no credential, your decision only)

- **GST/HST activation**: confirm Maple is actually GST/HST-registered (and separately, QST-
  registered if selling to Quebec) before flipping `taxProvider.ts`'s one-line swap. An
  accountant should also re-verify the current rate table against the CRA's published rates.
- **`OWNER_NOTIFICATION_EMAIL`**: the real inbox address for new-order/new-lead alerts. Not
  invented by design.
- **Canada Post ship-from address**: confirm "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9"
  (already shown in the site footer) is the real shipping-origin facility.
- **Catalog pricing**: the ~13% median increase is live on development/Preview now, pending your
  decision on when/whether to promote to Production.
- **Production promotion itself** -- separate approval, not covered by anything in this round.

## Needs external credentials (cannot be obtained or faked by Claude)

| Service | Exact credentials/info needed | Source |
|---|---|---|
| **Square (production payments)** | Production `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID` (all different from the sandbox values currently in `.env.local` -- confirmed `NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox` today), plus a production `SQUARE_WEBHOOK_SIGNATURE_KEY` matching a webhook subscription configured for the Production domain in Square's own dashboard. | Square Developer Dashboard, production app |
| **Canada Post** | Developer Program / Commercial account, API key, customer number, contract ID (if using negotiated rates). Zero `CANADA_POST_*` vars exist today (confirmed by grep). | Canada Post Developer Program |
| **GST/HST/QST** | Not a credential -- see business-approval section above. No external service call is involved. | N/A |
| **Owner notifications (email)** | `RESEND_API_KEY` + a verified sending domain already set up per `AUTOMATION.md` -- only the recipient address (`OWNER_NOTIFICATION_EMAIL`) is still missing, which is a business decision, not a credential. | Resend dashboard (if not already done) + you |
| **S&S Activewear images** | See dedicated section below. | S&S Activewear |

## S&S Activewear image access -- what only the supplier can fix vs. what's already ready on our side

**Supplier-only (cannot be resolved from our side at all):**
- The Cloudflare 403 blocking hotlinked/unauthorized image requests from `cdn.ssactivewear.com`
  is S&S's own access control. Only S&S can grant a referrer allowlist, an authorized API/media
  endpoint, or explicit permission to download and rehost their images. A request is already
  drafted and has been awaiting your send since an earlier round (per
  `launch-readiness-report.md`) -- this hasn't changed and isn't something I can push forward
  further without your action to actually contact S&S.

**Already ready on our side, waiting only on the above:**
- The ingest/validation pipeline (`catalogue-engine/src/images/ingest.ts`,
  `validate.ts`) is fully built and tested -- fetch, content-type check, corruption/dimension
  validation, checksum-based deduplication. It deliberately stops right before a real
  cloud-storage upload (by design -- no S3/Cloudflare R2/etc. credentials have ever been
  configured for this, a separate, smaller gap from the S&S access issue itself).
- **Important clarification found while compiling this list**: the live catalog export
  (`export-products-for-frontend.mjs` and its REST-based counterpart) has never actually been
  wired to use a re-hosted `cachedUrl` at all -- every product's images (SanMar's included) are
  exported using the supplier's own `sourceUrl` directly, hotlinked at render time. SanMar's CDN
  simply doesn't block this; S&S's does. Resolving S&S's access (or building out the rehosting
  pipeline regardless) would require also updating the export script to prefer `cachedUrl` when
  present -- a real, scoped, not-yet-started code task, separate from the supplier negotiation
  itself. Flagging this now rather than letting it surface as a surprise once S&S responds.

## Must be tested before accepting real payments

- A complete real Square Production transaction, start to finish, on Preview with production
  keys in a controlled test (small real charge, refunded) -- never attempted this engagement,
  deliberately, per standing "no real payments" instruction.
- Square webhook delivery against the Production webhook URL specifically (Preview and
  Production have different `SQUARE_WEBHOOK_NOTIFICATION_URL` values) -- confirm signature
  verification works end-to-end before trusting it for a real order.
- If GST/HST is activated: a handful of real orders to provinces with different tax types (HST,
  GST+PST, GST-only) to confirm the correct amount is charged and appears correctly on the Square
  receipt/order.
- If Canada Post is activated: a handful of real addresses compared against Canada Post's own
  public rate-estimate tool before the first real customer order relies on it.
- Admin order view showing a real production order correctly, including correct totals, tax
  breakdown (if active), and shipping method.

## What this round did NOT do (explicitly out of scope, per instruction)

- No deploy to Production.
- No payment collection activated.
- No universal free shipping introduced as a Canada-Post fallback -- confirmed
  `CanadaPostShippingProvider` still throws `ShippingRateUnavailableError` rather than silently
  defaulting to free/flat shipping if ever activated without full data.
- No paid service activated or charge incurred.
- No code change beyond what was already committed in `30cb9ad` -- no new bugs were found that
  warranted a fix this round.
