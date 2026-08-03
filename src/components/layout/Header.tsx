"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { List, MagnifyingGlass, ShoppingBag, X } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS, PRIMARY_CTA, SECONDARY_CTA } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useCart } from "@/components/cart/CartProvider";

// A steadier, more even glide than the site's usual snappy ease-out — used
// for header chrome that appears/disappears while the user is reading, so
// it should never feel like a jump-cut.
const TRANSITION = { duration: 0.55, ease: [0.65, 0, 0.35, 1] as const };

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { totalCount } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/95 backdrop-blur-md">
      <Container wide className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-6 lg:h-24">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 justify-self-start"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo/logo-mark-no-tagline.png"
            alt="Maple Imprint Ltd."
            width={1529}
            height={432}
            priority
            className="h-11 w-auto sm:h-12 lg:h-14"
          />
          <span className="hidden h-8 w-px bg-white/15 lg:block" aria-hidden />
          <span className="hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 lg:block">
            Let&rsquo;s print
            <br />
            your story
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden justify-self-center 2xl:block">
          <ul className="flex items-center gap-4 text-sm font-medium text-white/80">
            <AnimatePresence mode="popLayout" initial={false}>
              {pathname !== "/" && (
                <motion.li
                  key="home"
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={TRANSITION}
                >
                  <Link href="/" className="whitespace-nowrap transition-colors hover:text-white">
                    Home
                  </Link>
                </motion.li>
              )}
            </AnimatePresence>
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <motion.li key={link.href} layout transition={TRANSITION}>
                  <Link
                    href={link.href}
                    className={cn(
                      "whitespace-nowrap transition-colors hover:text-white",
                      active && "text-white",
                    )}
                  >
                    {link.label}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2.5 justify-self-end">
          <div className="hidden items-center gap-2.5 2xl:flex">
            <button
              type="button"
              aria-label="Search"
              className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <MagnifyingGlass className="size-5" />
            </button>
            <Link
              href="/cart"
              aria-label={`Cart${totalCount > 0 ? `, ${totalCount} item${totalCount === 1 ? "" : "s"}` : ""}`}
              className="relative rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShoppingBag className="size-5" />
              <AnimatePresence>
                {totalCount > 0 && (
                  <motion.span
                    key="cart-count"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-maple-gradient text-[10px] font-bold text-ink-950"
                  >
                    {totalCount > 9 ? "9+" : totalCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            <AnimatePresence mode="popLayout" initial={false}>
              {!pathname.startsWith("/contact") && (
                <motion.div
                  key="get-a-quote"
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={TRANSITION}
                >
                  <Link
                    href={SECONDARY_CTA.href}
                    className="whitespace-nowrap px-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
                  >
                    {SECONDARY_CTA.label}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {!pathname.startsWith("/products") && (
                <motion.div
                  key="start-designing"
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={TRANSITION}
                >
                  <Button href={PRIMARY_CTA.href} variant="primary" tone="dark" className="text-sm">
                    {PRIMARY_CTA.label}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-white 2xl:hidden"
          >
            {open ? <X className="size-6" /> : <List className="size-6" />}
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/10 bg-ink-950 2xl:hidden"
          >
            <Container className="flex flex-col gap-1 py-6">
              {pathname !== "/" && (
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-white/85 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Home
                </Link>
              )}
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-white/85 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium text-white/85 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ShoppingBag className="size-5" />
                Cart{totalCount > 0 ? ` (${totalCount})` : ""}
              </Link>
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
                {!pathname.startsWith("/contact") && (
                  <Button href={SECONDARY_CTA.href} variant="secondary" tone="dark" onClick={() => setOpen(false)}>
                    {SECONDARY_CTA.label}
                  </Button>
                )}
                {!pathname.startsWith("/products") && (
                  <Button href={PRIMARY_CTA.href} variant="primary" tone="dark" onClick={() => setOpen(false)}>
                    {PRIMARY_CTA.label}
                  </Button>
                )}
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
