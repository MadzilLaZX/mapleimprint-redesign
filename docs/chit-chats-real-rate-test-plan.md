# Chit Chats real-rate test plan (for use once packaging measurements exist)

Replaces the staging-host assumption in `docs/chit-chats-staging-validation.md` (confirmed, in a
later round, that `https://staging.chitchats.com` returns `404` for this account — there is no
separate Chit Chats staging environment to test against). Not run this round — this is a
"prepare, don't execute" document, same as its predecessor, written so whoever adds the first real
packaging profile can verify the pipeline deliberately, not by accident.

## The one thing to understand before starting

**There is no sandbox.** The Preview deployment's `CHIT_CHATS_ENVIRONMENT=production` setting
(confirmed in Vercel) means every rate request from this website's Preview/staging environment
calls Chit Chats' real, live API — the same one Production would eventually use. Chit Chats has no
quote-only endpoint (confirmed against their own API reference): getting a real rate always means
creating a real, unpurchased draft shipment. That shipment is never charged (postage purchase is a
separate, never-called endpoint in this codebase) and can always be deleted, but it DOES exist on
the real account the moment a test succeeds. **Each test below creates one real shipment record —
delete it afterward (step 6).**

## Prerequisites

- At least one real entry in `PACKAGING_PROFILES`/`PRODUCT_PACKAGING_ASSIGNMENTS`
  (`src/lib/checkout/packagingProfiles.ts`) for one product — see
  `docs/packaging-measurement-worksheet.md`. Nothing below works before this exists; every quote
  attempt for an unprofiled product correctly refuses and routes to a manual quote (that refusal
  path is itself one of the test cases below, and needs no profile to verify).
- A **real, deliverable Canadian address** to test with — your own, or a known address you're
  comfortable Chit Chats actually attempting to quote. **Do not use a fabricated address like "123
  Test Street"** — confirmed directly in an earlier round that an address Chit Chats can't
  recognize leaves checkout stuck on "Calculating shipping and tax…" indefinitely rather than
  failing cleanly, which would make this test plan impossible to read a result from.
- Access to the Chit Chats dashboard, to confirm/delete the test shipments this creates.

## Test 1 — a profiled product, order value at/under $300 (real paid rate)

1. On the Preview deployment, add enough of the newly-profiled product to cart to total **at or
   under $300** before tax/shipping.
2. Go to checkout, choose "Ship to Address," enter your real test address.
3. **Expect:** a real, non-zero Chit Chats rate appears (not "Request a Shipping Quote").
4. **Record:** the quoted amount, for the packaging worksheet's cost-validation table.

## Test 2 — the same product, order value over $300 (free shipping applies)

1. Increase quantity so the subtotal is **strictly over $300**.
2. **Expect:** the cheapest quoted service shows as "Free Shipping" ($0); if Chit Chats returned
   more than one service level for this parcel, any pricier option keeps its real price.
3. **Confirm the cart page's own "qualifies for free shipping" preview** (shown before address
   entry) agrees with this real result for the same subtotal.

## Test 3 — an unprofiled product (manual-quote fallback, no profile needed for this one)

1. Cart a product that has **no** entry in `PRODUCT_PACKAGING_ASSIGNMENTS`.
2. **Expect:** "Request a Shipping Quote" (or equivalent manual-quote messaging), never a real
   rate, regardless of subtotal — correct, since no real box exists for it yet.

## Test 4 — a mixed cart (two different profiled products together)

Only meaningful once at least two products each have their own profile.

1. Cart one unit each of two different profiled products.
2. **Expect:** manual-quote fallback, by design — `resolvePackaging()` only ever resolves a
   single-distinct-product cart (see that file's header); this is not a bug to chase.

## Test 5 — a quantity exceeding the profile's own cap

1. Cart more units of the Test 1 product than its `maxUnitsPerPackage` (or enough to exceed
   `maxWeightLbPerPackage`).
2. **Expect:** manual-quote fallback — the system correctly refuses to guess that it fits in one
   box or to silently ship an overweight/overcapacity parcel.

## Test 6 — required cleanup after every test above

1. In the Chit Chats dashboard, find each shipment created by tests 1, 2, 4 (whichever actually
   reached a real rate request — 3 and 5 correctly never create one).
2. Confirm `postage_label_*_url` is empty/null on each (confirms nothing was purchased).
3. Delete each one. Confirm it no longer appears in the shipments list afterward.
4. If using `ChitChatsQuoteCoordinator`'s persistent cache (staging Supabase, migration 010): a
   deleted-but-still-cached quote will be served again from cache on a repeat test within its TTL —
   harmless for testing, but mention this to whoever re-tests later so a "the rate still shows"
   isn't mistaken for the deletion not having worked.

## What a passing run tells you

- The real rate pipeline (packaging profile → Chit Chats request → mapped `ShippingOption`) works
  end to end for at least one real product.
- The $300 threshold and the "only the cheapest option is free" rule both behave as documented
  against a real quote, not just mocked tests.
- Every edge case this codebase is designed to refuse (no profile, mixed cart, overcapacity) still
  correctly refuses rather than guessing — confirmed against the real provider, not just its unit
  tests.
- You have at least one real, logged shipping cost to fill into the packaging worksheet's cost-
  validation table, informing whether $300 is a safe threshold at realistic order sizes.

## What this does NOT test (separate, later steps)

- Real tax calculation together with real shipping (tax is a separate, still-$0-by-default
  provider — see `docs/production-launch-handoff.md`).
- Postage purchase, label generation, or fulfillment — never exercised by this plan or by any
  automated test in this codebase, by design.
- Production itself — Production stays on `FreeShippingProvider` until a separate, deliberate code
  change follows its own activation decision (`shippingProvider.ts`'s `resolveShippingProvider`).
