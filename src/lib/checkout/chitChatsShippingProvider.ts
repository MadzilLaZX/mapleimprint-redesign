import type { ShippingAddressInput, ShippingOption, ShippingQuoteLine, ShippingQuoteProvider } from "./shippingProvider";
// Explicit .ts extension -- required by plain `node --test` (this file's own test imports it
// directly), matching the convention already used in canadaPostShippingProvider.ts.
import { ShippingRateUnavailableError, estimateParcelWeightLb } from "./canadaPostShippingProvider.ts";
import { validatePostalCode } from "./validation.ts";
import { ChitChatsRateCache } from "./chitChatsRateCache.ts";
import { ChitChatsQuoteCoordinator } from "./chitChatsQuoteCoordinator.ts";
import { buildQuoteFingerprint } from "./chitChatsQuoteStore.ts";
import { chitChatsShipmentsUrl, chitChatsRequestHeaders } from "../server/chitChatsClient.ts";

// Architecture for the owner-confirmed shipping policy, NOT wired in as the live `shippingProvider`
// export (see shippingProvider.ts) -- Chit Chats replaces Canada Post as the PLANNED primary
// carrier, but no live rate call is ever made in this codebase today: no CHIT_CHATS_* credential
// exists anywhere (verified by grep), and Chit Chats' own API has no quote-only endpoint --
// POST /shipments always creates a persistent shipment record, even for a rate check (confirmed
// directly against https://chitchats.com/docs/api/v1: set postage_type: "unknown" to create one
// without buying postage; it can be deleted via DELETE /shipments/{id} as long as it hasn't been
// paid for or received; a staging sandbox exists at https://staging.chitchats.com for real
// integration testing once credentials exist; rate limit is 2,000 requests/5 minutes). Treating
// any live call to that endpoint as equivalent to "creating a real shipment" means it must never
// be called outside of an injected test fixture this round, consistent with the standing "no real
// shipments without approval" instruction and the fact that no real credentials exist to call it
// with anyway. getOptions() below caches successful quotes in two tiers: an in-process cache
// (chitChatsRateCache.ts, single instance) and, when a ChitChatsQuoteCoordinator is supplied, a
// persistent, cross-instance tier (chitChatsQuoteCoordinator.ts + chitChatsQuoteStore.ts) that
// coordinates concurrent requests via ownership tokens and leases rather than letting a losing
// request independently call Chit Chats -- see that pair of files' headers for the full
// claim/wait/takeover/reconcile design, including how a cached quote's shipment id is meant to be
// reused at payment time (PATCH /shipments/{id}/buy on the SAME id) rather than purchasing postage
// against a brand-new shipment the customer never actually saw a rate for.
//
// Confirmed owner policy, "CANADAWIDE FREE SHIPPING POLICY" (2026-11-12, round 3):
//   1. All 10 provinces and 3 territories are geographically eligible, SUBJECT TO ACTUAL CARRIER
//      SERVICEABILITY -- see the serviceability note below; this is not a blanket "any CA address
//      qualifies" rule.
//   2-4. Threshold: eligible merchandise subtotal strictly greater than CAD $300.00, after
//      discounts, before tax/shipping. $300.00 exactly = not eligible. $300.01 = eligible.
//   5. Eligible standard delivery is $0 to the customer; Maple absorbs the real carrier cost.
//   6. Expedited/premium service levels may still carry a charge even on an otherwise-eligible
//      order -- see "multiple service levels" below.
//   7. Ottawa pickup is free regardless of order value, when explicitly selected -- handled
//      entirely outside this provider (OTTAWA_PICKUP_OPTION in canadaPostShippingProvider.ts;
//      never returned by this provider, confirmed by its own test).
//   8. US and all other international destinations are excluded from the promotion, regardless of
//      subtotal.
//   9. Orders at/below $300 get a real calculated Chit Chats rate.
//   13. The $300 threshold is independent of GST/HST -- this provider has no reference to tax at
//      all; taxProvider.ts computes tax on this provider's OUTPUT (subtotal + whatever this
//      returns), never the reverse. See taxProvider.test.ts's dedicated independence test.
//
// SERVICEABILITY, items 10-12 -- the central design point of this round's revision:
// Chit Chats has no quote-only/serviceability-only endpoint (see above) -- the ONLY way this
// codebase can ever confirm a given destination and parcel are actually deliverable is to attempt
// a real rate request and see whether it succeeds. Earlier versions of this provider returned a
// fabricated $0 option for ANY Canadian address over $300, in format alone, WITHOUT ever
// confirming Chit Chats could actually ship there -- an oversized parcel, a restricted item, or an
// address Chit Chats itself can't reach would have been waved through with a free label it was
// never entitled to. That is now fixed: getOptions() ALWAYS calls the rate fetcher first, for
// every destination, Canadian or not, before it ever decides whether the result should be free.
// A failed rate attempt (unsupported destination, oversized/restricted parcel, API outage) always
// throws ShippingRateUnavailableError and is never downgraded to a fabricated $0 or silently
// retried as something else -- the customer is routed to a manual shipping quote instead, which
// is this codebase's existing "something needs a human" path (see checkout API routes, which
// already catch this error type and return 422 with its own message).
//
// MULTIPLE SERVICE LEVELS: Chit Chats' real rate response is a `rates` array (one shipment can
// have several quotable services, e.g. standard vs. a faster/pricier option) -- ChitChatsRateFetcher
// returns ShippingOption[] for this reason. When free shipping applies, only the CHEAPEST quoted
// option is zeroed out (that is "eligible standard delivery"); any pricier option in the same
// response is left at its quoted price, satisfying "expedited or premium delivery may carry
// additional charges." Chit Chats' own API doesn't label any rate as "standard" vs "expedited" in
// the documentation reviewed, so "cheapest" is used as the defensible, non-invented proxy for
// "standard" rather than guessing at a carrier-specific service-level name.
//
// Packaging / parcelization, as researched against the real Chit Chats API docs
// (https://chitchats.com/docs/api/v1):
//   - A Chit Chats shipment carries ONE package per request (weight, weight_unit, and optional
//     size_x/size_y/size_z dimensions). This provider treats an entire cart as a single logical
//     parcel -- summing weight across every line via estimateParcelWeightLb() (the same verified
//     weight pipeline CanadaPostShippingProvider uses, reused rather than duplicated). True
//     multi-parcel splitting is NOT implemented -- it would require a per-product maximum-parcel
//     weight/dimension rule that doesn't exist anywhere in this codebase and is not invented here.
//   - Dimensions (size_x/size_y/size_z): no product in the catalogue carries a per-unit dimension
//     today (same confirmed gap documented in canadaPostShippingProvider.ts). This provider does
//     NOT hard-block a quote on missing dimensions -- the docs don't show them as strictly
//     required, and a fabricated box size would be worse than an approximate weight-only rate.
//     "Oversized" per item 10 is NOT pre-emptively guessed from a weight/size threshold invented
//     here -- it is expected to surface as a real rejection from the live rate fetcher once
//     active, which this provider propagates as-is.
//   - Origin/ship-from address is Chit Chats account-level configuration (Settings > Returns), not
//     a per-request field -- not something this provider needs to supply.
//
// Credentials needed before this can ever go live: a Chit Chats account, an API Access Token
// (Settings > Developer > API Access Tokens), and the account's client ID (every request path is
// scoped under /clients/<CLIENT_ID>/) -- none exist in this codebase today.

