"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import {
  STICKER_SHAPES,
  STICKER_SIZES,
  STICKER_MATERIALS,
  pricedMaterialsForShape,
  quoteSticker,
  type StickerShape,
  type StickerMaterial,
} from "@/lib/houseProducts/pricing/stickers";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import type { CatalogueProduct } from "@/lib/products";

const DEFAULT_QTY = 50;
const ALL_SHAPES: StickerShape[] = STICKER_SHAPES.map((s) => s.value);

/** `allowedShapes` restricts the shape picker — used to ship "Die-Cut Stickers" and "Kiss-Cut
 *  Stickers" as two separate catalogue products (matching the site's existing Die-cut/Kiss-cut
 *  subcategory split) while sharing this one component and the one stickers.ts pricing module.
 *  `defaultMaterial` does the same job for "Clear Stickers" — same shapes as the generic sticker
 *  product, just pre-selecting clear-plastic instead of white-plastic (still changeable). */
export function StickerConfigurator({
  product,
  allowedShapes = ALL_SHAPES,
  defaultMaterial = "white-plastic",
}: {
  product: CatalogueProduct;
  allowedShapes?: StickerShape[];
  defaultMaterial?: StickerMaterial;
}) {
  const router = useRouter();
  const [shape, setShape] = useState<StickerShape>(allowedShapes[0]);
  const [sizeKey, setSizeKey] = useState<string>(STICKER_SIZES[allowedShapes[0]][1]?.key ?? STICKER_SIZES[allowedShapes[0]][0].key);
  const [material, setMaterial] = useState<StickerMaterial>(() => {
    const priced = pricedMaterialsForShape(allowedShapes[0]);
    return priced.includes(defaultMaterial) ? defaultMaterial : priced[0];
  });
  const [quantity, setQuantity] = useState(DEFAULT_QTY);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const sizesForShape = STICKER_SIZES[shape];
  const materialsForShape = pricedMaterialsForShape(shape);
  const sizeDef = sizesForShape.find((s) => s.key === sizeKey) ?? sizesForShape[0];

  // Size/material lists depend on shape — if the shape changes and the current selection isn't
  // valid for the new shape, snap to its first valid option right in the handler (not an effect)
  // so there's never a render with a stale size/material combo that doesn't belong to this shape.
  function handleShapeChange(next: StickerShape) {
    setShape(next);
    const nextSizes = STICKER_SIZES[next];
    if (!nextSizes.some((s) => s.key === sizeKey)) setSizeKey(nextSizes[0].key);
    const nextMaterials = pricedMaterialsForShape(next);
    if (!nextMaterials.includes(material)) setMaterial(nextMaterials[0]);
  }

  const quote = useMemo(
    () => quoteSticker({ shape, sizeKey, material, quantity }),
    [shape, sizeKey, material, quantity],
  );

  const shapeOptions: OptionCardGridItem[] = STICKER_SHAPES.filter((s) => allowedShapes.includes(s.value)).map((s) => ({
    value: s.value,
    label: s.label,
  }));

  const sizeOptions: OptionCardGridItem[] = useMemo(
    () =>
      sizesForShape.map((s) => {
        const q = quoteSticker({ shape, sizeKey: s.key, material: materialsForShape[0], quantity: DEFAULT_QTY });
        return {
          value: s.key,
          label: s.label,
          priceDelta: !isQuoteError(q) ? `From $${(q.unitPriceCents / 100).toFixed(2)}/ea` : undefined,
        };
      }),
    [shape, sizesForShape, materialsForShape],
  );

  const materialOptions: OptionCardGridItem[] = useMemo(
    () =>
      materialsForShape.map((m) => ({
        value: m,
        label: STICKER_MATERIALS.find((x) => x.value === m)?.label ?? m,
      })),
    [materialsForShape],
  );

  async function handleDesign() {
    if (isQuoteError(quote) || startingStudio) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      getOrCreateClientSessionToken();
      const shapeLabel = STICKER_SHAPES.find((s) => s.value === shape)?.label ?? shape;
      const materialLabel = STICKER_MATERIALS.find((m) => m.value === material)?.label ?? material;

      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productSlug: product.slug,
          categorySlug: product.categorySlug,
          subcategorySlug: product.subcategorySlug,
          productName: `${shapeLabel} Stickers`,
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
          sides: [{ type: "sticker-face", widthIn: sizeDef.widthIn, heightIn: sizeDef.heightIn }],
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
      {allowedShapes.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Shape</p>
          <div className="mt-2">
            <OptionCardGrid options={shapeOptions} selected={shape} onSelect={(v) => handleShapeChange(v as StickerShape)} />
          </div>
        </div>
      )}

      <div className={allowedShapes.length > 1 ? "mt-4" : undefined}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size</p>
        <div className="mt-2">
          <OptionCardGrid options={sizeOptions} selected={sizeKey} onSelect={setSizeKey} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Material</p>
        <div className="mt-2">
          <OptionCardGrid options={materialOptions} selected={material} onSelect={(v) => setMaterial(v as StickerMaterial)} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity</p>
        <input
          type="number"
          min={10}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(10, Math.round(Number(e.target.value) || 10)))}
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
            {quote.isEstimate && (
              <p className="mt-1 text-xs text-muted">Estimated pricing for this shape/size/material combination.</p>
            )}
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
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : "Design Your Stickers →"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
