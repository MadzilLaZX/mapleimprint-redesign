"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import { PROMO_VARIANTS, quotePromo, type PromoKind } from "@/lib/houseProducts/pricing/promo";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import type { CatalogueProduct } from "@/lib/products";

/** One configurator shared across every promo-product kind (tote bag/pen/notebook/keychain/
 *  magnet/phone stand) — same `kind`-branch shape as DrinkwareConfigurator. */
export function PromoConfigurator({ product, kind }: { product: CatalogueProduct; kind: PromoKind }) {
  const router = useRouter();
  const variants = PROMO_VARIANTS[kind];
  const [variantKey, setVariantKey] = useState<string>(variants[0].key);
  const variant = variants.find((v) => v.key === variantKey) ?? variants[0];
  const [quantity, setQuantity] = useState(variant.minQty);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const quote = useMemo(() => quotePromo({ kind, variantKey, quantity }), [kind, variantKey, quantity]);

  const variantOptions: OptionCardGridItem[] = variants.map((v) => {
    const q = quotePromo({ kind, variantKey: v.key, quantity: v.minQty });
    return {
      value: v.key,
      label: v.label,
      sublabel: `Min ${v.minQty.toLocaleString()}`,
      priceDelta: !isQuoteError(q) ? `From $${(q.unitPriceCents / 100).toFixed(2)}` : undefined,
    };
  });

  function handleVariantChange(nextKey: string) {
    setVariantKey(nextKey);
    const next = variants.find((v) => v.key === nextKey);
    if (next && quantity < next.minQty) setQuantity(next.minQty);
  }

  async function handleDesign() {
    if (isQuoteError(quote) || startingStudio) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      getOrCreateClientSessionToken();

      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productSlug: product.slug,
          categorySlug: product.categorySlug,
          subcategorySlug: product.subcategorySlug,
          productName: product.name,
          brandName: product.brandName,
          colourName: variant.label,
          sizeBreakdown: [{ size: variant.label, qty: quantity }],
          totalQuantity: quantity,
          // Only the choices — /api/studio computes the price from these (studio/serverPricing.ts).
          pricingOptions: { variantKey },
          mockupImages: {},
          // Reuses the generic "accessory" family's front location — promo items (bags, pens,
          // notebooks, keychains, magnets, phone stands) are too physically varied to share one
          // dedicated print area the way mugs/banners/stickers do; see familyFor()'s
          // gifts-promo mapping.
          sides: [{ type: "front" }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start your design.");
      router.push(`/studio/${data.id}`);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : "Couldn't start your design. Please try again.");
      setStartingStudio(false);
    }
  }

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Style</p>
        <div className="mt-2">
          <OptionCardGrid options={variantOptions} selected={variantKey} onSelect={handleVariantChange} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity (min {variant.minQty.toLocaleString()})</p>
        <input
          type="number"
          min={variant.minQty}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(variant.minQty, Math.round(Number(e.target.value) || variant.minQty)))}
          className="mt-2 w-full rounded-xl border border-sand bg-white px-4 py-3 text-sm text-ink-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
        />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4">
        {isQuoteError(quote) ? (
          <p className="flex items-start gap-1.5 text-sm text-crimson">
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
            {quote.error}
          </p>
        ) : (
          <>
            <p className="font-display text-lg font-semibold text-ink-900">
              ${(quote.totalCents / 100).toFixed(2)}
              <span className="text-sm font-normal text-muted"> for {quantity.toLocaleString()}</span>
            </p>
            <p className="text-xs text-muted">${(quote.unitPriceCents / 100).toFixed(2)} each</p>
            {quote.priceIsEstimate && <p className="mt-1 text-xs text-muted">Estimated pricing at this quantity.</p>}
          </>
        )}
      </div>

      {studioError && <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{studioError}</p>}

      <button
        type="button"
        onClick={handleDesign}
        disabled={isQuoteError(quote) || startingStudio}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : "Design This →"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
