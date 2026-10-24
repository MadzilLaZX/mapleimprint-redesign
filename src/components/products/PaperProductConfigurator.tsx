"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import {
  CARD_STOCKS,
  availableQuantities as cardAvailableQuantities,
  doubleSidedAvailable as cardDoubleSidedAvailable,
  roundedCornersAvailable,
  quoteBusinessCard,
  type CardStock,
} from "@/lib/houseProducts/pricing/businessCards";
import { FLYER_STOCKS, FLYER_QUANTITIES, quoteFlyer, type FlyerStock } from "@/lib/houseProducts/pricing/flyers";
import { POSTCARD_STOCKS, availableQuantities as postcardAvailableQuantities, quotePostcard, type PostcardStock } from "@/lib/houseProducts/pricing/postcards";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import { PricingGuideFlyout, type PricingGuideRow } from "@/components/products/PricingGuideFlyout";
import type { CatalogueProduct } from "@/lib/products";

type PaperKind = "business-card" | "flyer" | "postcard";

/** Shared by business cards, flyers and postcards — same three controls (stock, sides, quantity),
 *  same Studio-kickoff path, just pointed at a different pricing module and print-area pair. Kept
 *  as one component with a `kind` branch rather than three near-identical ones. */
export function PaperProductConfigurator({
  product,
  kind,
}: {
  product: CatalogueProduct;
  kind: PaperKind;
}) {
  const router = useRouter();
  const isCard = kind === "business-card";
  const isPostcard = kind === "postcard";
  const [stock, setStock] = useState<string>(
    isCard ? CARD_STOCKS[0].value : isPostcard ? POSTCARD_STOCKS[0].value : FLYER_STOCKS[0].value,
  );
  const [sides, setSides] = useState<"single" | "double">("single");
  const [quantity, setQuantity] = useState<number>(isPostcard ? 100 : 100);
  const [roundedCorners, setRoundedCorners] = useState(false);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const quantityOptions = useMemo(() => {
    if (isCard) return cardAvailableQuantities(stock as CardStock);
    if (isPostcard) return postcardAvailableQuantities();
    return [...FLYER_QUANTITIES];
  }, [isCard, isPostcard, stock]);

  const quote = useMemo(() => {
    if (isCard) return quoteBusinessCard({ stock: stock as CardStock, quantity, sides, roundedCorners });
    if (isPostcard) return quotePostcard({ stock: stock as PostcardStock, quantity, sides });
    return quoteFlyer({ stock: stock as FlyerStock, sides, quantity });
  }, [isCard, isPostcard, stock, quantity, sides, roundedCorners]);

  const canOfferDoubleSided = isCard ? cardDoubleSidedAvailable(stock as CardStock) : true;
  const canOfferRoundedCorners = isCard && sides === "single" && roundedCornersAvailable(stock as CardStock);

  const stockOptions: OptionCardGridItem[] = useMemo(() => {
    if (isCard) {
      return CARD_STOCKS.map((s) => {
        const qty = cardAvailableQuantities(s.value)[0];
        const q = quoteBusinessCard({ stock: s.value, quantity: qty, sides: "single" });
        return {
          value: s.value,
          label: s.label,
          priceDelta: !isQuoteError(q) ? `From $${(q.totalCents / 100).toFixed(2)}` : undefined,
        };
      });
    }
    if (isPostcard) {
      const qty = postcardAvailableQuantities()[0];
      return POSTCARD_STOCKS.map((s) => {
        const q = quotePostcard({ stock: s.value, quantity: qty, sides: "single" });
        return {
          value: s.value,
          label: s.label,
          priceDelta: !isQuoteError(q) ? `From $${(q.totalCents / 100).toFixed(2)}` : undefined,
        };
      });
    }
    return FLYER_STOCKS.map((s) => {
      const q = quoteFlyer({ stock: s.value, sides: "single", quantity: FLYER_QUANTITIES[0] });
      return {
        value: s.value,
        label: s.label,
        priceDelta: !isQuoteError(q) ? `From $${(q.totalCents / 100).toFixed(2)}` : undefined,
      };
    });
  }, [isCard, isPostcard]);

  const sidesOptions: OptionCardGridItem[] = useMemo(
    () => [
      { value: "single", label: "Single-sided" },
      {
        value: "double",
        label: "Double-sided",
        disabled: !canOfferDoubleSided,
        disabledReason: canOfferDoubleSided ? undefined : "Not available for this stock",
      },
    ],
    [canOfferDoubleSided],
  );

  const roundedCornersOptions: OptionCardGridItem[] = useMemo(
    () => [
      { value: "no", label: "Square corners" },
      {
        value: "yes",
        label: "Rounded corners",
        disabled: !canOfferRoundedCorners,
        disabledReason: !canOfferRoundedCorners ? (sides === "double" ? "Single-sided only" : "Not available for this stock") : undefined,
      },
    ],
    [canOfferRoundedCorners, sides],
  );

  const pricingGuideRows: PricingGuideRow[] = useMemo(() => {
    const rows: PricingGuideRow[] = [];
    for (const qty of quantityOptions) {
      const q = isCard
        ? quoteBusinessCard({ stock: stock as CardStock, quantity: qty, sides, roundedCorners })
        : isPostcard
          ? quotePostcard({ stock: stock as PostcardStock, quantity: qty, sides })
          : quoteFlyer({ stock: stock as FlyerStock, sides, quantity: qty });
      if (!isQuoteError(q)) rows.push({ qty, totalCents: q.totalCents, perUnitCents: q.unitPriceCents });
    }
    return rows;
  }, [isCard, isPostcard, stock, sides, roundedCorners, quantityOptions]);

  function handleSidesChange(value: string) {
    const nextSides = value as "single" | "double";
    setSides(nextSides);
    // Rounded corners are single-sided only — clear a stale selection on switching to
    // double-sided so the quote doesn't turn into a hard error with no visible cause.
    if (nextSides === "double") setRoundedCorners(false);
  }

  function handleStockChange(value: string) {
    setStock(value);
    const nextQuantities = isCard
      ? cardAvailableQuantities(value as CardStock)
      : isPostcard
        ? postcardAvailableQuantities()
        : [...FLYER_QUANTITIES];
    if (!nextQuantities.includes(quantity)) setQuantity(nextQuantities[0]);
    if (isCard && !cardDoubleSidedAvailable(value as CardStock)) setSides("single");
    if (isCard && !roundedCornersAvailable(value as CardStock)) setRoundedCorners(false);
  }

  async function handleDesign() {
    if (isQuoteError(quote) || startingStudio) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      getOrCreateClientSessionToken();

      const frontType = isCard ? "card-front" : isPostcard ? "postcard-front" : "flyer-front";
      const backType = isCard ? "card-back" : isPostcard ? "postcard-back" : "flyer-back";
      // Both sides created eagerly when double-sided is chosen — the customer already paid for
      // both, they shouldn't have to go find a "More locations" menu to reach the one they picked.
      const sideTypes = sides === "double" ? [frontType, backType] : [frontType];

      const stockLabel = (isCard ? CARD_STOCKS : isPostcard ? POSTCARD_STOCKS : FLYER_STOCKS).find((s) => s.value === stock)?.label ?? stock;

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
          // No colour concept for a paper product — the stock choice is the closest analog and
          // reads sensibly wherever Studio/cart display "colour" (e.g. "Business Cards — Matte").
          colourName: stockLabel,
          sizeBreakdown: [{ size: sides === "double" ? "Double-sided" : "Single-sided", qty: quantity }],
          totalQuantity: quantity,
          // Only the choices — /api/studio computes the price from these (studio/serverPricing.ts).
          pricingOptions: { stock, sides, roundedCorners },
          mockupImages: {},
          sides: sideTypes.map((type) => ({ type })),
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

  const designLabel = isCard ? "Cards" : isPostcard ? "Postcards" : "Flyer";

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Paper stock</p>
        <div className="mt-2">
          <OptionCardGrid options={stockOptions} selected={stock} onSelect={handleStockChange} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Sides</p>
        <div className="mt-2">
          <OptionCardGrid options={sidesOptions} selected={sides} onSelect={handleSidesChange} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity</p>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mt-2 w-full rounded-xl border border-sand bg-white px-4 py-3 text-sm text-ink-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
        >
          {quantityOptions.map((q) => (
            <option key={q} value={q}>
              {q.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {isCard && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Corners</p>
          <div className="mt-2">
            <OptionCardGrid
              options={roundedCornersOptions}
              selected={roundedCorners ? "yes" : "no"}
              onSelect={(v) => setRoundedCorners(v === "yes")}
            />
          </div>
        </div>
      )}

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
            <div className="mt-2">
              <PricingGuideFlyout rows={pricingGuideRows} />
            </div>
            {isPostcard && "priceIsEstimate" in quote && quote.priceIsEstimate && (
              <p className="mt-1 text-xs text-muted">Estimated pricing for this configuration.</p>
            )}
          </>
        )}
      </div>

      {studioError && (
        <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{studioError}</p>
      )}

      <button
        type="button"
        onClick={handleDesign}
        disabled={isQuoteError(quote) || startingStudio}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : `Design Your ${designLabel} →`}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
