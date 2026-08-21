"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useCart, QUOTE_PREFILL_KEY, type CartItem } from "@/components/cart/CartProvider";
import { PRIMARY_CTA } from "@/lib/constants";
import { cn } from "@/lib/cn";

/** Real per-unit price for this item's CURRENT quantity — uses the tier matching `item.quantity`
 *  when the customizer attached a tier table, falling back to the flat startingPrice (lowest-tier
 *  quick-add) otherwise. Keeps the price honest if quantity is adjusted from the cart. */
function unitPriceFor(item: CartItem): number | null {
  if (item.priceTiers && item.priceTiers.length > 0) {
    const tier = item.priceTiers.find(
      (t) => item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty),
    );
    return tier ? tier.pricePerUnit : null;
  }
  return item.startingPrice ?? null;
}

export function CartView() {
  const { items, removeItem, updateQuantity, totalCount } = useCart();
  const router = useRouter();

  const pricedItems = items.filter((i) => unitPriceFor(i) !== null);
  const unpricedCount = items.length - pricedItems.length;
  const estimatedSubtotal = pricedItems.reduce((sum, i) => sum + (unitPriceFor(i) ?? 0) * i.quantity, 0);

  function handleGetQuote() {
    const summary = items.map((i) => `${i.name} x${i.quantity}`).join(", ");
    window.sessionStorage.setItem(QUOTE_PREFILL_KEY, summary);
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
          Browse the shop and add items you&apos;re interested in. We&apos;ll turn your cart into a scoped
          quote, no payment required yet.
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
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 py-5">
            <Link href={`/products/${item.categorySlug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl">
              <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
            </Link>
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
                    item.customizationType === "MAPLE_ASSISTED" && "bg-orange/10 text-orange",
                  )}
                >
                  {item.customizationType === "BLANK" && "Blank — no printing"}
                  {item.customizationType === "CUSTOM" && "Custom design"}
                  {item.customizationType === "MAPLE_ASSISTED" && "Design help requested"}
                </p>
              )}
              {(() => {
                const price = unitPriceFor(item);
                return price !== null ? (
                  <p className="mt-0.5 text-xs text-muted">${price.toFixed(2)} / unit</p>
                ) : null;
              })()}
            </div>
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
            <button
              type="button"
              aria-label={`Remove ${item.name} from cart`}
              onClick={() => removeItem(item.id)}
              className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-crimson/10 hover:text-crimson"
            >
              <Trash className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-[28px] bg-canvas p-6">
        {pricedItems.length > 0 && (
          <div className="mb-4 flex items-center justify-between border-b border-ink-950/10 pb-4">
            <p className="text-sm font-semibold text-ink-900">Estimated subtotal</p>
            <p className="font-display text-lg font-semibold text-ink-900">
              ${estimatedSubtotal.toFixed(2)}
            </p>
          </div>
        )}
        <p className="text-sm leading-relaxed text-muted">
          {pricedItems.length > 0
            ? `Based on each item's lowest quantity price, before decoration or rush fees${unpricedCount > 0 ? `. ${unpricedCount} item${unpricedCount === 1 ? "" : "s"} in your cart ${unpricedCount === 1 ? "doesn't" : "don't"} have pricing yet and will be quoted directly.` : ", confirmed exactly in your quote."}`
            : "Pricing depends on decoration, quantity tiers and turnaround, so it's confirmed in your quote rather than shown here."}
          {" "}Submitting sends this list straight into a project quote request.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={handleGetQuote} showArrow>
            Get a quote for these items
          </Button>
          <Button href={PRIMARY_CTA.href} variant="secondary" tone="light">
            Keep browsing
          </Button>
        </div>
      </div>
    </Container>
  );
}
