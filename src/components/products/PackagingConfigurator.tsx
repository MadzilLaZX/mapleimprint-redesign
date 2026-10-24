"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import {
  PRODUCT_BOX_SIZES,
  MAILER_BOX_SIZES,
  TISSUE_SIZES,
  TISSUE_WEIGHTS,
  TAPE_ROLL_OPTIONS,
  quotePackaging,
  type PackagingKind,
} from "@/lib/houseProducts/pricing/packaging";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import type { CatalogueProduct } from "@/lib/products";

const REFERENCE_QTY: Record<PackagingKind, number> = { "product-box": 100, "mailer-box": 144, "tissue-paper": 100, "packaging-tape": 1 };

/** One configurator shared across every packaging kind (product box/mailer box/tissue paper/
 *  packaging tape) — same `kind`-branch shape as PromoConfigurator. These map to the "accessory"
 *  Studio family (see productDecorationProfile.ts's familyFor()), same as gifts-promo: a box
 *  panel, a tissue sheet, and a tape strip are too physically different to share one dedicated
 *  print area, but all read fine as a simple front/back logo+phrase mark. */
export function PackagingConfigurator({ product, kind }: { product: CatalogueProduct; kind: PackagingKind }) {
  const router = useRouter();
  const isBox = kind === "product-box" || kind === "mailer-box";
  const isTissue = kind === "tissue-paper";
  const isTape = kind === "packaging-tape";
  const boxSizes = kind === "product-box" ? PRODUCT_BOX_SIZES : kind === "mailer-box" ? MAILER_BOX_SIZES : [];

  const [sizeKey, setSizeKey] = useState(isBox ? boxSizes[0].key : isTissue ? TISSUE_SIZES[0].key : "");
  const [weight, setWeight] = useState<10 | 18 | 30>(10);
  const [rollKey, setRollKey] = useState(TAPE_ROLL_OPTIONS[0].value);
  const [quantity, setQuantity] = useState(REFERENCE_QTY[kind]);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const quote = useMemo(
    () => quotePackaging({ kind, sizeKey: sizeKey || undefined, rollKey: isTape ? rollKey : undefined, weight: isTissue ? weight : undefined, quantity }),
    [kind, sizeKey, rollKey, weight, quantity, isTape, isTissue],
  );

  const boxSizeOptions: OptionCardGridItem[] = boxSizes.map((s) => {
    const q = quotePackaging({ kind, sizeKey: s.key, quantity: REFERENCE_QTY[kind] });
    return { value: s.key, label: s.label, priceDelta: !isQuoteError(q) ? `From $${(q.unitPriceCents / 100).toFixed(2)}` : undefined };
  });
  const tissueSizeOptions: OptionCardGridItem[] = TISSUE_SIZES.map((s) => ({ value: s.key, label: s.label }));
  const weightOptions: OptionCardGridItem[] = TISSUE_WEIGHTS.map((w) => ({ value: String(w), label: `${w}#` }));
  const rollOptions: OptionCardGridItem[] = TAPE_ROLL_OPTIONS.map((r) => ({ value: r.value, label: r.label }));

  const sizeLabel = isBox
    ? boxSizes.find((s) => s.key === sizeKey)?.label
    : isTissue
      ? TISSUE_SIZES.find((s) => s.key === sizeKey)?.label
      : TAPE_ROLL_OPTIONS.find((r) => r.value === rollKey)?.label;

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
          colourName: sizeLabel ?? product.name,
          sizeBreakdown: [{ size: sizeLabel ?? "Standard", qty: quantity }],
          totalQuantity: quantity,
          // Only the choices — /api/studio computes the price from these (studio/serverPricing.ts).
          pricingOptions: { sizeKey: sizeKey || undefined, rollKey: isTape ? rollKey : undefined, weight: isTissue ? weight : undefined },
          mockupImages: {},
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
      {isBox && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size (L x W x H)</p>
          <div className="mt-2">
            <OptionCardGrid options={boxSizeOptions} selected={sizeKey} onSelect={setSizeKey} />
          </div>
        </div>
      )}

      {isTissue && (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Sheet Size</p>
            <div className="mt-2">
              <OptionCardGrid options={tissueSizeOptions} selected={sizeKey} onSelect={setSizeKey} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Weight</p>
            <div className="mt-2">
              <OptionCardGrid options={weightOptions} selected={String(weight)} onSelect={(v) => setWeight(Number(v) as 10 | 18 | 30)} />
            </div>
          </div>
        </>
      )}

      {isTape && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Roll Length</p>
          <div className="mt-2">
            <OptionCardGrid options={rollOptions} selected={rollKey} onSelect={setRollKey} />
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
