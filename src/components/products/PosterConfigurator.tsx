"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import { POSTER_SIZES, quotePoster, type PosterOrientation } from "@/lib/houseProducts/pricing/posters";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import { SizeReferenceVisualizer } from "@/components/products/SizeReferenceVisualizer";
import type { CatalogueProduct } from "@/lib/products";

export function PosterConfigurator({ product }: { product: CatalogueProduct }) {
  const router = useRouter();
  const [sizeKey, setSizeKey] = useState<string>(POSTER_SIZES[3].key); // 18"x24" — a common default
  const [orientation, setOrientation] = useState<PosterOrientation>("portrait");
  const [quantity, setQuantity] = useState(1);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const sizeDef = POSTER_SIZES.find((s) => s.key === sizeKey) ?? POSTER_SIZES[0];
  // VistaPrint's real sizes are stored long-side-second; orientation just decides which raw
  // dimension displays as width, same approach as BannerConfigurator's orientedDims.
  const [rawA, rawB] = [sizeDef.widthIn, sizeDef.heightIn];
  const displayWidthIn = orientation === "landscape" ? Math.max(rawA, rawB) : Math.min(rawA, rawB);
  const displayHeightIn = orientation === "landscape" ? Math.min(rawA, rawB) : Math.max(rawA, rawB);

  const quote = useMemo(() => quotePoster({ sizeKey, quantity }), [sizeKey, quantity]);

  const sizeOptions: OptionCardGridItem[] = POSTER_SIZES.map((s) => {
    const q = quotePoster({ sizeKey: s.key, quantity: 1 });
    return {
      value: s.key,
      label: s.label,
      priceDelta: !isQuoteError(q) ? `From $${(q.unitPriceCents / 100).toFixed(2)}` : undefined,
    };
  });

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
          colourName: orientation === "landscape" ? "Landscape" : "Portrait",
          sizeBreakdown: [{ size: sizeDef.label, qty: quantity }],
          totalQuantity: quantity,
          pricingSnapshot: {
            unitBasePrice: quote.unitPriceCents / 100,
            designFee: 0,
            chartFirstLocationCost: 0,
            chartAdditionalLocationCost: 0,
            quantity,
            total: quote.totalCents / 100,
            printRuleVersion: product.printRuleVersion,
          },
          mockupImages: {},
          sides: [{ type: "poster-face", widthIn: displayWidthIn, heightIn: displayHeightIn }],
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Orientation</p>
        <div className="mt-2">
          <OptionCardGrid
            options={[
              { value: "portrait", label: "Vertical" },
              { value: "landscape", label: "Horizontal" },
            ]}
            selected={orientation}
            onSelect={(v) => setOrientation(v as PosterOrientation)}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size</p>
        <div className="mt-2">
          <OptionCardGrid options={sizeOptions} selected={sizeKey} onSelect={setSizeKey} />
        </div>
      </div>

      <div className="mt-4">
        <SizeReferenceVisualizer widthFt={displayWidthIn / 12} heightFt={displayHeightIn / 12} itemLabel="poster" />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity</p>
        <input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.round(Number(e.target.value) || 1)))}
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
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : "Design Your Poster →"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
