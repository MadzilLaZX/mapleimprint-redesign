import type { ShippingAddressInput, ShippingOption, ShippingQuoteLine, ShippingQuoteProvider } from "./shippingProvider";
// Explicit .ts extension -- required by plain `node --test` (this file's own test imports it
// directly), matching the convention already used in canadaPostShippingProvider.ts.
import { ShippingRateUnavailableError, estimateParcelWeightLb } from "./canadaPostShippingProvider.ts";
import { validatePostalCode } from "./validation.ts";

// Architecture for the owner-confirmed shipping policy, NOT wired in as the live `shippingProvider`
// export (see shippingProvider.ts) -- Chit Chats replaces Canada Post as the PLANNED primary
// carrier, but no live rate call is ever made in this codebase today: no CHIT_CHATS_* credential
// exists anywhere (verified by grep), and Chit Chats' own API has no quote-only endpoint --
// POST /shipments always creates a persistent shipment record, even for a rate check. Treating any
// live call to that endpoint as equivalent to "creating a real shipment" means it must never be
// called outside of an injected test fixture this round, consistent with the standing "no real
// shipments without approval" instruction and the fact that no real credentials exist to call it
// with anyway.
//
// Confirmed owner policy (business owner, 2026-11-12):
//   - Free shipping across all of Canada for orders with an eligible merchandise subtotal
//     STRICTLY OVER CAD $300.00 before tax (after discounts) -- $300.00 exactly does not qualify,
//     $300.01 does.
//   - International orders never qualify for the free-shipping promotion, regardless of subtotal.
//   - Orders at or below $300, and all international orders where Chit Chats can fulfill them,
//     get a real calculated Chit Chats rate.
//   - Free Ottawa local pickup remains available, but it is a separate fulfillment choice (see
//     OTTAWA_PICKUP_OPTION in canadaPostShippingProvider.ts) -- never returned by this provider.
//
// Packaging / parcelization, as researched against the real Chit Chats API docs
// (https://chitchats.com/docs/api/v1):
//   - A Chit Chats shipment carries ONE package per request (weight, weight_unit, and optional
//     size_x/size_y/size_z dimensions). This provider treats an entire cart as a single logical
//     parcel -- summing weight across every line via estimateParcelWeightLb() (the same verified
//     weight pipeline CanadaPostShippingProvider uses, reused rather than duplicated). True
//     multi-parcel splitting (e.g. when a cart's combined weight would exceed a single real-world
//     box) is NOT implemented, because it would require a per-product maximum-parcel-weight or
//     dimension rule that doesn't exist anywhere in this codebase and is not invented here.
//   - Dimensions (size_x/size_y/size_z): no product in the catalogue carries a per-unit dimension
//     today (same confirmed gap documented in canadaPostShippingProvider.ts -- only S&S's inferred
//     per-case dimensions exist, which aren't authoritative for a single unit). This provider does
//     NOT hard-block a quote on missing dimensions, since the docs don't show them as a strictly
//     required field and a fabricated box size would be a worse error than an approximate
//     weight-only rate -- the real rate fetcher should pass dimensions through when they become
//     available and omit them otherwise, never invent one.
//   - Oversized/unsupported parcels: this codebase has no confirmed real weight/size limit for any
//     Chit Chats service level (not present in the documentation reviewed). Rather than guessing a
//     threshold, an oversized or otherwise unshippable parcel is expected to surface as a real,
//     specific error from the live Chit Chats API once this is active -- propagated as-is via
//     ShippingRateUnavailableError, never silently dropped, retried into a different package type,
//     or guessed around.
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
 *  that lightweight preview step will always hit this check. That's a real, honest gap: a true
 *  Chit Chats rate can't be produced without more address data than the quote step collects
 *  today, not something to work around by guessing a name or street address. */
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

/** The real Chit Chats API call, once credentials and a confirmed request shape exist. Exposed as
 *  an injectable constructor parameter (default: this function) so a test can verify the real
 *  weight is threaded through correctly without a live Chit Chats account -- the same pattern
 *  CanadaPostRateFetcher already uses in canadaPostShippingProvider.ts. */
