# Owner handoff — launch preparation

Written 2026-11-22 at `checkout-square-payments`. Replaces the previous version of this file in
full — several of its items are now done (Preview env vars, Vercel access, shipping policy
implemented in Preview, storage code verified). This is the current, accurate picture.

---

## 1. Packaging measurements needed for Chit Chats

Nothing about real Chit Chats shipping rates can work until at least one product has a real,
measured packaging profile. This is pure data entry — the code is already built and wired in
(`src/lib/checkout/packagingProfiles.ts`); it just has zero entries today.

**What to measure, per product (or group of similar products) you ship in the same box:**

| Field | What it means | Example |
|---|---|---|
| `outerDimensionsIn.length/width/height` | The box's own OUTSIDE dimensions, in inches, as it will actually ship | A poly mailer for one folded t-shirt: 14 × 10 × 1 in |
| `emptyWeightLb` | The empty box/mailer + packing material weight alone, no product inside | 0.05 lb |
| `maxUnitsPerPackage` | The most units of that product this exact box can physically, safely hold | 1 t-shirt per mailer |
| `maxWeightLbPerPackage` | A weight cap for this box, independent of the count above | 2 lb |

**Simple step-by-step example (one t-shirt in a poly mailer):**
1. Fold the t-shirt the way you'd normally pack it, put it in the mailer you'd actually use, seal it.
2. Lay the mailer flat on a table; measure length × width with a tape measure, and the flattened
   thickness for height. Round up slightly (carriers charge on the box, not the garment).
3. Weigh the *empty* mailer alone on a kitchen or shipping scale (grams → divide by 454 for lb, or
   switch the scale to lb directly) — this is `emptyWeightLb`.
4. Decide how many of that exact product this exact box could safely hold if someone ordered more
   than one (`maxUnitsPerPackage`), and a sanity-check weight ceiling for it (`maxWeightLbPerPackage`).
5. Add the entry to `PACKAGING_PROFILES` in `packagingProfiles.ts`, then map the product to it in
   `PRODUCT_PACKAGING_ASSIGNMENTS` using `buildProductId(categorySlug, subcategorySlug, slug)` — the
   file's own header shows the exact syntax. No other code change is needed; real Chit Chats rates
   start working for that product automatically the moment the entry exists.

You don't need to measure every product before launch — even one profile (e.g. "standard t-shirt
in a poly mailer") lets you verify the whole real-rate pipeline end to end before doing the rest.

**A fillable copy of this, per product category, is in
`docs/packaging-measurement-worksheet.md`** — print it or fill it in digitally, one box per sheet.

**Safety net (added 2026-11-22):** the moment you add a real entry, `npm test` automatically
checks it — a "LIVE GATE" test in `packagingProfiles.test.ts` validates every field is a real,
positive number (never a placeholder `0` left over from copying the template) before it can ever
be used for a real rate request. A profile that fails this check behaves exactly like no profile
existing at all — it routes to "Request a Shipping Quote," never a fabricated or zero-dimension
rate. You'll see exactly which field failed if a test fails after you add your numbers.

---

## 2. Supplier outreach emails — ready for your approval

Full text below (also in `catalogue-engine/OUTREACH_DRAFTS.md`). **Neither has been sent.** Fill in
your account number, name, and phone/email before sending from whoever holds each wholesale account.

### SanMar — send to SanMar Canada Support

**Subject:** Product image access (403 Forbidden on embedded SanMar images)

> Hello SanMar Canada Support,
>
> We are developing an e-commerce website for Maple Imprint Ltd., an Ottawa-based custom apparel
> and promotional products business.
>
> We are experiencing an issue displaying SanMar product images on our website. The image URLs
> load successfully when opened directly, but return HTTP 403 Forbidden from CloudFront when
> embedded on our website.
>
> Could you please confirm:
>
> 1. Whether authorized resellers may display SanMar product images on their own e-commerce
>    websites.
> 2. Whether there is an approved image library, API, or downloadable product-image catalogue we
>    can use.
> 3. Whether we may cache and rehost SanMar product images on our own infrastructure/CDN under our
>    wholesale account, rather than depending on live hotlinking from `media.sanmarcanada.com`
>    going forward — we're happy to credit/attribute SanMar however required, and to limit this to
>    products we actually carry.
> 4. Whether our website domain needs to be allowlisted for image access, if hotlinking is in fact
>    the intended access pattern once authorized.
>
> We would appreciate guidance on the recommended integration method.
>
> Thank you,
> Maple Imprint Website Development Team