export const FREE_SHIPPING_THRESHOLD_CENTS = 30000; // CAD $300.00, before tax -- strictly greater than

/** Minimal destination check that applies to EVERY address, delivery or free, Canadian or
 *  international -- Chit Chats ships internationally (unlike Canada Post, which this codebase
 *  only ever calls for Canadian addresses), so this deliberately does NOT reject non-CA
 *  addresses the way canadaPostShippingProvider.ts's equivalent check does. It only rejects
 *  addresses that are malformed regardless of destination: no country, no province, or (for a
 *  Canadian address specifically) a postal code that doesn't match the Canadian format. */
function assertAddressHasMinimumFields(address: ShippingAddressInput): void {
  if (!address.country.trim()) {
    throw new ShippingRateUnavailableError("Select a country to see shipping rates.");
  }
  if (!address.province.trim()) {
    throw new ShippingRateUnavailableError("Select a province or state to see shipping rates.");
  }
  const postalCodeError = validatePostalCode(address.postalCode, address.country);
  if (postalCodeError) {
    throw new ShippingRateUnavailableError(postalCodeError);
  }
}

/** A real Chit Chats shipment/rate request needs a recipient name and street address, which
 *  ShippingAddressInput only carries as optional fields (see shippingProvider.ts) -- today's
 *  /api/checkout/quote only collects province/country/postalCode, so calling this provider from
 *  that lightweight preview step will always hit this check, for EVERY destination including a
 *  would-be-free one -- confirming serviceability (see this file's header) requires a real quote
 *  attempt, which requires this data, so there is no lighter-weight path to a free-shipping
 *  answer than to a paid one. That's a real, honest gap in the /quote step's current fields, not
 *  something to work around by guessing a name or street address. */
