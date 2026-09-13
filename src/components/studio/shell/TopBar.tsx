"use client";

import { ArrowLeft, ArrowUUpLeft, ArrowUUpRight, Eye, SpinnerGap } from "@phosphor-icons/react/dist/ssr";

/** Section 3. PREVIEW and REVIEW are deliberately two different buttons/destinations — Preview
 *  answers "what will this look like," Review is the order-approval step. Never combine them.
 *  Fixed ~56-64px tall (py-3 + text/icon sizing below), `shrink-0` set by the caller so it never
 *  gets compressed by the flex column it sits in. */
export function TopBar({
  onBack,
  backPending,
  productName,
  colourName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  priceTotal,
  canPreview,
  onPreview,
  onReview,
}: {
  onBack: () => void;
  backPending: boolean;
  productName: string;
  colourName: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  priceTotal: number | null;
  canPreview: boolean;
  onPreview: () => void;
  onReview: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-sand bg-white px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={backPending}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-950/25 disabled:cursor-wait disabled:opacity-60"
        >
          {backPending ? <SpinnerGap className="size-3.5 animate-spin" weight="bold" /> : <ArrowLeft className="size-3.5" weight="bold" />}
          Product
        </button>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-ink-900">{productName}</p>
          <p className="text-xs text-muted">{colourName}</p>
        </div>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="button"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          className="rounded-full p-2 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUUpLeft className="size-4" weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          className="rounded-full p-2 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUUpRight className="size-4" weight="bold" />
        </button>
        <span className="w-24 text-xs text-muted">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1">
              <SpinnerGap className="size-3 animate-spin" weight="bold" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && "Saved ✓"}
          {saveStatus === "error" && "Couldn't save — retrying"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {priceTotal !== null && (
          <p className="hidden font-display text-sm font-semibold text-ink-900 sm:block">${priceTotal.toFixed(2)}</p>
        )}
        <button
          type="button"
          disabled={!canPreview}
          onClick={onPreview}
          className="flex items-center gap-1.5 rounded-full border border-ink-950/20 px-3.5 py-2 text-sm font-semibold text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Eye className="size-4" weight="bold" />
          <span className="hidden sm:inline">Preview</span>
        </button>
        <button
          type="button"
          disabled={!canPreview}
          onClick={onReview}
          className="rounded-full bg-maple-gradient px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review
        </button>
      </div>
    </header>
  );
}
