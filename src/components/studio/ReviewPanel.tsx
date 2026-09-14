"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { EASE_PREMIUM } from "@/lib/motion";
import { backgroundUrlFor } from "@/lib/studio/printAreas";
import type { DecorationLocation } from "@/lib/studio/productDecorationProfile";
import type { DesignObjectRecord, DesignProjectRecord, DesignSideType } from "@/lib/studio/types";

const CanvasStage = dynamic(() => import("@/components/studio/CanvasStage").then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex aspect-[4/5] w-full max-w-[420px] items-center justify-center rounded-3xl bg-white">
      <SpinnerGap className="size-6 animate-spin text-muted" weight="bold" />
    </div>
  ),
});

interface PriceBreakdown {
  blankSubtotal: number;
  designFee: number;
  printingSubtotal: number;
  total: number;
  quantity: number;
  locations: number;
}

export function ReviewPanel({
  project,
  sides,
  profile,
  priceBreakdown,
  onBack,
  onApprove,
  approveState,
}: {
  project: DesignProjectRecord;
  sides: Partial<Record<DesignSideType, DesignObjectRecord[]>>;
  profile: DecorationLocation[];
  priceBreakdown: PriceBreakdown | null;
  onBack: () => void;
  onApprove: () => void;
  approveState: "idle" | "adding" | "success" | "error";
}) {
  const availableSides = project.sides.map((s) => s.sideType);
  const noop = () => {};
  const hasArt = (side: DesignSideType) => (sides[side]?.length ?? 0) > 0;
  const labelFor = (side: DesignSideType) => profile.find((l) => l.id === side)?.label ?? side;
  const isPlacementPreview = (side: DesignSideType) => profile.find((l) => l.id === side)?.usesPlacementPreview ?? false;
  const mockupFor = (side: DesignSideType) => {
    const loc = profile.find((l) => l.id === side);
    if (!loc) return null;
    return backgroundUrlFor(loc.viewType, project.mockupImages, project.colourName, loc.usesPlacementPreview);
  };

  return (
    // h-full + overflow-y-auto, not min-h-screen: Review lives inside Studio's fixed h-dvh shell
    // (same route, just a different `mode`, not a page navigation — see StudioClient), which is
    // itself overflow-hidden, so this is what actually lets a tall review (many locations, full
    // price breakdown) scroll on its own instead of being silently clipped by that ancestor.
    <div className="h-full overflow-y-auto bg-canvas">
      <header className="border-b border-sand bg-white px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-950/25"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          Back to Studio
        </button>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">Review your design</h1>
        <p className="mt-2 text-sm text-muted">
          Confirm everything looks right — this becomes your production reference once approved.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="min-w-0 space-y-6">
            {availableSides.map((side) => (
              <div key={side}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  {labelFor(side)} preview
                  <span className={hasArt(side) ? "text-crimson" : "text-muted/50"}>{hasArt(side) ? "✓" : "—"}</span>
                </p>
                <CanvasStage
                  location={side}
                  mockupUrl={mockupFor(side)}
                  objects={sides[side] ?? []}
                  selectedId={null}
                  onSelect={noop}
                  onCommitObject={noop}
                  editingTextId={null}
                  onEditRequest={noop}
                  onEditCommit={noop}
                  readOnly
                  placementPreview={isPlacementPreview(side)}
                  fitMode="width"
                />
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-6">
            <div className="rounded-2xl bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Product</p>
              <p className="mt-1 font-display font-semibold text-ink-900">{project.productName}</p>
              <p className="text-sm text-muted">{project.brandName}</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Colour</p>
              <p className="mt-1 text-sm text-ink-900">{project.colourName}</p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Sizes &amp; quantities</p>
              <p className="mt-1 text-sm text-ink-900">
                {project.sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")} · {project.totalQuantity} total
              </p>
            </div>

            {priceBreakdown && (
              <div className="rounded-2xl bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Price breakdown</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-ink-900/80">
                    <span>Shirts × {priceBreakdown.quantity}</span>
                    <span>${priceBreakdown.blankSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ink-900/80">
                    <span>Design/customization</span>
                    <span>${priceBreakdown.designFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ink-900/80">
                    <span>
                      Printing ({priceBreakdown.locations} {priceBreakdown.locations === 1 ? "location" : "locations"})
                    </span>
                    <span>${priceBreakdown.printingSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-sand pt-2 font-display text-base font-semibold text-ink-900">
                    <span>Total</span>
                    <span>${priceBreakdown.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-canvas p-5 text-xs leading-relaxed text-muted">
              <WarningCircle className="mb-1 size-4 text-ink-900/50" weight="bold" />
              By approving, you confirm this design is ready to produce as shown. This serves as your
              digital proof for standard orders — reach out afterward if anything needs to change.
            </div>

            <button
              type="button"
              disabled={approveState === "adding" || approveState === "success"}
              onClick={onApprove}
              className={cn(
                "flex w-full items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3.5 text-sm font-semibold transition-colors",
                approveState === "success" ? "bg-ink-950 text-white" : "bg-maple-gradient text-ink-950 hover:opacity-95",
                approveState === "adding" && "cursor-wait opacity-80",
              )}
            >
              {/* Crossfade the label rather than swap it instantly — Section 1's "150-250ms
                  ordinary button-state transitions," no scale/bounce. */}
              <AnimatePresence mode="wait" initial={false}>
                {approveState === "adding" ? (
                  <motion.span
                    key="adding"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                    className="flex items-center gap-2"
                  >
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                    Adding…
                  </motion.span>
                ) : approveState === "success" ? (
                  <motion.span
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                    className="flex items-center gap-2"
                  >
                    <Check className="size-4" weight="bold" /> Added to Cart
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: EASE_PREMIUM }}
                  >
                    Approve &amp; add to cart
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {approveState === "error" && (
              <div className="rounded-2xl bg-crimson/10 p-4 text-sm text-crimson">
                <p className="font-semibold">We couldn&apos;t add your design to the cart.</p>
                <p className="mt-1 text-xs text-crimson/80">
                  Your design is safe — nothing was lost. Please try again.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={onApprove}
                    className="rounded-full bg-crimson px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded-full border border-crimson/30 px-4 py-2 text-xs font-semibold text-crimson transition-colors hover:bg-crimson/5"
                  >
                    Back to Studio
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
