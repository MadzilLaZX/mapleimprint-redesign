"use client";

import { ArrowsOut, Minus, Plus } from "@phosphor-icons/react/dist/ssr";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const STEP = 0.25;

/** Section 5. Only the useful controls — zoom in/out, current %, Fit — no rulers or advanced
 *  controls by default. Sits as a small floating pill under the canvas so it never competes with
 *  the print-area/placement-preview badges already on the Stage itself. */
export function ZoomControls({ zoom, onZoomChange }: { zoom: number; onZoomChange: (zoom: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-sand bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur">
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => onZoomChange(Math.max(MIN_ZOOM, Math.round((zoom - STEP) * 100) / 100))}
        className="rounded-full p-1.5 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        onClick={() => onZoomChange(1)}
        className="min-w-[3.2rem] rounded-full px-1 text-center text-xs font-semibold text-ink-900/80 hover:text-ink-900"
        title="Reset to fit"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onZoomChange(Math.min(MAX_ZOOM, Math.round((zoom + STEP) * 100) / 100))}
        className="rounded-full p-1.5 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="size-3.5" weight="bold" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-sand" />
      <button
        type="button"
        aria-label="Fit product to view"
        onClick={() => onZoomChange(1)}
        className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-canvas"
      >
        <ArrowsOut className="size-3.5" weight="bold" />
        Fit
      </button>
    </div>
  );
}
