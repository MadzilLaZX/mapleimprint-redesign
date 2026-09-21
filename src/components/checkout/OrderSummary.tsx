"use client";

import { useState } from "react";
import Image from "next/image";
import { CaretDown, SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { DesignPreviewThumbnail } from "@/components/cart/DesignPreviewThumbnail";
import type { CartItem } from "@/components/cart/CartProvider";
import type { QuoteLineResult } from "@/app/api/checkout/quote/route";

export interface SummaryLine {
  item: CartItem;
  quote: QuoteLineResult | undefined;
}

interface OrderSummaryProps {
  lines: SummaryLine[];
  subtotal: number | null;
  loading: boolean;
  quoteOnlyCount: number;
}

/** Section 19/28/29: product preview + name + colour + size quantities + customization type +
 *  decorated locations + line price, then Subtotal/Delivery/Tax/Total — using "Calculated at next
 *  step" style copy for values genuinely not configured yet rather than a misleading $0.00
 *  (Section 19: "customers interpret $0 as final"). One component renders both the desktop sticky
 *  column and the mobile collapsible bar (`lg:` split, same convention as Studio's InspectorDock),
 *  rather than two components drifting apart. */
export function OrderSummary({ lines, subtotal, loading, quoteOnlyCount }: OrderSummaryProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const body = (
    <>
      <ul className="space-y-3">
        {lines.map(({ item, quote }) => (
          <li key={item.id} className="flex items-start gap-3">
            {item.customizationType === "CUSTOM" && item.designProjectId ? (
              <DesignPreviewThumbnail designProjectId={item.designProjectId} widthPx={48} fallbackImage={item.image} />
            ) : (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
              <p className="truncate text-xs text-muted">
                {item.colourName}
                {item.sizeBreakdown && item.sizeBreakdown.length > 0 && <> · {item.sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")}</>}
              </p>
              {item.customizationType === "CUSTOM" && <p className="text-[11px] text-crimson">Custom design</p>}
            </div>
            <p className="shrink-0 text-sm font-semibold text-ink-900">
              {loading ? <SpinnerGap className="size-3.5 animate-spin text-muted" weight="bold" /> : quote?.mode === "CHECKOUT_READY" && quote.lineTotal !== null ? `$${quote.lineTotal.toFixed(2)}` : "—"}
            </p>
          </li>
        ))}
      </ul>

      {quoteOnlyCount > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-orange/10 px-3 py-2 text-xs text-ink-900">
          <WarningCircle className="mt-0.5 size-3.5 shrink-0 text-orange" weight="bold" />
          {quoteOnlyCount} item{quoteOnlyCount === 1 ? "" : "s"} in your cart need{quoteOnlyCount === 1 ? "s" : ""} a quote and {quoteOnlyCount === 1 ? "isn't" : "aren't"} included here.
        </p>
      )}

      <div className="space-y-1.5 border-t border-sand pt-4 text-sm">
        <div className="flex justify-between text-ink-900/70">
          <span>Subtotal</span>
          <span>{loading || subtotal === null ? <SpinnerGap className="size-3.5 animate-spin" weight="bold" /> : `$${subtotal.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-ink-900/70">
          <span>Delivery</span>
          <span>Calculated at next step</span>
        </div>
        <div className="flex justify-between text-ink-900/70">
          <span>Tax</span>
          <span>Calculated at next step</span>
        </div>
        <div className="flex justify-between border-t border-sand pt-2 font-display text-base font-semibold text-ink-900">
          <span>Total</span>
          <span>{loading || subtotal === null ? "—" : `$${subtotal.toFixed(2)}+`}</span>
        </div>
        <p className="pt-1 text-[11px] text-muted">Final total is shown before payment.</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: sticky within the checkout content, not the whole page (Section 28). */}
      <div className="hidden lg:sticky lg:top-6 lg:block lg:space-y-4 lg:rounded-2xl lg:border lg:border-sand lg:bg-white lg:p-5">
        <p className="font-display text-base font-semibold text-ink-900">Order Summary</p>
        {body}
      </div>

      {/* Mobile: collapsed bar showing the total, tap to expand (Section 29) — never hides the
          total itself. */}
      <div className="rounded-2xl border border-sand bg-white lg:hidden">
        <button type="button" onClick={() => setMobileOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4">
          <span className="font-display text-sm font-semibold text-ink-900">
            Order Summary {!loading && subtotal !== null && `· $${subtotal.toFixed(2)}`}
          </span>
          <CaretDown className={cn("size-4 text-ink-900/40 transition-transform", mobileOpen && "rotate-180")} weight="bold" />
        </button>
        {mobileOpen && <div className="space-y-4 border-t border-sand px-5 py-5">{body}</div>}
      </div>
    </>
  );
}
