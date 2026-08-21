"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { useCart, QUOTE_PREFILL_KEY } from "@/components/cart/CartProvider";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import { blankUnitPrice, calculateCustomizePrice } from "@/lib/studio/pricing";
import { LeaveItToUsPanel } from "@/components/products/LeaveItToUsPanel";
import type { CatalogueProduct } from "@/lib/products";

const VISIBLE_COLOUR_COUNT = 8;

export function ProductCustomizer({
  product,
  categoryName,
  selectedColour,
  onColourChange,
}: {
  product: CatalogueProduct;
  categoryName: string;
  selectedColour: string;
  onColourChange: (colour: string) => void;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showAllColours, setShowAllColours] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [addedBlank, setAddedBlank] = useState(false);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [showAssistPanel, setShowAssistPanel] = useState(false);

  const availableSizes = useMemo(
    () => product.sizes.filter((size) => product.variants.some((v) => v.colourName === selectedColour && v.size === size)),
    [product.sizes, product.variants, selectedColour],
  );

  const totalQty = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const sizeBreakdown = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([size, qty]) => ({ size, qty }));

  const blankPrice = blankUnitPrice(product);
  const quoteOnly = blankPrice === null;
  const customizePricing = totalQty > 0 ? calculateCustomizePrice(product, totalQty, 1) : null;

  const visibleColours = showAllColours ? product.colours : product.colours.slice(0, VISIBLE_COLOUR_COUNT);
  const hiddenColourCount = product.colours.length - VISIBLE_COLOUR_COUNT;

  function setQty(size: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [size]: Math.max(0, qty) }));
  }

  function selectColour(colour: string) {
    const stillAvailable = (size: string) => product.variants.some((v) => v.colourName === colour && v.size === size);
    const lostSizes = Object.entries(quantities)
      .filter(([size, qty]) => qty > 0 && !stillAvailable(size))
      .map(([size]) => size);

    if (lostSizes.length > 0) {
      setQuantities((prev) => {
        const next = { ...prev };
        for (const size of lostSizes) next[size] = 0;
        return next;
      });
      setAvailabilityNotice(
        `${lostSizes.join(", ")} isn't currently available in ${colour}. Choose another size, or a different colour.`,
      );
    } else {
      setAvailabilityNotice(null);
    }
    onColourChange(colour);
  }

  async function handleCustomize() {
    if (totalQty === 0 || !customizePricing) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      // Ensures the mi-session cookie exists before the request fires — the API route reads it
      // from the request, it doesn't need the value passed explicitly.
      getOrCreateClientSessionToken();
      const sides: ("front" | "back")[] = ["front"];
      if (product.images.some((img) => img.imageType === "back")) sides.push("back");

      const frontImage =
        product.images.find((img) => img.colourName === selectedColour && img.imageType === "front")?.url ??
        product.images.find((img) => img.colourName === selectedColour)?.url ??
        product.images[0]?.url;
      const backImage = product.images.find((img) => img.colourName === selectedColour && img.imageType === "back")?.url;

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
          colourName: selectedColour,
          sizeBreakdown,
          totalQuantity: totalQty,
          pricingSnapshot: {
            unitBasePrice: customizePricing.blankUnitPrice,
            designFee: customizePricing.designFee,
            chartFirstLocationCost: customizePricing.chartFirstLocationCost,
            chartAdditionalLocationCost: customizePricing.chartAdditionalLocationCost,
            quantity: totalQty,
            total: customizePricing.total,
            printRuleVersion: product.printRuleVersion,
          },
          mockupImages: { front: frontImage, ...(backImage ? { back: backImage } : {}) },
          sides,
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

  function handleBuyBlank() {
    if (totalQty === 0 || blankPrice === null) return;
    addItem(
      {
        id: `${product.categorySlug}-${product.subcategorySlug}-${product.slug}-${selectedColour}-blank`,
        name: product.name,
        image: product.images.find((i) => i.colourName === selectedColour)?.url ?? product.images[0]?.url ?? "",
        categorySlug: product.categorySlug,
        categoryName,
        startingPrice: blankPrice,
        colourName: selectedColour,
        sizeBreakdown,
        customizationType: "BLANK",
      },
      totalQty,
    );
    setAddedBlank(true);
    setQuantities({});
    window.setTimeout(() => setAddedBlank(false), 1800);
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
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">
            Colour <span className="font-normal normal-case text-muted">— {selectedColour}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleColours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectColour(c)}
                aria-pressed={c === selectedColour}
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
            {!showAllColours && hiddenColourCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllColours(true)}
                className="rounded-full border border-dashed border-sand px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-ink-950/25 hover:text-ink-900"
              >
                Show all {product.colours.length} colours
              </button>
            )}
          </div>
        </div>
      )}

      {availabilityNotice && (
        <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{availabilityNotice}</p>
      )}

      {availableSizes.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Quantity per size</p>
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
          <p className="text-sm text-muted">Choose at least one size to continue.</p>
        ) : (
          <div>
            <p className="text-sm text-muted">{totalQty} unit{totalQty === 1 ? "" : "s"}</p>
            <p className="font-display text-lg font-semibold text-ink-900">
              ${blankPrice!.toFixed(2)} / unit blank
              {customizePricing && <span className="text-sm font-normal text-muted"> · ${customizePricing.total.toFixed(2)} customized</span>}
            </p>
          </div>
        )}
      </div>

      {studioError && (
        <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{studioError}</p>
      )}

      <div className="mt-4 space-y-3">
        {quoteOnly ? (
          <button
            type="button"
            onClick={handleRequestQuote}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3 text-sm font-semibold text-ink-950"
          >
            Request a quote
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCustomize}
              disabled={totalQty === 0 || startingStudio}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {startingStudio ? (
                <SpinnerGap className="size-4 animate-spin" weight="bold" />
              ) : (
                "Customize This Shirt →"
              )}
            </button>
            <p className="text-center text-xs text-muted">Add your logo, artwork or text in Maple Studio.</p>

            <button
              type="button"
              onClick={handleBuyBlank}
              disabled={totalQty === 0}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                addedBlank ? "border-transparent bg-ink-950 text-white" : "border-ink-950/20 text-ink-900 hover:bg-canvas",
              )}
            >
              {addedBlank ? (
                <>
                  <Check className="size-4" weight="bold" /> Added to cart
                </>
              ) : (
                "Buy It Blank"
              )}
            </button>
            <p className="text-center text-xs text-muted">No print or design. Just the garment.</p>

            <div className="pt-1 text-center">
              <p className="text-xs text-muted">Not comfortable designing it yourself?</p>
              <button
                type="button"
                onClick={() => setShowAssistPanel(true)}
                className="mt-1 text-xs font-semibold text-crimson underline-offset-2 hover:underline"
              >
                Leave It to Us →
              </button>
            </div>
          </>
        )}
      </div>

      {showAssistPanel && (
        <LeaveItToUsPanel
          product={product}
          categoryName={categoryName}
          selectedColour={selectedColour}
          sizeBreakdown={sizeBreakdown.length > 0 ? sizeBreakdown : [{ size: product.sizes[0] ?? "One size", qty: 1 }]}
          totalQuantity={Math.max(1, totalQty)}
          onClose={() => setShowAssistPanel(false)}
        />
      )}
    </div>
  );
}
