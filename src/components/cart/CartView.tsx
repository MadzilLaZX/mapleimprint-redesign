"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useCart, QUOTE_PREFILL_KEY, type CartItem } from "@/components/cart/CartProvider";
import { DesignPreviewThumbnail } from "@/components/cart/DesignPreviewThumbnail";
import { purchaseModeForItem, splitCartByPurchaseMode, unitPriceFor } from "@/lib/commerce/purchaseMode";
import { PRIMARY_CTA } from "@/lib/constants";
import { cn } from "@/lib/cn";

/** Section 10: the generic line-level +/- is only safe when a line represents exactly one size.
 *  `updateQuantity` sets the line's single aggregate `quantity` directly and never touches
 *  `sizeBreakdown` — so a line configured as e.g. S×1, M×2 (quantity 3) gets silently corrupted
 *  the moment +/- is clicked (quantity changes, the breakdown that's supposed to sum to it does
 *  not). This is a real, pre-existing data-model gap, not something introduced here — the fix
 *  scopes the stepper to where it's actually safe rather than building a full per-size in-cart
 *  editor (out of scope for this pass; called out in the implementation report). */
function canAdjustQuantity(item: CartItem): boolean {
  return !item.sizeBreakdown || item.sizeBreakdown.length <= 1;
}

function summarizeItems(items: CartItem[]): string {
  return items.map((i) => `${i.name} x${i.quantity}`).join(", ");
}

export function CartView() {
  const { items, removeItem, updateQuantity, totalCount } = useCart();
  const router = useRouter();

  const split = splitCartByPurchaseMode(items);
  const estimatedSubtotal = split.readyItems.reduce((sum, i) => sum + (unitPriceFor(i) ?? 0) * i.quantity, 0);

  function requestQuoteFor(quoteItems: CartItem[]) {
    window.sessionStorage.setItem(QUOTE_PREFILL_KEY, summarizeItems(quoteItems));
    router.push("/contact?type=quote");
  }

  if (items.length === 0) {
    return (
      <Container className="max-w-lg text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-white">
          <ShoppingBag className="size-7 text-muted" />
        </span>
        <h2 className="mt-6 font-display text-2xl font-semibold text-ink-900">Your cart is empty</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Browse the shop and add items you&apos;re interested in — most products check out right away;
          a few special projects go through a quick quote first.
        </p>
        <Button href={PRIMARY_CTA.href} className="mt-8" showArrow>
          Browse products
        </Button>
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {totalCount} item{totalCount === 1 ? "" : "s"}
        </h2>
      </div>

      <ul className="mt-6 divide-y divide-sand rounded-[28px] bg-white px-6">
        {items.map((item) => {
          const mode = purchaseModeForItem(item);
          const price = unitPriceFor(item);
          const adjustable = canAdjustQuantity(item);
          return (
            <li key={item.id} className="flex items-center gap-4 py-5">
              {item.customizationType === "CUSTOM" && item.designProjectId ? (
                <DesignPreviewThumbnail designProjectId={item.designProjectId} widthPx={80} fallbackImage={item.image} />
              ) : (
                <Link href={`/products/${item.categorySlug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                  <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {item.categoryName}
                </p>
                <p className="mt-0.5 truncate font-display font-semibold text-ink-900">{item.name}</p>
                {item.colourName && (
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {item.colourName}
                    {item.sizeBreakdown && item.sizeBreakdown.length > 0 && (
                      <> · {item.sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")}</>
                    )}
                  </p>
                )}
                {item.customizationType && (
                  <p
                    className={cn(
                      "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      item.customizationType === "BLANK" && "bg-canvas text-ink-900/70",
                      item.customizationType === "CUSTOM" && "bg-crimson/10 text-crimson",
                      item.customizationType === "MAPLE_DESIGNER" && "bg-orange/10 text-orange",
                    )}
                  >
                    {item.customizationType === "BLANK" && "Blank — no printing"}
                    {item.customizationType === "CUSTOM" && "Custom design"}
                    {item.customizationType === "MAPLE_DESIGNER" && "✦ Surprise me — designer's choice"}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {price !== null ? `$${price.toFixed(2)} / unit` : mode.reason}
                </p>
              </div>
              {adjustable ? (
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-sand p-1">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-canvas"
                  >
                    <Minus className="size-3.5" weight="bold" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-ink-900">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-canvas"
                  >
                    <Plus className="size-3.5" weight="bold" />
                  </button>
                </div>
              ) : (
                // Multiple configured sizes on one line — the breakdown above is the source of
                // truth; a generic +/- here would corrupt it (Section 10). Total shown, not editable.
                <p className="shrink-0 text-xs font-semibold text-ink-900/70">{item.quantity} total</p>
              )}
              <button
                type="button"
                aria-label={`Remove ${item.name} from cart`}
                onClick={() => removeItem(item.id)}
                className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-crimson/10 hover:text-crimson"
              >
                <Trash className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Section 7: mixed cart gets an explicit, honest notice — never silently forced into one
          mode or the other. */}
      {split.mixed && (
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-orange/10 px-5 py-4 text-sm text-ink-900">
          <WarningCircle className="mt-0.5 size-4 shrink-0 text-orange" weight="bold" />
          <p>
            {split.readyItems.length} item{split.readyItems.length === 1 ? "" : "s"} can be purchased now.{" "}
            {split.quoteItems.length} item{split.quoteItems.length === 1 ? "" : "s"} need{split.quoteItems.length === 1 ? "s" : ""} a custom quote.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-[28px] bg-canvas p-6">
        {split.readyItems.length > 0 && (
          <div className="mb-4 flex items-center justify-between border-b border-ink-950/10 pb-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">Estimated subtotal</p>
              <p className="mt-0.5 text-xs text-muted">Taxes and delivery are calculated at checkout.</p>
            </div>
            <p className="font-display text-lg font-semibold text-ink-900">${estimatedSubtotal.toFixed(2)}</p>
          </div>
        )}

        {split.allQuoteRequired && (
          <p className="text-sm leading-relaxed text-muted">
            Pricing depends on decoration, quantity tiers and turnaround, so it&apos;s confirmed in your
            quote rather than shown here. Submitting sends this list straight into a project quote request.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {split.allReady && (
            <>
              <Button href="/checkout" showArrow>
                Proceed to Checkout
              </Button>
              <Button href="/shop" variant="secondary" tone="light">
                Continue Shopping
              </Button>
            </>
          )}
          {split.allQuoteRequired && (
            <>
              <Button onClick={() => requestQuoteFor(items)} showArrow>
                Request a Quote
              </Button>
              <Button href="/shop" variant="secondary" tone="light">
                Continue Shopping
              </Button>
            </>
          )}
          {split.mixed && (
            <>
              <Button href="/checkout" showArrow>
                Check Out Ready Items
              </Button>
              <Button onClick={() => requestQuoteFor(split.quoteItems)} variant="secondary" tone="light">
                Request Quote for Special Item{split.quoteItems.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </div>
        {split.allQuoteRequired && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Some projects need a quick review before we can confirm production and pricing.
          </p>
        )}
      </div>
    </Container>
  );
}
