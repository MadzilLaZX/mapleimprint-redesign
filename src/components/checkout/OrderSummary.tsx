"use client";

import { useState } from "react";
import Image from "next/image";
import { CaretDown, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { CartItem } from "@/components/cart/CartProvider";

export interface CheckoutQuote {
  subtotalCents: number;
  shippingCents: number;
  shippingOption: { label: string };
  taxCents: number;
  totalCents: number;
  currency: string;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function SummaryLines({ items, quote, quoteLoading }: { items: CartItem[]; quote: CheckoutQuote | null; quoteLoading: boolean }) {
  return (
    <>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-canvas">
              <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink-950 text-[10px] font-bold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
              <p className="truncate text-xs text-muted">
                {item.colourName}
                {item.sizeBreakdown && item.sizeBreakdown.length > 0 && (
                  <> · {item.sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")}</>
                )}
              </p>
              {item.customizationType === "CUSTOM" && (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-crimson">Custom design</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1.5 border-t border-sand pt-4 text-sm">
        {quoteLoading || !quote ? (
          <p className="flex items-center gap-2 text-muted">
            <SpinnerGap className="size-3.5 animate-spin" weight="bold" />
            Calculating…
          </p>
        ) : (
          <>
            <div className="flex justify-between text-ink-900/70">
              <span>Subtotal</span>
              <span>{money(quote.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-ink-900/70">
              <span>{quote.shippingOption.label}</span>
              <span>{quote.shippingCents === 0 ? "Free" : money(quote.shippingCents)}</span>
            </div>
            <div className="flex justify-between text-ink-900/70">
              <span>Tax</span>
              <span>{money(quote.taxCents)}</span>
            </div>
            <div className="flex justify-between border-t border-sand pt-2 font-display text-base font-semibold text-ink-900">
              <span>Total</span>
              <span>{money(quote.totalCents)}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function OrderSummary({ items, quote, quoteLoading }: { items: CartItem[]; quote: CheckoutQuote | null; quoteLoading: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop — sticky, always expanded */}
      <div className="hidden lg:sticky lg:top-6 lg:block lg:rounded-[24px] lg:bg-white lg:p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Order Summary</h2>
        <div className="mt-4">
          <SummaryLines items={items} quote={quote} quoteLoading={quoteLoading} />
        </div>
      </div>

      {/* Mobile — collapsible bar near the top */}
      <div className="rounded-[20px] bg-white lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
          aria-expanded={mobileOpen}
        >
          <span className="text-sm font-semibold text-ink-900">
            Order Summary · {quote ? money(quote.totalCents) : "…"}
          </span>
          <CaretDown className={cn("size-4 text-ink-900/60 transition-transform", mobileOpen && "rotate-180")} weight="bold" />
        </button>
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <SummaryLines items={items} quote={quote} quoteLoading={quoteLoading} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
