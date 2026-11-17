/**
 * Owner-maintained REAL packaging measurements -- the piece of data this codebase has never had a
 * place to put: the actual box Maple Imprint ships a given product in, as opposed to a supplier's
 * own bulk/case packaging (a completely different thing -- see the note below) or an invented
 * placeholder size.
 *
 * WHY THIS EXISTS: Chit Chats' real API requires size_x/size_y/size_z on every rate request
 * (confirmed against the live OpenAPI spec -- see chitChatsShippingProvider.ts's header), and no
 * product in the catalogue carries a per-unit shipping dimension (confirmed in
 * canadaPostShippingProvider.ts's and catalogue-engine/src/shipping/normalizeWeight.ts's own
 * notes). This means NO real Chit Chats rate can ever succeed until some real dimension data
 * exists somewhere -- this file is that "somewhere," built so filling it in later is a data-entry
 * task, not an engineering one.
 *
 * NOT THE SAME THING AS SUPPLIER CASE DIMENSIONS: normalizeWeight.ts's `caseDimensionsIn` describes
 * a SUPPLIER's bulk shipping carton (e.g. a case of 24 polo shirts shipped TO Maple Imprint's own
 * warehouse) -- it says nothing about the box Maple Imprint later ships ONE customer's order IN.
 * Treating a supplier case dimension as a customer-shipment package dimension would be exactly the
 * kind of fabricated physical fact this codebase's standing rules forbid. This file's profiles are
 * real boxes Maple Imprint itself uses for OUTBOUND customer shipments, measured by a real person.
 *
 * HOW TO ADD A REAL ENTRY, once you've physically measured a box Maple Imprint actually uses:
 *   1. Add a `PackagingProfile` to PACKAGING_PROFILES below with its real outer dimensions (inches),
 *      its own empty weight (lb), and the real maximum units of the target product it can safely
 *      hold (`maxUnitsPerPackage`) and a weight cap as a second safety margin
 *      (`maxWeightLbPerPackage`).
 *   2. Add an entry to PRODUCT_PACKAGING_ASSIGNMENTS mapping that product's catalogue id/slug (see
 *      src/lib/products.ts for the identifier this codebase already treats as canonical) to the
 *      profile id from step 1.
 *   3. Nothing else needs to change -- resolvePackaging() below picks it up automatically, and
 *      ChitChatsShippingProvider's dimensions-required preflight check (see
 *      chitChatsShippingProvider.ts) stops refusing real rate requests for that product the moment
 *      a real profile exists for it.
 *
 * WIRED (this round): ShippingQuoteLine (shippingProvider.ts) now carries an optional productId,
 * populated end to end from priceCartItem.ts (via buildProductId(), using the real underlying
 * CatalogueProduct) through both checkout API routes. ChitChatsShippingProvider.getOptions() calls
 * resolvePackaging() below and uses its result when available, falling back to the existing
 * weight-only/no-dimensions behavior otherwise -- see that file's ChitChatsPackageInput.dimensionsIn
 * doc comment for the exact wiring. Zero behavioral change today because PACKAGING_PROFILES/
 * PRODUCT_PACKAGING_ASSIGNMENTS are still empty; real profiles take effect automatically the
 * moment they exist, no further code change needed.
 *
 * MULTI-PARCEL ARCHITECTURE -- conservative and deliberately NOT built out further than this:
 * Chit Chats' real API creates exactly one package per shipment request (confirmed against the
 * live spec -- there is no multi-box-per-shipment field anywhere in it), and this codebase has no
 * flow for splitting one paid order across several Chit Chats shipments. Given that hard
 * constraint, there are exactly two honest outcomes resolvePackaging() can produce for "this cart
 * needs more than one box": (a) actually build a second real Chit Chats shipment for the overflow
 * -- which would require real multi-shipment-per-order support in checkout, fulfillment, and the
 * quote-coordinator's one-fingerprint-per-cart model, none of which exists today and is NOT
 * invented here; or (b) refuse and route to a manual quote. This file always takes (b): a quantity
 * exceeding `maxUnitsPerPackage`, or a resulting weight exceeding `maxWeightLbPerPackage`, resolves
 * to null exactly like a missing profile does -- never an under-counted single box, and never a
 * second box this codebase can't actually ship. The architecture IS extensible without a redesign
 * if (b) is ever revisited: `PackagingProfile` already carries the two independent caps a real
 * multi-parcel split would need to divide a quantity across N boxes, and `ResolvedPackaging` could
 * grow an array instead of a single box the day real multi-shipment support exists -- that's a
 * localized change to this file and its one call site, not a new design.
 *
 * SCOPE, DELIBERATELY LIMITED -- read before assuming this handles every cart:
 *   - Only a cart containing a SINGLE distinct product is ever resolved. Combining several
 *     DIFFERENT physical boxes (or several different products sharing one box) into one accurate
 *     outer dimension is a real 3D bin-packing problem this codebase has no authoritative way to
 *     solve -- guessing a "combined box" would be exactly the kind of fabricated dimension this
 *     file exists to prevent. A mixed-product cart routes to a manual quote, same reasoning as the
 *     multi-parcel case above.
 *   - A quantity that wouldn't fit in one box also routes to a manual quote -- see "MULTI-PARCEL
 *     ARCHITECTURE" above.
 */

