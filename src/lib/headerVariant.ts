// One place that decides which header content applies to a route, instead of the pathname checks
// that used to be duplicated inline in Header.tsx (desktop nav AND the mobile menu each had their
// own copy of `!pathname.startsWith("/products")`, and neither covered /shop or /cart at all —
// which is why "Start Designing" was showing up on the shop page despite the intent already being
// "don't show it once the customer is shopping"). Studio isn't handled here at all — it has its
// own route group with no Header in its layout tree (see src/app/(studio)/layout.tsx), so there's
// no "studio variant" branch to maintain in sync with anything.

export type HeaderVariant = "marketing" | "commerce";

/** Routes where the customer is already inside the shop → product → customize flow. The
 *  page-specific CTA ("Customize This Shirt", "View Item", "Approve & add to cart") already does
 *  the job "Start Designing" would be redundantly duplicating, so it's dropped for this variant —
 *  everything else in the header (nav links, Get a Quote, search, cart) stays the same. */
const COMMERCE_PATH_PREFIXES = ["/shop", "/products", "/cart"];

export function headerVariantFor(pathname: string): HeaderVariant {
  const isCommerce = COMMERCE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return isCommerce ? "commerce" : "marketing";
}
