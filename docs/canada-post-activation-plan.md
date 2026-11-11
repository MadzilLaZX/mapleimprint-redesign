# Canada Post activation plan

**Current state, unchanged by this document: `shippingProvider` (src/lib/checkout/shippingProvider.ts)
is still `FreeShippingProvider`. `CanadaPostShippingProvider` is fully built and tested but not
wired in anywhere. Nothing here activates it -- this is the checklist for when you decide to.**

## Confirmed policy (not re-litigated here)

- Free shipping on orders over CAD $300 before tax.
- Live Canada Post rate at/below CAD $300.
- Free Ottawa local pickup, always available as an independent, explicitly-chosen option --
  never substituted for a failed delivery quote (see `canadaPostShippingProvider.ts`'s own header
  comment for why that distinction is load-bearing, not stylistic).

## Gate 1 -- Canada Post credentials (blocked, not obtainable by Claude)

Needed: a Canada Post Developer Program / Commercial account, API key, customer number, and (if
using negotiated rates) a contract ID. None exist in this codebase today (`CANADA_POST_*` env
vars: zero, confirmed by grep). Also needed: a confirmed ship-from address -- this codebase
assumes "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9" (the address already shown in the site
footer) is also the shipping-origin facility; confirm this explicitly before using it in a real
rate request.

## Gate 2 -- weight data (full pipeline now built end-to-end; 2 of 3 steps still need your approval to actually run)

| Item | Status |
|---|---|
| SanMar per-piece weight | Confirmed, extractable, 671/671 products (`normalizeSanMarWeight()`) |
| S&S per-piece + case weight | Confirmed, extractable, 1,102/1,102 products (`normalizeSSActivewearWeight()`) |
| S&S case dimensions | Extractable but **not authoritative** -- unit not documented by S&S, only inferred from physical plausibility. `hasAuthoritativeCaseDimensions()` returns `false` for every one today, by design. Do not treat these as real until S&S confirms the unit or a sample is physically measured. |
| Per-unit (not per-case) dimensions | **None exist anywhere**, for any supplier. This is the real remaining gap -- weight is solved, dimensions are not. |
| Joto drinkware / house products | **Zero weight data of any kind.** No supplier API exists for these (Maple produces them in-house). The only path is physically weighing a sample of each. `CatalogueProduct.shippingWeightLb` (src/lib/products.ts) is the already-built field waiting for those real numbers -- never estimate one from a product's dimensions or material. |
| Migration 008 (adds the weight columns to `SupplierProduct`) | Prepared, reviewed, validated against the full live dataset (671/671 + 1,101/1,102, one real anomaly correctly rejected). Its Prisma schema counterpart (`catalogue-engine/prisma/schema.prisma`) was added 2026-11-11 so the client has real typed fields -- schema-only, `prisma generate` run locally with no DB connection, nothing applied to the live database. **SQL migration itself still not applied.** |
| Backfill script | Prepared, dry-run tested, idempotent, reversible, touches only the 8 new columns -- **not executed**. |
| Promotion to the generated catalogue shape checkout reads | **Built and tested 2026-11-11.** `export-products-for-frontend.mjs`'s `cheapestOrderableOffer()` now carries the winning offer's own `unitWeightLb`/`weightConfidence` through, and a new `resolveShippingWeightLb()` gates it on `hasAuthoritativeUnitWeight()` before it ever reaches `CatalogueProduct.shippingWeightLb` -- 8 new tests in `catalogue-engine/test/shipping-weight-export.test.ts`, all passing. |
| Checkout wiring | **Built and tested 2026-11-11.** `priceCartItem.ts`'s `lineShippingWeightLb()` reads `shippingWeightLb` for every line type (BLANK, bundle, and CUSTOM-decorated -- the last via the frozen design snapshot's own `productSlug`/`categorySlug`/`subcategorySlug`, so a decorated item reports the same weight as the blank product it's made from) onto the new `PricedCartLine.unitWeightLb` field. `ShippingQuoteProvider.getOptions()` now takes a `lines` parameter; `CanadaPostShippingProvider.getOptions()` calls `estimateParcelWeightLb()` on it and throws a specific, honest `ShippingRateUnavailableError` ("We don't have a shipping weight for everything in your cart yet...") before ever attempting a live rate call if any line lacks an authoritative weight. 3 new tests in `canadaPostShippingProvider.test.ts` confirm this gate is a genuinely separate check from the credential-missing failure beneath it, not the same error reused. `FreeShippingProvider` (still the live export) ignores the new parameter -- zero behavior change to the live site. |

