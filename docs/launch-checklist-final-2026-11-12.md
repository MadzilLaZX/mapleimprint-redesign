# Final launch checklist

As of commit `30cb9ad` (catalog promoted to development/Preview, not Production). **Updated
2026-11-12 (round 2)**: GST/HST and shipping-provider work below reflects the owner's confirmed
decision to replace Canada Post with Chit Chats as the planned primary carrier, and the confirmed
final shipping policy (Canada-wide free shipping over $300, international excluded). **Updated
2026-11-12 (round 3)**: free-shipping eligibility is now additionally gated on confirmed carrier
serviceability, not address format alone -- see "Serviceability-before-free" below.

## Ready

- Checkout/payment pipeline: Square Sandbox integration, atomic payment-confirmation function,
  order/line creation, idempotency -- verified across every prior round.
- Catalog: reconciled pricing (1,769/1,769 products, zero mismatches), real supplier shipping
  weights, descriptions, categories, images (except S&S CDN, see below) -- promoted to
  development/Preview.
- Weight → shipping integration: built, tested, reused by both `CanadaPostShippingProvider` (now
  fallback) and the new `ChitChatsShippingProvider` (now planned primary) -- both still inactive.
  No further code needed once credentials for the chosen carrier arrive.
- Owner/customer notification logic: built, tested, isolated so one failing independently of the
  other. `OWNER_NOTIFICATION_EMAIL` deliberately unset -- needs only an address, not code.
- GST/HST calculation: fully built (`CanadianSalesTaxProvider`, real CRA rate table), **not
  activated** -- one-line swap once the business decision below is made. No API/credential
  needed; this is a static rate table, not a live lookup service. Extended this round: tax is now
  computed on merchandise **plus the shipping charge** combined (a vendor-supplied delivery charge
  is taxed the same as the goods it delivers), and Ottawa local pickup applies Ontario's HST via a
  point-of-sale override regardless of the customer's own province/country. 14 automated tests
  cover Ontario, BC, Quebec, Alberta, international zero-rating, both pickup overrides, and
  rounding (`src/lib/checkout/taxProvider.test.ts`).
- Chit Chats shipping integration: `ChitChatsShippingProvider` built and tested against synthetic
  fixtures (21 tests, `src/lib/checkout/chitChatsShippingProvider.test.ts`, plus 6 more in
  `checkoutTotalConsistency.test.ts`) -- real documented API shapes (bearer-token auth,
  `/clients/<id>/shipments`, package weight/dimensions, `purchase_amount` as the customer-facing
  rate), reuses the same verified weight pipeline as Canada Post. Not activated -- no Chit Chats
  credential exists in this codebase. See "Chit Chats integration status" in the final report.
- **Serviceability-before-free (round 3 revision)**: free shipping is now only granted AFTER a
  real Chit Chats rate attempt succeeds, never from address format + subtotal alone. Chit Chats
  has no quote-only endpoint, so a real rate attempt is also the only way this codebase can ever
  confirm a destination/parcel is actually deliverable -- an oversized parcel, a restricted item,
  or a destination Chit Chats can't reach now correctly falls through to the existing manual-quote
  error path (`ShippingRateUnavailableError` → 422) instead of silently getting a $0 label it was
  never entitled to. Consequence worth knowing: this also means the lightweight `/api/checkout/quote`
  preview step (province/country/postal only) can no longer determine ANY shipping estimate, free
  or paid, until the customer's full street address is known -- same category of gap as the
  pre-existing Chit Chats full-address requirement, just now also covering the free case.
- Multiple service levels: when Chit Chats quotes more than one deliverable service for a
  shipment, only the cheapest is zeroed out when free shipping applies -- a pricier
  expedited/premium option in the same response keeps its own charge, per the owner's "expedited
  or premium delivery may carry additional charges" requirement. Chit Chats' own API doesn't label
  a rate as "standard" in the docs reviewed, so "cheapest quoted" is used as the proxy, not an
  invented carrier-specific label.
- Shipping-policy bug fix: both `CanadaPostShippingProvider` and `ChitChatsShippingProvider` now
  validate the destination address **before** granting free shipping, not after -- previously
  `CanadaPostShippingProvider` returned a free-shipping option for any subtotal over $300 without
  checking whether the address was even a valid, supported destination first.
- Cart-page free-shipping messaging: `/cart` now shows a subtotal-based preview ("add $X more to
  qualify" / "qualifies for free shipping — confirmed at checkout") once pricing is known. Worded
  as a preview, not a final promise, since the cart has no delivery address to confirm
  serviceability against yet -- only `/checkout`'s existing `OrderSummary` label (driven by the
  real server quote) is the authoritative "Free" statement.
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
- **Ship-from address**: confirm "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9" (already shown
  in the site footer) is the real shipping-origin facility, for whichever carrier (Chit Chats or
  Canada Post) is ultimately activated. For Chit Chats specifically, this is account-level
  configuration (Settings > Returns in their dashboard), not a value this codebase's code passes
  per-request.