### S&S Activewear — send via your account rep, or `ssactivewear.com/marketing/edi`

**Subject:** Product image access request — Maple Imprint (S&S wholesale account [account number])

> Hi [rep name / S&S team],
>
> We're Maple Imprint Ltd. ([account number]), an Ottawa-based custom printing and promotional
> products company. We're building our product catalogue on our own website using your product
> data, and we've run into an access issue specifically with product images: requests to
> `cdn.ssactivewear.com` from our site are currently being blocked (HTTP 403), so none of your
> product photos are displaying for our customers.
>
> For reference, here's exactly what we're seeing (confirmed again 2026-11-17):
>
> ```
> GET https://cdn.ssactivewear.com/Images/Color/102738_f_fm.jpg
> → HTTP/1.1 403 Forbidden
> → Server: cloudflare
> → Response body: "error code: 1009"
> ```
>
> This reproduces for every product image URL we've tried — it isn't specific to one product or
> image. For comparison, the equivalent request to one of our other suppliers' image CDNs returns
> a normal 200 OK, so this looks specific to how `cdn.ssactivewear.com`'s Cloudflare configuration
> is treating our requests.
>
> Could you help us with:
>
> 1. **Official image API or media access** — is there a supported way to request product images
>    (e.g. the REST API at `api.ssactivewear.com`, a PromoStandards Media Content service, or
>    another sanctioned endpoint) rather than hotlinking the CDN directly?
> 2. **An alternative image delivery method**, if hotlinking isn't the intended access pattern — a
>    referrer allowlist for our domain, a signed-URL approach, or your preferred integration method.
> 3. **Explicit permission to cache and rehost your product images** on our own infrastructure/CDN
>    under our wholesale account. We'd credit/attribute S&S Activewear however required, and limit
>    this to products we actually carry.
> 4. We've also seen that you offer free, downloadable, distributor-brandable digital catalogs —
>    are the product photos in those catalogs licensed for us to extract and display per-item on
>    our own e-commerce product pages, or are they intended for marketing collateral only?
> 5. While we're in touch — generating an API key for product/pricing/inventory data sync as well,
>    if that's a separate step from the above.
>
> Happy to hop on a call if that's easier, or to provide our account number/domain for
> verification. Thanks for your help!
>
> [Your name]
> Maple Imprint Ltd.
> [phone / email]

---

## 3. Production launch checklist

### Mandatory blockers (launch should not proceed without these)
1. **Measure at least one shipping box** (section 1 above).
2. **Add Chit Chats credentials to Vercel's *Production* environment variables** —
   `CHIT_CHATS_API_ACCESS_TOKEN`, `CHIT_CHATS_CLIENT_ID`, `CHIT_CHATS_ENVIRONMENT=production` are
   now configured in Vercel's **Preview** environment only (owner-approved and verified 2026-11-22:
   a real read-only `GET /shipments` auth check against production succeeded). Production still
   needs the same three variables added separately — this was deliberately NOT done automatically,
   since Production env changes are outside this engagement's authorization.
3. **Confirm GST/HST registration status** with your accountant — only the 13% Ontario *rate* is
   confirmed correct; registration/authorization to collect it is a separate, unconfirmed question
   that gates whether Production can ever charge real tax at all.
4. **Resolve the Chit Chats shipping-origin address question** (section 5 below) — a real,
   unresolved discrepancy, not something the code can guess.