**Practical implication:** the only steps left for weight are the two database operations above
(migration 008's SQL + the backfill script), both still awaiting your separate approval per
standing instructions, and both genuinely reversible/idempotent as documented. The moment both
run and a fresh `products.json` export is regenerated, every apparel product with a confirmed
supplier weight will automatically carry a real `shippingWeightLb` all the way into a Canada Post
rate request -- no further code change is needed for that to happen. Drinkware/house products
still need Maple's own physical measurements regardless of migration 008, and per-unit dimensions
(Gate 3 below) remain a separate, unresolved gap for every supplier.

## Gate 3 -- dimensions strategy (open question, needs your decision, not a technical blocker)

Two real options once the weight gap above is closer to resolved:
1. **Weight-only rating** -- some Canada Post services can rate using weight plus a declared
   generic box-size tier (not exact per-item dimensions). Cheaper to implement, less precise.
   Needs confirming against Canada Post's actual Rating API docs once credentials exist.
2. **Real dimensions** -- requires either the suppliers eventually documenting/confirming them,
   or Maple physically measuring packaged samples. More accurate, more setup work.

This document doesn't pick one -- that's a business/accuracy tradeoff for you, not something to
default on.

## Gate 4 -- rate validation before trusting it for real orders

Once credentials exist: test against Canada Post's own sandbox/test environment first if one is
offered (standard practice, same reasoning as Square's `sandbox` environment already used for
payments). Compare a handful of known real packages' quoted rates against Canada Post's own
public rate-estimate tool as a sanity check before the first real customer order relies on it.

## Already built and verified -- these do NOT need rework when you activate

- `ShippingRateUnavailableError` -- the explicit failure type. Address validation and a failed
  live-rate call both throw this, and it is never silently caught into a degraded result.
  `getOptions()` only returns an empty/absent delivery option by throwing, never by quietly
  substituting something the customer didn't ask for.
- The checkout API routes (`/api/checkout/pay`, `/api/checkout/quote`) already catch this
  specific error type and surface its message as a 422 ("fix your input") rather than a generic
  502, and this was verified end-to-end on the live Preview deployment.
- `estimateParcelWeightLb()` -- sums real per-line weights, returns `null` (not a guessed number)
  the moment any line lacks one, so a request can't silently go out under-weighted. **As of
  2026-11-11, actually called from `getOptions()`** with the real cart lines a checkout request
  carries -- previously written but unreferenced.
- `hasAuthoritativeUnitWeight()` / `hasAuthoritativeCaseDimensions()` -- the gate a real rate
  request must check before trusting a value. **As of 2026-11-11, `hasAuthoritativeUnitWeight()`
  is wired into the export pipeline** (`resolveShippingWeightLb()` in
  export-products-for-frontend.mjs) so only supplier-confirmed weights ever reach checkout at all.
  Wire `hasAuthoritativeCaseDimensions()` in too if the chosen rating approach ends up needing
  dimensions (Gate 3); do not bypass either gate.
- Per-line weight threading from checkout's cart-line shape into
  `CanadaPostShippingProvider.getOptions()` -- **done 2026-11-11** (`ShippingQuoteProvider.getOptions()`
  now takes a `lines` parameter; `priceCartItem.ts` populates `PricedCartLine.unitWeightLb` for
  every line type). This was previously the plan's step 2; it's no longer separate, scoped work.

## Activation sequence, when all gates clear

1. Confirm Gates 1-4 above.
2. Replace the body of `fetchCanadaPostRate()` with a real Canada Post API call, gated behind
   `hasAuthoritativeUnitWeight()` (and `hasAuthoritativeCaseDimensions()` if dimensions end up
   required by the chosen rating approach). The weight gate upstream of this call (see above) is
   already in place -- `getOptions()` won't even reach `fetchCanadaPostRate()` for a cart missing
   weight data on any line.
3. Swap `shippingProvider`'s export from `FreeShippingProvider` to `CanadaPostShippingProvider` --
   this really is the one-line change at the very end, once everything above is real.
4. Test on Preview with a handful of real addresses before ever touching Production.