export type ChitChatsRateFetcher = (
  address: ShippingAddressInput,
  subtotalCents: number,
  pkg: ChitChatsPackageInput,
) => Promise<ShippingOption>;

// Throws deliberately rather than returning a guessed/flat rate -- inventing a shipping fee here
// would violate the same "never fabricate a charge" rule as taxProvider.ts and
// canadaPostShippingProvider.ts. Replace this body with a real call to Chit Chats'
// POST /clients/<id>/shipments once an API access token and client ID exist.
const fetchChitChatsRate: ChitChatsRateFetcher = async (_address, _subtotalCents, _pkg) => {
  throw new ShippingRateUnavailableError(
    "Live shipping rates aren't available yet for this order — request a quote and we'll confirm shipping manually.",
  );
};

/**
 * Quotes DELIVERY only, the same contract as CanadaPostShippingProvider: always either returns a
 * real delivery option or throws ShippingRateUnavailableError, never an empty/degraded array, and
 * never bundles Ottawa pickup into its result. See that file's own header comment for the full
 * reasoning -- it applies identically here.
 *
 * Differences from CanadaPostShippingProvider, both deliberate:
 *   - Free shipping requires BOTH subtotalCents over the threshold AND a Canadian destination --
 *     the owner's confirmed policy explicitly excludes international orders from the promotion
 *     regardless of order size, where Canada Post (Canada-only already) had no need for that
 *     second condition.
 *   - Address validation (assertAddressHasMinimumFields) runs for every destination, not just
 *     Canadian ones, and runs BEFORE the free-shipping check -- preserving eligibility/address
 *     validation even when shipping ends up free is an explicit owner requirement, and an
 *     unsupported or malformed destination must never be waved through with a free label.
 */
export class ChitChatsShippingProvider implements ShippingQuoteProvider {
  // Not a TS parameter-property -- see canadaPostShippingProvider.ts's identical note; plain
  // `node --test`'s strip-only mode can't parse that syntax, and this file's own test needs to
  // run under it directly.
  private readonly rateFetcher: ChitChatsRateFetcher;

  constructor(rateFetcher: ChitChatsRateFetcher = fetchChitChatsRate) {
    this.rateFetcher = rateFetcher;
  }

  async getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]> {
    // Runs for every destination, before the free-shipping check below -- an unsupported or
    // malformed address must be rejected even on an order large enough to otherwise qualify free.
    assertAddressHasMinimumFields(address);

    // Free shipping is Canada-only, per the owner's explicit confirmation -- an international
    // order never qualifies for this promotion regardless of subtotal, so this checks BOTH
    // conditions rather than reusing CanadaPostShippingProvider's subtotal-only check.
    if (address.country === "CA" && subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS) {
      return [{ id: "free", label: "Free Shipping", cents: 0 }];
    }

    // Past this point a real paid quote is required -- Chit Chats needs the full recipient
    // name/street/city to build a shipment/rate request, which the address validated above does
    // not guarantee (see assertFullChitChatsAddress's own note on today's /quote step).
    assertFullChitChatsAddress(address);

    const parcelWeightLb = estimateParcelWeightLb(lines);
    if (parcelWeightLb === null) {
      throw new ShippingRateUnavailableError(
        "We don't have a shipping weight for everything in your cart yet — request a quote and we'll confirm shipping manually.",
      );
    }

    // Any failure here -- not configured yet, or a real Chit Chats outage/unsupported-destination
    // response once this is live -- propagates as-is, same reasoning as CanadaPostShippingProvider:
    // the customer asked for delivery, delivery could not be quoted, and that must block checkout
    // with a clear reason, never silently reroute to a fulfillment method they didn't choose.
    const liveRate = await this.rateFetcher(address, subtotalCents, { weightLb: parcelWeightLb, dimensionsIn: null });
    return [liveRate];
  }
}