5. **Flip Production's `design-uploads` storage bucket to private** — see section 4's sequence.
6. **Decide and execute the shipping-policy activation** for Production — see section 4's sequence.
7. **`OWNER_NOTIFICATION_EMAIL`** is unset in both Preview and Production — set it once you want
   new-order/new-lead staff alerts (safe to launch without it, but you'll get no alert emails).

### Optional improvements (not launch blockers)
- Sending the two supplier outreach emails (section 2) — unblocks real product photos, but the
  site already handles missing photos honestly (styled placeholder + real brand name, never a
  broken image or a fake photo).
- BC/SK/MB PST and Quebec QST registration confirmation — these stay off by design even once
  GST/HST is confirmed; a separate, later decision.
- Canada Post as a fallback carrier (built, tested, needs its own Developer Program credentials —
  only worth pursuing if Chit Chats alone proves insufficient).
- Applying migration 010 (persistent cross-instance Chit Chats rate cache) — the shipping policy
  works correctly without it today (in-memory caching only); it's a performance/scale refinement.

---

## 4. Safe Production sequence

Do these in order — each step is independently verifiable before moving to the next, and every
step before the last is reversible.

1. **Confirm GST/HST registration** (mandatory blocker #3) and the shipping-origin address
   question (#4) — business decisions that inform the steps below; no code or config change yet.
2. **Add the Chit Chats Production env vars** (blocker #2) in Vercel's dashboard — safe on its own,
   does nothing until the code change in step 5 actually calls them.
3. **Flip Production's storage bucket to private**, following `docs/private-bucket-cutover.md`'s
   now-current, Production-specific sequence (code is already verified ready — see that doc's
   "Staging dress rehearsal" section for exactly what was already confirmed). Smoke-test
   immediately after: Studio upload + reload, submit a quote with a file, view it as admin,
   download its ZIP.
4. **Add your first real packaging profile** (section 1) once you've measured a box.
5. **Activate the real shipping policy in Production** — a single, deliberate, reviewed code edit
   to `shippingProvider.ts`'s `resolveShippingProvider` function (the `"production"` branch
   currently returns the Free Shipping placeholder; change it to return a real
   `ChitChatsShippingProvider` the same way the Preview branch already does). This is intentionally
   NOT a toggle — it should go through the same review process as any other code change.
6. **Final checkout verification** before announcing launch: place one real order through each
   fulfillment path (Ottawa pickup, and a delivery order to an address you've just added a
   packaging profile for) using a real card for a small, refundable amount, and confirm: the
   charged total matches subtotal + real shipping + real tax exactly, the order confirmation page
   and email both show correct figures, and the files/design attached are retrievable from the
   (now-private) bucket. This is the one step in this sequence that touches real money — do it
   deliberately, not as an automated check.

---

## 5. Unresolved tax-registration and shipping-origin information

- **GST/HST registration**: not confirmed. The 13% Ontario *rate* is correct and already coded;
  whether Maple Imprint is registered and authorized to collect it is a separate compliance
  question for your accountant. Production stays at $0 tax by design until you confirm this.
- **BC/SK/MB PST and Quebec QST registration**: separately unconfirmed, gates a different flag
  (`pstQstEnabled`) than GST/HST above — these stay off even after GST/HST is confirmed, until you
  separately confirm each.
- **Chit Chats shipping-origin address mismatch** (owner-reported 2026-11-15, still open): the
  Chit Chats account's on-file Settings → Returns origin address does not match
  `BUSINESS.addressLine1`/`addressLine2` in `src/lib/constants.ts` (the address the website
  publishes for Ottawa pickup). Account on file: Client ID `208241`, region Ontario and Manitoba,
  dimension preference cm, weight preference lb, Canadian shipping preference "Fully Tracked",
  insurance auto-included. You need to decide: should these be the same address? If so, which one
  is correct, and update the other to match (in the Chit Chats dashboard, or in
  `src/lib/constants.ts` — not something the code will reconcile on its own).
  **Confirmed 2026-11-22 against Chit Chats' live API reference: there is no API endpoint at all
  (for the account, or for return-address settings specifically) that exposes this value** — this
  can only ever be checked by logging into the Chit Chats dashboard yourself, not automated or
  cross-checked by this codebase going forward.
- **`OWNER_NOTIFICATION_EMAIL`**: unset everywhere. Not strictly a tax/shipping item, but grouped
  here as another real environment gap — set it when you want staff alerts on new orders/leads.