/** The stable identifier this file (and ChitChatsShippingProvider) key packaging data by --
 *  src/lib/products.ts's CatalogueProduct has no single global id field, only a `slug` unique
 *  within its own categorySlug/subcategorySlug, the same compound key getProduct() itself takes.
 *  Built here once so every caller (priceCartItem.ts, PRODUCT_PACKAGING_ASSIGNMENTS' own keys)
 *  uses an identical, unambiguous string rather than each inventing its own join format. */
export function buildProductId(categorySlug: string, subcategorySlug: string, productSlug: string): string {
  return `${categorySlug}/${subcategorySlug}/${productSlug}`;
}

export interface PackagingProfile {
  id: string;
  label: string;
  /** The box's own OUTER dimensions, inches, as physically measured by a real person -- never
   *  inferred from a supplier's case dimensions (see this file's header). */
  outerDimensionsIn: { length: number; width: number; height: number };
  /** The empty box + typical dunnage weight, lb -- carriers rate on the package as it will
   *  actually be weighed, which includes the box itself, not just its contents. */
  emptyWeightLb: number;
  /** The most units of its assigned product this exact box can physically hold -- a real,
   *  physically-tested number, not a volumetric estimate. */
  maxUnitsPerPackage: number;
  /** A second, independent cap -- a carrier-practical weight limit for this box, in case the
   *  physical count cap above wouldn't itself prevent an impractically heavy package. */
  maxWeightLbPerPackage: number;
}

/**
 * NO ENTRIES YET -- intentionally empty. Every key here must correspond to a REAL, physically
 * measured box; see this file's header for how to add one. Do not add a placeholder/example entry
 * that looks real -- an empty object here is the honest, current state of this business's
 * packaging data. Every real Chit Chats rate request stays correctly blocked (see
 * chitChatsShippingProvider.ts's dimensions-required preflight check) for exactly as long as this
 * stays empty, which is the safe default, not a bug to work around.
 */
export const PACKAGING_PROFILES: Record<string, PackagingProfile> = {};

/**
 * Maps a stable product identifier (see src/lib/products.ts) to the PACKAGING_PROFILES key
 * describing the box used to ship one or more units of it. NO ENTRIES YET, same reasoning as
 * PACKAGING_PROFILES above.
 */
export const PRODUCT_PACKAGING_ASSIGNMENTS: Record<string, string> = {};

export interface PackagingCartLine {
  productId: string;
  quantity: number;
}

export interface ResolvedPackaging {
  dimensionsIn: { length: number; width: number; height: number };
  /** Product weight (already summed by estimateParcelWeightLb() -- canadaPostShippingProvider.ts)
   *  plus this box's own real empty weight. */
  weightLb: number;
}

/**
 * Resolves a real, owner-measured box for this cart, or null when it can't -- never a fabricated
 * one. See this file's header for the full set of deliberate limitations (single-product carts
 * only, one package per order). `productWeightLb` is the cart's already-computed product-only
 * weight (estimateParcelWeightLb()'s result) -- this function adds the box's own weight on top,
 * it does not recompute product weight itself, so there is exactly one place that logic lives.
 */
export function resolvePackaging(lines: PackagingCartLine[], productWeightLb: number): ResolvedPackaging | null {
  if (lines.length === 0) return null;

  const distinctProductIds = new Set(lines.map((line) => line.productId));
  if (distinctProductIds.size !== 1) return null; // mixed-product cart -- see header

  // The SAME product can legitimately appear as several separate cart lines -- different
  // colour/size variants of one style, each its own PricedCartLine/ShippingQuoteLine upstream,
  // but sharing this one productId (colour/size aren't part of it -- see buildProductId()). The
  // capacity checks below must be against the TOTAL quantity across every such line, never just
  // the first one -- using only `lines[0].quantity` here would silently ignore every other
  // variant's units and could resolve a box sized for fewer units than are actually being
  // shipped, exactly the under-counted-parcel failure mode this whole file exists to prevent.
  const [{ productId }] = lines;
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (totalQuantity < 1) return null;

  const profileId = PRODUCT_PACKAGING_ASSIGNMENTS[productId];
  if (!profileId) return null;
  const profile = PACKAGING_PROFILES[profileId];
  if (!profile) return null; // assignment points at a profile that doesn't exist -- data error, never guess

  if (totalQuantity > profile.maxUnitsPerPackage) return null; // would need multiple packages

  const weightLb = productWeightLb + profile.emptyWeightLb;
  if (weightLb > profile.maxWeightLbPerPackage) return null; // would need multiple packages

  return { dimensionsIn: profile.outerDimensionsIn, weightLb };
}
