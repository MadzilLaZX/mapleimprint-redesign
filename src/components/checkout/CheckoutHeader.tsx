"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockSimple } from "@phosphor-icons/react/dist/ssr";

/** Dedicated checkout header (Section 13) — logo, "Secure Checkout," "Back to Cart." Deliberately
 *  not the site's Header component: no nav links, no Get a Quote, no Start Designing, no cart
 *  badge — a focused conversion flow, matching Studio's own TopBar precedent of a route having its
 *  own minimal chrome instead of reusing the marketing header. */
export function CheckoutHeader() {
  return (
    <header className="border-b border-sand bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo/logo-mark-no-tagline.png" alt="Maple Imprint Ltd." width={1529} height={432} className="h-8 w-auto" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-900/50 sm:flex items-center gap-1">
            <LockSimple className="size-3" weight="bold" /> Secure Checkout
          </span>
        </Link>
        <Link
          href="/cart"
          className="flex items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-950/25 hover:bg-canvas"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          Back to Cart
        </Link>
      </div>
    </header>
  );
}
