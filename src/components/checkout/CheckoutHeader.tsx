"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { useCart } from "@/components/cart/CartProvider";

/** Deliberately minimal — no marketing nav, no "Start Designing"/"Get a Quote" CTAs, no footer
 *  sitemap. Rendered directly by src/app/checkout/layout.tsx rather than through the shared
 *  Header component — /checkout sits outside the (site) route group, so it never gets (site)'s
 *  Header/Footer at all (not hidden with CSS/pathname checks, simply not part of that route's
 *  layout tree), matching the (site)/(studio) split's own convention. */
export function CheckoutHeader() {
  const { totalCount: cartCount } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950">
      <Container wide className="flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image
            src="/logo/logo-mark-no-tagline.png"
            alt="Maple Imprint Ltd."
            width={1529}
            height={432}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <p className="hidden items-center gap-1.5 text-sm font-semibold text-white/85 sm:flex">
          <LockSimple className="size-4" weight="fill" />
          Secure Checkout
        </p>

        <Link
          href="/cart"
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" weight="bold" />
          Back to cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </Container>
    </header>
  );
}