function assertFullChitChatsAddress(address: ShippingAddressInput): void {
  if (!address.name?.trim() || !address.addressLine1?.trim() || !address.city?.trim()) {
    throw new ShippingRateUnavailableError(
      "We need your full shipping address (name, street address, and city) to get a Chit Chats shipping rate.",
    );
  }
}

export interface ChitChatsPackageInput {
  weightLb: number;
  /** Always null today -- see this file's header note on packaging/parcelization. Accepted here
   *  (rather than omitted entirely) so the real rate fetcher, once built, doesn't need another
   *  signature change the moment per-product dimensions exist. */
  dimensionsIn: { length: number; width: number; height: number } | null;
}

/** The real Chit Chats API call, once credentials and a confirmed request shape exist. Returns
 *  every quotable service level Chit Chats offers for this shipment (its own `rates` array), not
 *  just one -- see this file's header note on "multiple service levels". Exposed as an injectable
 *  constructor parameter (default: this function) so a test can verify the real weight/address is
 *  threaded through correctly, and that a rejection (unsupported destination, oversized parcel)
 *  propagates rather than being papered over, without a live Chit Chats account. */
export type ChitChatsRateFetcher = (
  address: ShippingAddressInput,
  subtotalCents: number,
  pkg: ChitChatsPackageInput,
) => Promise<ShippingOption[]>;

/** One entry of Chit Chats' `rates` array, per https://chitchats.com/docs/api/v1 -- only the
 *  fields this mapping actually reads are declared; the real response carries more. Exported so
 *  chitChatsShipmentReconciler.ts's GET /shipments?q= lookup (whose results carry the same `rates`
 *  shape) can map a recovered shipment's rates identically rather than duplicating this logic. */
export interface ChitChatsRateApiEntry {
  postage_type?: string;
  postage_description?: string;
  purchase_amount?: string;
}

interface ChitChatsCreateShipmentResponse {
  id?: string;
  rates?: ChitChatsRateApiEntry[];
}

/** Shared mapping from Chit Chats' raw `rates[]` shape to this codebase's ShippingOption[] --
 *  used both by the real POST /shipments response (fetchChitChatsRates below) and by
 *  chitChatsShipmentReconciler.ts's GET /shipments?q= lookup, so a recovered shipment's rates are
 *  interpreted identically to a freshly-created one. Silently drops any entry missing the two
 *  fields it actually needs rather than crashing or guessing a price for it. */
export function mapChitChatsRateEntries(rates: ChitChatsRateApiEntry[]): ShippingOption[] {
  return rates
    .filter((rate): rate is ChitChatsRateApiEntry & { postage_type: string; purchase_amount: string } =>
      typeof rate.postage_type === "string" && typeof rate.purchase_amount === "string",
    )
    .map((rate) => ({
      id: `chitchats-${rate.postage_type}`,
      label: rate.postage_description ?? rate.postage_type,
      cents: Math.round(parseFloat(rate.purchase_amount) * 100),
    }));
}

/** `POST /clients/<id>/shipments` with `postage_type: "unknown"` -- per this file's header, this
 *  is Chit Chats' only way to get a real rate (there is no quote-only endpoint); the resulting
 *  shipment is left unpurchased (no postage bought) and can be deleted, consistent with the
 *  "no real shipments without approval" rule since this round still never calls the delete OR buy
 *  endpoints and only ever runs under mocked fetch in tests. `order_id` is set to this request's
 *  own quote fingerprint (the same value `ChitChatsQuoteCoordinator` persists under) purely so a
 *  future reconciliation lookup (`GET /shipments?q=<fingerprint>`) has something stable to search
 *  for -- see chitChatsShipmentReconciler.ts. */
