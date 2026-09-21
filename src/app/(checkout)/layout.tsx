/** Checkout's dedicated shell (ACTIVATE REAL CHECKOUT brief, Section 13/12: "Do NOT show Home/
 *  Solutions/About/giant navigation menu during checkout — this is a focused conversion flow").
 *  Same pattern as (studio)/layout.tsx — a sibling route group with its own minimal layout, so the
 *  marketing Header/Footer/PageTransition are never part of this route's tree at all, not hidden
 *  with CSS. CheckoutHeader (rendered by the page itself, not here, so it can react to
 *  cart/session state) replaces the full nav with just the logo, "Secure Checkout," and "Back to
 *  Cart." No footer. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas">{children}</div>;
}
