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
 * SCOPE, DELIBERATELY LIMITED -- read before assuming this handles every cart:
 *   - Only a cart containing a SINGLE distinct product is ever resolved. Combining several
 *     DIFFERENT physical boxes (or several different products sharing one box) into one accurate
 *     outer dimension is a real 3D bin-packing problem this codebase has no authoritative way to
 *     solve -- guessing a "combined box" would be exactly the kind of fabricated dimension this
 *     file exists to prevent. A mixed-product cart routes to a manual quote until a real
 *     multi-parcel-per-order flow exists (Chit Chats shipments are one package each -- confirmed
 *     against the live spec -- and nothing in this codebase splits an order across several
 *     shipments today).
 *   - A quantity that wouldn't fit in one box (exceeds `maxUnitsPerPackage`, or the resulting
 *     weight exceeds `maxWeightLbPerPackage`) also routes to a manual quote, for the same reason --
 *     needing multiple packages is a real limitation, not something to paper over by returning an
 *     under-counted single box.
 *   - NOT wired into ChitChatsShippingProvider.getOptions() yet: that requires `ShippingQuoteLine`
 *     (shippingProvider.ts) to carry a stable product identifier, which it doesn't today (only
 *     `unitWeightLb`/`quantity`) -- threading one through touches the checkout pricing pipeline
 *     (priceCartItem.ts) and both checkout API routes, a wider change than building this module
 *     itself warrants while PACKAGING_PROFILES is still empty (see below) and would have zero
 *     behavioral effect either way. This file is the tested, ready-to-integrate piece; wiring it
 *     in is the next, separate, small step once real profiles exist.
 */

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

  const [line] = lines;
  if (line.quantity < 1) return null;

  const profileId = PRODUCT_PACKAGING_ASSIGNMENTS[line.productId];
  if (!profileId) return null;
  const profile = PACKAGING_PROFILES[profileId];
  if (!profile) return null; // assignment points at a profile that doesn't exist -- data error, never guess

  if (line.quantity > profile.maxUnitsPerPackage) return null; // would need multiple packages

  const weightLb = productWeightLb + profile.emptyWeightLb;
  if (weightLb > profile.maxWeightLbPerPackage) return null; // would need multiple packages

  return { dimensionsIn: profile.outerDimensionsIn, weightLb };
}
