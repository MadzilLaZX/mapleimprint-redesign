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

## Gate 2 -- weight data (RESOLVED end-to-end as of 2026-11-11, except dimensions/house products)

| Item | Status |
|---|---|
| SanMar per-piece weight | Confirmed, extractable, 671/671 products (`normalizeSanMarWeight()`) |
| S&S per-piece + case weight | Confirmed, extractable, 1,102/1,102 products (`normalizeSSActivewearWeight()`) |
| S&S case dimensions | Extractable but **not authoritative** -- unit not documented by S&S, only inferred from physical plausibility. `hasAuthoritativeCaseDimensions()` returns `false` for every one today, by design. Do not treat these as real until S&S confirms the unit or a sample is physically measured. |
| Per-unit (not per-case) dimensions | **None exist anywhere**, for any supplier. This is the real remaining gap -- weight is solved, dimensions are not. |
| Joto drinkware / house products | **Zero weight data of any kind.** No supplier API exists for these (Maple produces them in-house). The only path is physically weighing a sample of each. `CatalogueProduct.shippingWeightLb` (src/lib/products.ts) is the already-built field waiting for those real numbers -- never estimate one from a product's dimensions or material. |
| Migration 008 (adds the weight columns to `SupplierProduct`) | **APPLIED 2026-11-11**, following your explicit approval. Confirmed purely additive beforehand (re-read the migration file: only `add column if not exists`, no drops/alters of existing columns) and confirmed additive afterward (every pre-existing `SupplierProduct` column and row count unchanged; only the 8 new nullable columns appeared). Applied via an authorized Supabase connection (never `DATABASE_URL`). |
| Backfill | **EXECUTED 2026-11-11**, following your explicit approval, in 18 controlled batches (sizes 100-450 rows), verified via a count query after several batches and once fully at the end. Final state, independently verified via direct queries (not just trusted from script output): **1773/1773** `SupplierProduct` rows (671 `sanmar` + 1102 `ss_activewear`, confirmed by supplier code) carry a `weightConfidence = 'confirmed'` `unitWeightLb`; **1101/1102** S&S rows carry `dimensionsConfidence = 'inferred'` case dimensions; **0** rows have any dimension over the 60-inch sanity bound (the one real anomaly -- a Columbia jacket case misreporting 188in -- correctly has no case dimensions written, exactly as predicted); **0** rows remain null. `joto`/`conde` supplier rows: none exist in `SupplierProduct` yet, so nothing there was or could be touched. |
| Promotion to the generated catalogue shape checkout reads | **Built and tested 2026-11-11.** `export-products-for-frontend.mjs`'s `cheapestOrderableOffer()` now carries the winning offer's own `unitWeightLb`/`weightConfidence` through, and a new `resolveShippingWeightLb()` gates it on `hasAuthoritativeUnitWeight()` before it ever reaches `CatalogueProduct.shippingWeightLb` -- 8 new tests in `catalogue-engine/test/shipping-weight-export.test.ts`, all passing. **Not yet re-run against the now-populated live data** -- the staged `products.json` regeneration (see `regenerate-products-json.md`) predates this backfill; re-running it is the next step to actually see real `shippingWeightLb` values flow through, still gated on your separate approval to promote anything to the live file. |
| Checkout wiring | **Built and tested 2026-11-11.** `priceCartItem.ts`'s `lineShippingWeightLb()` reads `shippingWeightLb` for every line type (BLANK, bundle, and CUSTOM-decorated -- the last via the frozen design snapshot's own `productSlug`/`categorySlug`/`subcategorySlug`, so a decorated item reports the same weight as the blank product it's made from) onto the new `PricedCartLine.unitWeightLb` field. `ShippingQuoteProvider.getOptions()` now takes a `lines` parameter; `CanadaPostShippingProvider.getOptions()` calls `estimateParcelWeightLb()` on it and throws a specific, honest `ShippingRateUnavailableError` ("We don't have a shipping weight for everything in your cart yet...") before ever attempting a live rate call if any line lacks an authoritative weight. 3 new tests in `canadaPostShippingProvider.test.ts` confirm this gate is a genuinely separate check from the credential-missing failure beneath it, not the same error reused. `FreeShippingProvider` (still the live export) ignores the new parameter -- zero behavior change to the live site. |

**Practical implication:** weight data is now live in the database for every apparel product with
a confirmed supplier weight. The one remaining step to make it visible to checkout is re-running
the `products.json` regeneration (now that the backfill has real data to pick up) and getting your
approval to promote that to the live file -- no further code change is needed. Drinkware/house
products still need Maple's own physical measurements regardless of migration 008, and per-unit
dimensions (Gate 3 below) remain a separate, unresolved gap for every supplier. **Canada Post
itself remains fully inactive** -- this round changed database contents, not shipping behavior;
`shippingProvider` is still `FreeShippingProvider` and no live rate call has been attempted.

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
