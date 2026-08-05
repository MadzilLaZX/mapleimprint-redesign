"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { useCart, QUOTE_PREFILL_KEY } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import type { CatalogueProduct } from "@/lib/products";

function priceForQuantity(tiers: CatalogueProduct["priceTiers"], qty: number): number | null {
  if (!tiers || qty <= 0) return null;
  const tier = tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
  return tier ? tier.pricePerUnit : null;
}

export function ProductCustomizer({
  product,
  categoryName,
}: {
  product: CatalogueProduct;
  categoryName: string;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [selectedColour, setSelectedColour] = useState(product.colours[0] ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);

  const availableSizes = useMemo(
    () => product.sizes.filter((size) => product.variants.some((v) => v.colourName === selectedColour && v.size === size)),
    [product.sizes, product.variants, selectedColour],
  );

  const totalQty = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const unitPrice = priceForQuantity(product.priceTiers, totalQty);
  const subtotal = unitPrice !== null ? unitPrice * totalQty : null;
  const quoteOnly = product.priceTiers === null;

  function setQty(size: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [size]: Math.max(0, qty) }));
  }

  function selectColour(colour: string) {
    setSelectedColour(colour);
    setQuantities({}); // sizes/quantities may not carry over cleanly between colourways
  }

  function handleAddToCart() {
    const sizeBreakdown = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => ({ size, qty }));
    if (sizeBreakdown.length === 0) return;

    addItem(
      {
        id: `${product.categorySlug}-${product.subcategorySlug}-${product.slug}-${selectedColour}`,
        name: product.name,
        image: product.images[0]?.url ?? "",
        categorySlug: product.categorySlug,
        categoryName,
        startingPrice: product.startingPrice,
        priceTiers: product.priceTiers ?? undefined,
        colourName: selectedColour,
        sizeBreakdown,
      },
      totalQty,
    );
    setAdded(true);
    setQuantities({});
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleRequestQuote() {
    const summary = `${product.name}${selectedColour ? ` (${selectedColour})` : ""}`;
    window.sessionStorage.setItem(QUOTE_PREFILL_KEY, summary);
    router.push("/contact?type=quote");
  }

  return (
    <div>
      {product.colours.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Colour</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.colours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectColour(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  c === selectedColour
                    ? "border-transparent bg-ink-950 text-white"
                    : "border-sand bg-white text-ink-900/70 hover:border-ink-950/25",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableSizes.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">
            Quantity per size
          </p>
          <div className="mt-2 space-y-2">
            {availableSizes.map((size) => (
              <div key={size} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                <span className="text-sm font-medium text-ink-900">{size}</span>
                <div className="flex items-center gap-1 rounded-full border border-sand p-1">
                  <button
                    type="button"
                    aria-label={`Decrease ${size} quantity`}
                    onClick={() => setQty(size, (quantities[size] ?? 0) - 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-canvas"
                  >
                    <Minus className="size-3.5" weight="bold" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={quantities[size] ?? 0}
                    onChange={(e) => setQty(size, Number(e.target.value) || 0)}
                    className="w-10 bg-transparent text-center text-sm font-semibold text-ink-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${size} quantity`}
                    onClick={() => setQty(size, (quantities[size] ?? 0) + 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-canvas"
                  >
                    <Plus className="size-3.5" weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white p-4">
        {quoteOnly ? (
          <p className="text-sm text-muted">
            This product isn&apos;t on our standard print-cost chart yet, so pricing is confirmed in
            a quote rather than shown here.
          </p>
        ) : totalQty === 0 ? (
          <p className="text-sm text-muted">Enter a quantity per size to see your price.</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">
                {totalQty} unit{totalQty === 1 ? "" : "s"} · ${unitPrice?.toFixed(2)} / unit
              </p>
              <p className="font-display text-lg font-semibold text-ink-900">
                ${subtotal?.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        {quoteOnly ? (
          <Button onClick={handleRequestQuote} showArrow>
            Request a quote
          </Button>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={totalQty === 0}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              added ? "bg-ink-950 text-white" : "bg-maple-gradient text-ink-950",
            )}
          >
            {added ? (
              <>
                <Check className="size-4" weight="bold" /> Added to cart
              </>
            ) : (
              <>
                <ShoppingBagOpen className="size-4" weight="bold" /> Add to cart
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
