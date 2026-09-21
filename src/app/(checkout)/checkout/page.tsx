import type { Metadata } from "next";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/** Section 24: "Test Checkout" only ever exists when NODE_ENV !== "production" OR the explicit
 *  ENABLE_TEST_CHECKOUT=true is set — read here, server-side, from a NON-`NEXT_PUBLIC_` env var so
 *  the flag itself is never bundled into client JS (a customer's browser can't discover or flip it;
 *  it's baked into exactly one boolean prop at render time). This Server Component is the only
 *  place that reads it; CheckoutClient just receives the already-decided boolean. */
export default function CheckoutPage() {
  const testCheckoutEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_CHECKOUT === "true";

  return (
    <>
      <CheckoutHeader />
      <CheckoutClient testCheckoutEnabled={testCheckoutEnabled} />
    </>
  );
}