export const fetchChitChatsRates: ChitChatsRateFetcher = async (address, subtotalCents, pkg) => {
  // Missing CHIT_CHATS_CLIENT_ID / CHIT_CHATS_API_ACCESS_TOKEN -- not yet activated in this
  // environment (chitChatsClient.ts throws a plain Error for either). Same honest message the
  // stub this replaces always gave, so every existing "not configured" test keeps passing
  // unchanged in an environment (like this codebase's own test run) with no real credentials set.
  let shipmentsUrl: string;
  let headers: Record<string, string>;
  try {
    shipmentsUrl = chitChatsShipmentsUrl();
    headers = chitChatsRequestHeaders();
  } catch {
    throw new ShippingRateUnavailableError(
      "Live shipping rates aren't available yet for this order — request a quote and we'll confirm shipping manually.",
    );
  }

  const fingerprint = buildQuoteFingerprint({ address, subtotalCents, pkg });
  const body: Record<string, unknown> = {
    name: address.name,
    address_1: address.addressLine1,
    city: address.city,
    province_code: address.province,
    postal_code: address.postalCode,
    country_code: address.country,
    value: (subtotalCents / 100).toFixed(2),
    value_currency: "cad",
    package_type: "parcel",
    weight_unit: "lb",
    weight: pkg.weightLb.toFixed(2),
    description: "Maple Imprint custom order",
    postage_type: "unknown",
    order_id: fingerprint,
  };
  if (address.addressLine2?.trim()) body.address_2 = address.addressLine2;
  if (pkg.dimensionsIn) {
    body.size_unit = "in";
    body.size_x = pkg.dimensionsIn.length.toFixed(2);
    body.size_y = pkg.dimensionsIn.width.toFixed(2);
    body.size_z = pkg.dimensionsIn.height.toFixed(2);
  }

  let response: Response;
  try {
    response = await fetch(shipmentsUrl, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    // Network failure reaching Chit Chats itself (outage, DNS, timeout) -- never silently
    // downgraded to a fabricated rate, see this file's header.
    throw new ShippingRateUnavailableError(
      "We couldn't reach our shipping carrier right now — request a quote and we'll confirm shipping manually.",
    );
  }

  if (!response.ok) {
    // A 4xx here is how Chit Chats reports an unsupported destination or an oversized/restricted
    // parcel for THIS specific request -- propagated as the same "no fabricated rate" error every
    // other rejection path in this provider uses, never guessed at or retried as something else.
    throw new ShippingRateUnavailableError(
      "Chit Chats couldn't quote this shipment — request a quote and we'll confirm shipping manually.",
    );
  }

  let data: ChitChatsCreateShipmentResponse;
  try {
    data = (await response.json()) as ChitChatsCreateShipmentResponse;
  } catch {
    throw new ShippingRateUnavailableError(
      "We received an unexpected response from our shipping carrier — request a quote and we'll confirm shipping manually.",
    );
  }

  return mapChitChatsRateEntries(data.rates ?? []);
};

/**
 * Quotes DELIVERY only, the same contract as CanadaPostShippingProvider: always either returns at
 * least one real delivery option or throws ShippingRateUnavailableError, never an empty/degraded
 * array, and never bundles Ottawa pickup into its result.
 *
 * getOptions() ALWAYS attempts a real rate fetch before it ever decides whether the result should
 * be free -- see this file's header "SERVICEABILITY" note. A failure here (unsupported
 * destination, oversized/restricted parcel, outage) is never silently downgraded into a $0
 * fabricated rate; it propagates as ShippingRateUnavailableError, routing the customer to a manual
 * shipping quote instead, exactly like a Canada Post failure already does.
 */
export class ChitChatsShippingProvider implements ShippingQuoteProvider {
  // Not a TS parameter-property -- see canadaPostShippingProvider.ts's identical note; plain
  // `node --test`'s strip-only mode can't parse that syntax, and this file's own test needs to
  // run under it directly.
  private readonly rateFetcher: ChitChatsRateFetcher;
  private readonly cache: ChitChatsRateCache;
  private readonly coordinator: ChitChatsQuoteCoordinator | undefined;

  // `cache` defaults to a FRESH instance per provider instance (not a shared module-level
  // singleton) -- see chitChatsRateCache.ts's header. That means every `new
  // ChitChatsShippingProvider()` call, including the one default-constructed for every test in
  // this file, gets its own isolated cache: tests never see stale results left behind by an
  // earlier test's fake fetcher, and the real activated singleton (shippingProvider.ts's eventual
  // export) still gets one persistent cache for its whole process lifetime, since it's
  // constructed exactly once.
  //
  // `coordinator` defaults to undefined -- NOT auto-constructed against a real Supabase-backed
  // store, unlike `cache`. The table its underlying store would query (ChitChatsShippingQuote)
  // doesn't exist until supabase/migrations/010_chit_chats_shipping_quotes.sql is reviewed and
  // applied; passing one in is an explicit, separate activation step a caller takes once that's
  // approved, not a default this class should ever silently assume. Without it, behavior is
  // identical to before cross-instance persistence existed: in-memory-only caching, single-instance.
  // See chitChatsQuoteCoordinator.ts for the full claim/wait/takeover/reconcile algorithm this
  // delegates to -- this class no longer talks to a ChitChatsQuoteStore directly at all.
  constructor(rateFetcher: ChitChatsRateFetcher = fetchChitChatsRates, cache: ChitChatsRateCache = new ChitChatsRateCache(), coordinator?: ChitChatsQuoteCoordinator) {
    this.rateFetcher = rateFetcher;
    this.cache = cache;
    this.coordinator = coordinator;
  }

  async getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]> {
    // Runs for every destination, before anything else -- an unsupported or malformed address
    // must be rejected even on an order large enough to otherwise qualify for free shipping.
    assertAddressHasMinimumFields(address);

    // A real quote attempt needs the full recipient name/street/city -- this is also required for
    // a WOULD-BE-FREE order, since serviceability (see header) can only be confirmed by actually
    // attempting the quote, never skipped just because the result might end up being $0.
    assertFullChitChatsAddress(address);

    const parcelWeightLb = estimateParcelWeightLb(lines);
    if (parcelWeightLb === null) {
      throw new ShippingRateUnavailableError(
        "We don't have a shipping weight for everything in your cart yet — request a quote and we'll confirm shipping manually.",
      );
    }

    const pkg: ChitChatsPackageInput = { weightLb: parcelWeightLb, dimensionsIn: null };
    const cacheKeyInput = { address, subtotalCents, pkg };

    // Tier 1: in-memory, this provider instance only. Reuses a prior real quote for the identical
    // address/subtotal/parcel instead of creating another Chit Chats shipment record for a cart
    // that hasn't actually changed (see chitChatsRateCache.ts's header for exactly why this
    // matters -- there's no quote-only endpoint, so every miss is a real shipment creation).
    const cached = this.cache.get(cacheKeyInput);
    let liveRates: ShippingOption[];
    if (cached) {
      liveRates = cached.rates;
    } else if (this.coordinator) {
      // Tier 2: persistent, cross-serverless-instance -- delegates the full claim/wait/takeover/
      // reconcile algorithm to ChitChatsQuoteCoordinator (see that file's header). Only reached on
      // a tier-1 miss. The coordinator itself decides whether this call actually reaches the real
      // rate fetcher (only if it wins or safely recovers a claim) or waits/reuses another
      // in-flight or already-completed quote -- this class has no concurrency logic of its own.
      liveRates = await this.coordinator.getOrCreateQuote(cacheKeyInput, this.rateFetcher);
      this.cache.set(cacheKeyInput, liveRates);
    } else {
      // No persistent store configured -- identical behavior to before this round.
      // Any failure here -- not configured yet, a real outage, an unsupported destination, or an
      // oversized/restricted parcel once this is live -- propagates as-is and is NEVER cached
      // (see chitChatsRateCache.ts's set() note): a transient failure must be retried on the next
      // request, never remembered as a false, stale answer. This is also how serviceability is
      // validated -- a destination/parcel this call can't quote is, by definition, not eligible
      // for the free-shipping override below, because this line never returns for it.
      liveRates = await this.rateFetcher(address, subtotalCents, pkg);
      if (liveRates.length === 0) {
        throw new ShippingRateUnavailableError(
          "Chit Chats has no delivery service available for this address — request a quote and we'll confirm shipping manually.",
        );
      }
      this.cache.set(cacheKeyInput, liveRates);
    }

    // Free shipping is Canada-only and threshold-gated, per the owner's explicit confirmation --
    // checked only AFTER a real quote has already succeeded, so this can never apply to a
    // destination/parcel Chit Chats couldn't actually service.
    const freeShippingEligible = address.country === "CA" && subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS;
    if (!freeShippingEligible) {
      return liveRates;
    }

    // Only the cheapest quoted service becomes free -- a pricier option in the same response
    // (expedited/premium) stays at its quoted price. See header note on why "cheapest" is used as
    // the proxy for "standard" rather than an invented Chit-Chats-specific service-level name.
    let cheapestIndex = 0;
    for (let i = 1; i < liveRates.length; i++) {
      if (liveRates[i].cents < liveRates[cheapestIndex].cents) cheapestIndex = i;
    }
    const withFreeStandard = liveRates.map((opt, i) => (i === cheapestIndex ? { id: "free", label: "Free Shipping", cents: 0 } : opt));
    // Sorted cheapest-first so a caller that naively takes options[0] (today, both checkout API
    // routes do) keeps picking the free option by default, not an untouched pricier one.
    return withFreeStandard.sort((a, b) => a.cents - b.cents);
  }
}
