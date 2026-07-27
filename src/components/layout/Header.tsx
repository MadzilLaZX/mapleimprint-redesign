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

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/95 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between lg:h-[72px]">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <Image
            src="/logo/logo-lockup.png"
            alt="Maple Imprint Ltd."
            width={1529}
            height={432}
            priority
            className="h-8 w-auto lg:h-9"
          />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-6 text-sm font-medium text-white/80">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "transition-colors hover:text-white",
                      active && "text-white",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <button
            type="button"
            aria-label="Search"
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <MagnifyingGlass className="size-5" />
          </button>
          <Link
            href="/cart"
            aria-label="Cart"
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ShoppingBag className="size-5" />
          </Link>
          <Link href={SECONDARY_CTA.href} className="text-sm font-medium text-white/80 hover:text-white">
            {SECONDARY_CTA.label}
          </Link>
          <Button href={PRIMARY_CTA.href} variant="primary" tone="dark" className="text-sm">
            {PRIMARY_CTA.label}
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-white lg:hidden"
        >
          {open ? <X className="size-6" /> : <List className="size-6" />}
        </button>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/10 bg-ink-950 lg:hidden"
          >
            <Container className="flex flex-col gap-1 py-6">
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
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
                <Button href={SECONDARY_CTA.href} variant="secondary" tone="dark" onClick={() => setOpen(false)}>
                  {SECONDARY_CTA.label}
                </Button>
                <Button href={PRIMARY_CTA.href} variant="primary" tone="dark" onClick={() => setOpen(false)}>
                  {PRIMARY_CTA.label}
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
