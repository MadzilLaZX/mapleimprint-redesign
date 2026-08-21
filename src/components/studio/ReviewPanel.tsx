"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
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
  priceBreakdown,
  onBack,
  onApprove,
  addedToCart,
}: {
  project: DesignProjectRecord;
  sides: Partial<Record<DesignSideType, DesignObjectRecord[]>>;
  priceBreakdown: PriceBreakdown | null;
  onBack: () => void;
  onApprove: () => void;
  addedToCart: boolean;
}) {
  const availableSides = project.sides.map((s) => s.sideType);
  const noop = () => {};

  return (
    <div className="min-h-screen bg-canvas">
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
          <div className="space-y-6">
            {availableSides.map((side) => (
              <div key={side}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{side} preview</p>
                <CanvasStage
                  mockupUrl={project.mockupImages[side] ?? null}
                  objects={sides[side] ?? []}
                  selectedId={null}
                  onSelect={noop}
                  onCommitObject={noop}
                  editingTextId={null}
                  onEditRequest={noop}
                  onEditCommit={noop}
                  readOnly
                />
              </div>
            ))}
          </div>

          <div className="space-y-6">
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
              disabled={addedToCart}
              onClick={onApprove}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-opacity",
                addedToCart ? "bg-ink-950 text-white" : "bg-maple-gradient text-ink-950 hover:opacity-95",
              )}
            >
              {addedToCart ? (
                <>
                  <Check className="size-4" weight="bold" /> Added to cart
                </>
              ) : (
                "Approve & add to cart"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
