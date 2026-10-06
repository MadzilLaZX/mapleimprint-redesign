"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import {
  LABEL_SHAPES,
  LABEL_SIZES,
  LABEL_MATERIALS,
  LABEL_FORMATS,
  quoteLabel,
  type LabelShape,
  type LabelMaterial,
  type LabelFormat,
} from "@/lib/houseProducts/pricing/labels";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import type { CatalogueProduct } from "@/lib/products";

const DEFAULT_QTY = 500;

export function LabelConfigurator({ product }: { product: CatalogueProduct }) {
  const router = useRouter();
  const [shape, setShape] = useState<LabelShape>("circle");
  const [sizeKey, setSizeKey] = useState<string>(LABEL_SIZES[2].key); // 2"x2"
  const [material, setMaterial] = useState<LabelMaterial>("white-paper");
  const [format, setFormat] = useState<LabelFormat>("multi-column-roll");
  const [quantity, setQuantity] = useState(DEFAULT_QTY);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const sizeDef = LABEL_SIZES.find((s) => s.key === sizeKey) ?? LABEL_SIZES[0];

  const quote = useMemo(
    () => quoteLabel({ sizeKey, material, format, quantity }),
    [sizeKey, material, format, quantity],
  );

  const shapeOptions: OptionCardGridItem[] = LABEL_SHAPES.map((s) => ({ value: s.value, label: s.label }));
  const sizeOptions: OptionCardGridItem[] = LABEL_SIZES.map((s) => ({ value: s.key, label: s.label }));
  const materialOptions: OptionCardGridItem[] = LABEL_MATERIALS.map((m) => ({ value: m.value, label: m.label }));
  const formatOptions: OptionCardGridItem[] = LABEL_FORMATS.map((f) => ({ value: f.value, label: f.label }));

  async function handleDesign() {
    if (isQuoteError(quote) || startingStudio) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      getOrCreateClientSessionToken();
      const shapeLabel = LABEL_SHAPES.find((s) => s.value === shape)?.label ?? shape;
      const materialLabel = LABEL_MATERIALS.find((m) => m.value === material)?.label ?? material;

      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productSlug: product.slug,
          categorySlug: product.categorySlug,
          subcategorySlug: product.subcategorySlug,
          productName: `${shapeLabel} Paper Labels`,
          brandName: product.brandName,
          colourName: materialLabel,
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
          sides: [{ type: "label-face" }],
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Shape</p>
        <div className="mt-2">
          <OptionCardGrid options={shapeOptions} selected={shape} onSelect={(v) => setShape(v as LabelShape)} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size</p>
        <div className="mt-2">
          <OptionCardGrid options={sizeOptions} selected={sizeKey} onSelect={setSizeKey} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Paper</p>
        <div className="mt-2">
          <OptionCardGrid options={materialOptions} selected={material} onSelect={(v) => setMaterial(v as LabelMaterial)} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Roll format</p>
        <div className="mt-2">
          <OptionCardGrid options={formatOptions} selected={format} onSelect={(v) => setFormat(v as LabelFormat)} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity</p>
        <input
          type="number"
          min={50}
          step={50}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(50, Math.round(Number(e.target.value) || 50)))}
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
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : "Design Your Labels →"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
