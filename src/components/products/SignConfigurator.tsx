"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import { SIGN_SIZES, SIGN_MATERIALS, quoteSign, type SignKind, type SignMaterial } from "@/lib/houseProducts/pricing/signs";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import type { CatalogueProduct } from "@/lib/products";

/** One configurator shared across every sign kind (yard/rigid/window-cling) — same `kind`-branch
 *  shape as PromoConfigurator/DrinkwareConfigurator. These map to the "banner" Studio family (see
 *  productDecorationProfile.ts's familyFor()) since each is a single flat print surface at an
 *  arbitrary width/height, exactly what "banner-face" already models — so the design canvas, the
 *  template library, and the aspect-ratio-safe composition rules all come for free. */
export function SignConfigurator({ product, kind }: { product: CatalogueProduct; kind: SignKind }) {
  const router = useRouter();
  const sizes = SIGN_SIZES[kind];
  const materials = SIGN_MATERIALS[kind];
  const [sizeKey, setSizeKey] = useState(sizes[Math.min(2, sizes.length - 1)].key);
  const [material, setMaterial] = useState<SignMaterial>(materials[0].value);
  const [quantity, setQuantity] = useState(1);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const size = sizes.find((s) => s.key === sizeKey) ?? sizes[0];
  const quote = useMemo(() => quoteSign({ kind, sizeKey, material, quantity }), [kind, sizeKey, material, quantity]);

  const sizeOptions: OptionCardGridItem[] = sizes.map((s) => {
    const q = quoteSign({ kind, sizeKey: s.key, material, quantity: 1 });
    return { value: s.key, label: s.label, priceDelta: !isQuoteError(q) ? `From $${(q.unitPriceCents / 100).toFixed(2)}` : undefined };
  });
  const materialOptions: OptionCardGridItem[] = materials.map((m) => ({ value: m.value, label: m.label }));

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
          colourName: materials.find((m) => m.value === material)?.label ?? material,
          sizeBreakdown: [{ size: size.label, qty: quantity }],
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
          sides: [{ type: "banner-face", widthIn: size.widthIn, heightIn: size.heightIn }],
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size</p>
        <div className="mt-2">
          <OptionCardGrid options={sizeOptions} selected={sizeKey} onSelect={setSizeKey} />
        </div>
      </div>

      {materials.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Material</p>
          <div className="mt-2">
            <OptionCardGrid options={materialOptions} selected={material} onSelect={(v) => setMaterial(v as SignMaterial)} />
          </div>
        </div>
      )}

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
            {quote.isEstimate && <p className="mt-1 text-xs text-muted">Estimated pricing — confirmed on your quote before production.</p>}
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
