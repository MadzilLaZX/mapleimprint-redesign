"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import type { DecorationLocation } from "@/lib/studio/productDecorationProfile";
import type { DesignObjectRecord, DesignSideType } from "@/lib/studio/types";

const CanvasStage = dynamic(() => import("@/components/studio/CanvasStage").then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex aspect-[4/5] w-full max-w-[420px] items-center justify-center rounded-3xl bg-white">
      <SpinnerGap className="size-6 animate-spin text-muted" weight="bold" />
    </div>
  ),
});

/** Section 4. Answers "what will this actually look like" — not an order-approval step (that's
 *  ReviewPanel). Hides every editing affordance (print-area outline, transform handles, guides —
 *  CanvasStage's `readOnly` already strips all of those) and lets the customer flip between every
 *  decorated location. */
export function PreviewMode({
  openSides,
  activeSide,
  onSelectSide,
  mockupUrl,
  objects,
  profile,
  onBack,
}: {
  openSides: DesignSideType[];
  activeSide: DesignSideType;
  onSelectSide: (side: DesignSideType) => void;
  mockupUrl: string | null;
  objects: DesignObjectRecord[];
  profile: DecorationLocation[];
  onBack: () => void;
}) {
  const labelFor = (id: DesignSideType) => profile.find((l) => l.id === id)?.label ?? id;
  const isPlacementPreview = profile.find((l) => l.id === activeSide)?.usesPlacementPreview ?? false;

  return (
    // Same reasoning as ReviewPanel: h-full + overflow-hidden on the shell, overflow-y-auto on
    // the one scrollable region below, since this renders inside Studio's fixed h-dvh box rather
    // than a normal scrollable page.
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <header className="flex shrink-0 items-center justify-between border-b border-sand bg-white px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-950/25"
        >
          <ArrowLeft className="size-3.5" weight="bold" />
          Return to editing
        </button>
        <p className="font-display text-sm font-semibold text-ink-900">Preview</p>
        <div className="w-24" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
        {/* flex-1/min-h-0 here (not on the column above) is what actually gives CanvasStage a
            real height to fit — the column's cross axis is horizontal (it's flex-col), so
            centering it there doesn't stretch children vertically the way row-centering would. */}
        <div className="min-h-0 w-full flex-1">
          <CanvasStage
            location={activeSide}
            mockupUrl={mockupUrl}
            objects={objects}
            selectedId={null}
            onSelect={() => {}}
            onCommitObject={() => {}}
            editingTextId={null}
            onEditRequest={() => {}}
            onEditCommit={() => {}}
            readOnly
            placementPreview={isPlacementPreview}
          />
        </div>

        {openSides.length > 1 && (
          <div className="flex shrink-0 flex-wrap justify-center gap-2 rounded-full border border-sand bg-white p-1">
            {openSides.map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => onSelectSide(side)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  activeSide === side ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas"
                }`}
              >
                {labelFor(side)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