- **Free-shipping geographic eligibility**: the owner has confirmed free shipping applies across
  all of Canada (not Ottawa-area-only) for orders with an eligible subtotal strictly over $300
  before tax, and that international orders never qualify regardless of subtotal -- both are now
  implemented in `ChitChatsShippingProvider`. No further confirmation needed unless this changes.
- **Catalog pricing**: the ~13% median increase is live on development/Preview now, pending your
  decision on when/whether to promote to Production.
- **Production promotion itself** -- separate approval, not covered by anything in this round.

## Needs external credentials (cannot be obtained or faked by Claude)

| Service | Exact credentials/info needed | Source |
|---|---|---|
| **Square (production payments)** | Production `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID` (all different from the sandbox values currently in `.env.local` -- confirmed `NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox` today), plus a production `SQUARE_WEBHOOK_SIGNATURE_KEY` matching a webhook subscription configured for the Production domain in Square's own dashboard. | Square Developer Dashboard, production app |
| **Chit Chats (planned primary carrier)** | An account, an API Access Token (Settings > Developer > API Access Tokens), and the account's client ID (every request path is scoped under `/clients/<CLIENT_ID>/`). Zero `CHIT_CHATS_*` vars exist today (confirmed by grep). | Chit Chats dashboard |
| **Canada Post (fallback carrier, kept but no longer primary)** | Developer Program / Commercial account, API key, customer number, contract ID (if using negotiated rates). Zero `CANADA_POST_*` vars exist today (confirmed by grep). | Canada Post Developer Program |
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

**Already ready on our side, waiting only on the above (updated 2026-11-12 -- corrects the prior
note here, which assumed the catalog export script itself needed to prefer a cached URL):**
- **The website already resolves every image through a manifest-based override point** --
  `src/lib/images/resolveHostedImage.ts`, already wired into `products.ts` for every
  `CatalogueProduct.images` entry, site-wide. It checks `imageManifest.json`
  (`sourceUrl -> hostedUrl`) and falls back to the supplier's own URL when no entry exists --
  which is every entry today, since the manifest is still `{}`. This means activating a rehosted
  image is a **pure data change** (adding entries to that one JSON file) -- no export script or
  site code needs to change at all, correcting what an earlier round assumed was still a
  not-started code task.
- The ingest/validation pipeline (`catalogue-engine/src/images/ingest.ts`, `validate.ts`) is
  fully built and tested -- fetch, content-type check, corruption/dimension validation,
  checksum-based deduplication.
- **New this round**: the two pieces between "validated image bytes" and "a working manifest
  entry" are now built and tested too -- `catalogue-engine/src/images/upload.ts`
  (`uploadImageToStorage()`, targeting a `product-images` Supabase Storage bucket that does not
  exist yet) and `catalogue-engine/src/images/manifest.ts` (`mergeImageManifest()`, which adds new
  entries, leaves existing ones -- SanMar's included -- untouched, and flags rather than silently
  overwrites any conflicting remap). Both are tested exclusively against synthetic fixtures (fake
  URLs, a fake injected storage client) -- no real Supabase Storage call and no real supplier
  image were touched. **Still not done, and each is its own separate approval/dependency, not
  bundled together:** creating the real `product-images` bucket (a live infrastructure change),
  and actually running an upload against a real, authorized S&S image (blocked on S&S's answer
  regardless of the bucket existing).

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
- If Chit Chats is activated: a handful of real addresses compared against Chit Chats' own rate
  calculator before the first real customer order relies on it, including at least one
  multi-item cart and one international destination.
- If Canada Post is activated instead/as well: the same, against Canada Post's own public
  rate-estimate tool.
- A real Ottawa pickup order end-to-end, confirming Ontario HST is charged regardless of the
  customer's own province and that $0 shipping is charged -- no frontend selector exists yet for
  the customer to choose pickup (see final report), so this needs that UI built first.
- Admin order view showing a real production order correctly, including correct totals, tax
  breakdown (if active), and shipping method.

## What this round did NOT do (explicitly out of scope, per instruction)

- No deploy to Production.
- No payment collection activated.
- No universal free shipping introduced as a fallback -- confirmed both
  `CanadaPostShippingProvider` and `ChitChatsShippingProvider` still throw
  `ShippingRateUnavailableError` rather than silently defaulting to free/flat shipping when a
  real rate can't be resolved.
- No live Chit Chats API call made -- no credentials exist, and Chit Chats' own API has no
  quote-only endpoint (creating a shipment record is the only way to get a rate), so even a mere
  rate check was treated as equivalent to "creating a real shipment" and never attempted live.
- No paid service activated or charge incurred.
- No frontend checkout UI built for selecting Ottawa pickup -- only the backend contract
  (`fulfillmentMethod: "pickup"` on both checkout API routes) exists; `CheckoutClient.tsx` has no
  way for a customer to actually choose it yet.
- No Square "PICKUP" fulfillment type used for pickup orders -- pickup orders still use Square's
  `SHIPMENT` fulfillment type with the customer's entered address, same as delivery orders, since
  building Square's dedicated pickup fulfillment fields was outside this round's scope.
