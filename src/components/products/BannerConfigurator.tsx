"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { getOrCreateClientSessionToken } from "@/lib/studio/session";
import {
  BANNER_SIZES,
  BANNER_MATERIALS,
  BANNER_BASE_PRICES,
  grommetsAvailable,
  reinforcedEdgesAvailable,
  doubleSidedAvailable,
  windFlapsEligible,
  quoteBanner,
  type BannerMaterial,
} from "@/lib/houseProducts/pricing/banners";
import { isQuoteError } from "@/lib/houseProducts/pricing/types";
import { BannerScaleVisualizer } from "@/components/products/BannerScaleVisualizer";
import { OptionCardGrid, type OptionCardGridItem } from "@/components/products/OptionCardGrid";
import { PricingGuideFlyout, type PricingGuideRow } from "@/components/products/PricingGuideFlyout";
import type { CatalogueProduct } from "@/lib/products";

// Checkpoint quantities for the pricing-guide flyout — the same set VistaPrint's own guide steps
// through. Every figure past qty 1 runs through bannerQuantityMultiplier()'s interpolation (see
// banners.ts), so this is exposing the existing estimate at more points, not adding a new one.
const GUIDE_QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 30, 40, 50, 60, 70, 80, 100];

function unitPriceAt1(sizeKey: string, material: BannerMaterial): number | null {
  const q = quoteBanner({ sizeKey, material, quantity: 1 });
  return isQuoteError(q) ? null : q.totalCents;
}

function addonToggleOptions(
  label: string,
  available: boolean,
  unavailableReason: string,
  baseUnitAt1: number | null,
  quoteWith: () => number | null,
): OptionCardGridItem[] {
  const withCents = available ? quoteWith() : null;
  const delta = withCents != null && baseUnitAt1 != null ? withCents - baseUnitAt1 : null;
  return [
    { value: "no", label: `No ${label.toLowerCase()}` },
    {
      value: "yes",
      label,
      priceDelta: delta != null ? `+$${(delta / 100).toFixed(2)}` : undefined,
      disabled: !available,
      disabledReason: available ? undefined : unavailableReason,
    },
  ];
}

export function BannerConfigurator({ product }: { product: CatalogueProduct }) {
  const router = useRouter();
  const [sizeKey, setSizeKey] = useState<string>(BANNER_SIZES[2].key); // 2.5'x4' — a representative default, not the smallest/cheapest
  const [material, setMaterial] = useState<BannerMaterial>("indoor-13oz");
  const [quantity, setQuantity] = useState(1);
  const [grommets, setGrommets] = useState(false);
  const [reinforcedEdges, setReinforcedEdges] = useState(false);
  const [windFlaps, setWindFlaps] = useState(false);
  const [doubleSided, setDoubleSided] = useState(false);
  const [startingStudio, setStartingStudio] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const sizeDef = BANNER_SIZES.find((s) => s.key === sizeKey) ?? BANNER_SIZES[0];
  const canDoubleSided = doubleSidedAvailable(material);
  const canGrommets = grommetsAvailable(material) && !doubleSided;
  const canReinforcedEdges = reinforcedEdgesAvailable(material) && !doubleSided;
  const canWindFlaps = windFlapsEligible(material, sizeDef.heightFt) && !doubleSided;

  const quote = useMemo(
    () =>
      quoteBanner({
        sizeKey,
        material,
        quantity,
        grommets,
        reinforcedEdges,
        windFlaps,
        doubleSided,
      }),
    [sizeKey, material, quantity, grommets, reinforcedEdges, windFlaps, doubleSided],
  );

  const baseUnitAt1 = useMemo(() => unitPriceAt1(sizeKey, material), [sizeKey, material]);

  const sizeOptions: OptionCardGridItem[] = useMemo(
    () =>
      BANNER_SIZES.map((s) => {
        const materialForSize = BANNER_BASE_PRICES[s.key]?.[material] !== undefined
          ? material
          : BANNER_MATERIALS.find((m) => BANNER_BASE_PRICES[s.key]?.[m.value] !== undefined)?.value;
        const price = materialForSize ? unitPriceAt1(s.key, materialForSize) : null;
        return {
          value: s.key,
          label: s.label,
          priceDelta: price != null ? `From $${(price / 100).toFixed(2)}` : undefined,
        };
      }),
    [material],
  );

  const materialOptions: OptionCardGridItem[] = useMemo(
    () =>
      BANNER_MATERIALS.map((m) => {
        const available = BANNER_BASE_PRICES[sizeKey]?.[m.value] !== undefined;
        const price = available ? unitPriceAt1(sizeKey, m.value) : null;
        return {
          value: m.value,
          label: m.label,
          priceDelta: price != null ? `$${(price / 100).toFixed(2)}` : undefined,
          disabled: !available,
          disabledReason: available ? undefined : "Not offered at this size",
        };
      }),
    [sizeKey],
  );

  const printedSidesOptions: OptionCardGridItem[] = useMemo(() => {
    const doubleQuote = canDoubleSided ? quoteBanner({ sizeKey, material, quantity: 1, doubleSided: true }) : null;
    const doublePrice = doubleQuote && !isQuoteError(doubleQuote) ? doubleQuote.totalCents : null;
    return [
      { value: "single", label: "Single-sided" },
      {
        value: "double",
        label: "Double-sided",
        priceDelta: doublePrice != null && baseUnitAt1 != null ? `+$${((doublePrice - baseUnitAt1) / 100).toFixed(2)}` : undefined,
        disabled: !canDoubleSided,
        disabledReason: canDoubleSided ? undefined : "Not available in this material",
      },
    ];
  }, [sizeKey, material, canDoubleSided, baseUnitAt1]);

  const grommetsOptions = useMemo(
    () =>
      addonToggleOptions("Grommets", canGrommets, doubleSided ? "Not available with double-sided" : "Not available in this material", baseUnitAt1, () => {
        const q = quoteBanner({ sizeKey, material, quantity: 1, grommets: true });
        return isQuoteError(q) ? null : q.totalCents;
      }),
    [sizeKey, material, canGrommets, doubleSided, baseUnitAt1],
  );
  const reinforcedEdgesOptions = useMemo(
    () =>
      addonToggleOptions(
        "Reinforced edges",
        canReinforcedEdges,
        doubleSided ? "Not available with double-sided" : "Not available in this material",
        baseUnitAt1,
        () => {
          const q = quoteBanner({ sizeKey, material, quantity: 1, reinforcedEdges: true });
          return isQuoteError(q) ? null : q.totalCents;
        },
      ),
    [sizeKey, material, canReinforcedEdges, doubleSided, baseUnitAt1],
  );
  const windFlapsOptions = useMemo(
    () =>
      addonToggleOptions(
        "Wind flaps",
        canWindFlaps,
        doubleSided ? "Not available with double-sided" : "Only on outdoor materials up to 4' tall",
        baseUnitAt1,
        () => {
          const q = quoteBanner({ sizeKey, material, quantity: 1, windFlaps: true });
          return isQuoteError(q) ? null : q.totalCents;
        },
      ),
    [sizeKey, material, canWindFlaps, doubleSided, baseUnitAt1],
  );

  const pricingGuideRows: PricingGuideRow[] = useMemo(() => {
    const rows: PricingGuideRow[] = [];
    for (const qty of GUIDE_QUANTITIES) {
      const q = quoteBanner({ sizeKey, material, quantity: qty, grommets, reinforcedEdges, windFlaps, doubleSided });
      if (!isQuoteError(q)) rows.push({ qty, totalCents: q.totalCents, perUnitCents: q.unitPriceCents });
    }
    return rows;
  }, [sizeKey, material, grommets, reinforcedEdges, windFlaps, doubleSided]);

  function handleSizeChange(nextKey: string) {
    setSizeKey(nextKey);
    const stillOffered = BANNER_BASE_PRICES[nextKey]?.[material] !== undefined;
    if (!stillOffered) {
      const fallback = BANNER_MATERIALS.find((m) => BANNER_BASE_PRICES[nextKey]?.[m.value] !== undefined);
      if (fallback) setMaterial(fallback.value);
    }
    if (!windFlapsEligible(material, BANNER_SIZES.find((s) => s.key === nextKey)?.heightFt ?? 0)) setWindFlaps(false);
  }

  function handleMaterialChange(value: BannerMaterial) {
    setMaterial(value);
    if (!doubleSidedAvailable(value)) setDoubleSided(false);
    if (!grommetsAvailable(value)) setGrommets(false);
    if (!reinforcedEdgesAvailable(value)) setReinforcedEdges(false);
    if (!windFlapsEligible(value, sizeDef.heightFt)) setWindFlaps(false);
  }

  async function handleDesign() {
    if (isQuoteError(quote) || startingStudio) return;
    setStartingStudio(true);
    setStudioError(null);
    try {
      getOrCreateClientSessionToken();
      const materialLabel = BANNER_MATERIALS.find((m) => m.value === material)?.label ?? material;

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
          // Banners are the one product where the print area varies per order — widthIn/heightIn
          // travel with the side itself rather than coming from a fixed PRINT_AREAS constant.
          sides: [{ type: "banner-face", widthIn: sizeDef.widthFt * 12, heightIn: sizeDef.heightFt * 12 }],
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
          <OptionCardGrid options={sizeOptions} selected={sizeKey} onSelect={handleSizeChange} />
        </div>
      </div>

      <div className="mt-4">
        <BannerScaleVisualizer widthFt={sizeDef.widthFt} heightFt={sizeDef.heightFt} />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Material</p>
        <div className="mt-2">
          <OptionCardGrid options={materialOptions} selected={material} onSelect={(v) => handleMaterialChange(v as BannerMaterial)} />
        </div>
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

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Printed sides</p>
        <div className="mt-2">
          <OptionCardGrid
            options={printedSidesOptions}
            selected={doubleSided ? "double" : "single"}
            onSelect={(v) => setDoubleSided(v === "double")}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Hanging option</p>
        <div className="mt-2">
          <OptionCardGrid options={grommetsOptions} selected={grommets ? "yes" : "no"} onSelect={(v) => setGrommets(v === "yes")} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Reinforced edges</p>
        <div className="mt-2">
          <OptionCardGrid
            options={reinforcedEdgesOptions}
            selected={reinforcedEdges ? "yes" : "no"}
            onSelect={(v) => setReinforcedEdges(v === "yes")}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Wind flaps</p>
        <div className="mt-2">
          <OptionCardGrid options={windFlapsOptions} selected={windFlaps ? "yes" : "no"} onSelect={(v) => setWindFlaps(v === "yes")} />
        </div>
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
            {(quote.quantityDiscountIsEstimate || quote.addonsAreEstimate) && (
              <p className="mt-1 text-xs text-muted">Estimated pricing for this size/quantity combination.</p>
            )}
            <div className="mt-2">
              <PricingGuideFlyout rows={pricingGuideRows} />
            </div>
          </>
        )}
      </div>

      {studioError && <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{studioError}</p>}

      <button
        type="button"
        onClick={handleDesign}
        disabled={isQuoteError(quote) || startingStudio}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {startingStudio ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : "Design This Banner →"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Add your logo, text or artwork in Maple Studio.</p>
    </div>
  );
}
