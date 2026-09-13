"use client";

import { useRef, useState } from "react";
import { Check, X } from "@phosphor-icons/react/dist/ssr";

export interface CropFraction {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FULL_CROP: CropFraction = { x: 0, y: 0, width: 1, height: 1 };
const PREVIEW_SIZE = 360;
type Handle = "move" | "nw" | "ne" | "sw" | "se";

/** Section 15. Deliberately simple — one axis-aligned rectangle, drag to move, drag a corner to
 *  resize, Confirm or Reset. Not a photo editor: no rotation, no freeform points, no filters. The
 *  crop is stored as fractions of the source image (see DesignObjectRecord.cropX/Y/Width/Height)
 *  rather than baked into a new file, so the original upload is never touched and "Reset crop" is
 *  always available. */
export function CropModal({
  imageUrl,
  initialCrop,
  onConfirm,
  onCancel,
}: {
  imageUrl: string;
  initialCrop: CropFraction | null;
  onConfirm: (crop: CropFraction | null) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<CropFraction>(initialCrop ?? FULL_CROP);
  const dragState = useRef<{ handle: Handle; startX: number; startY: number; startCrop: CropFraction } | null>(null);

  function beginDrag(handle: Handle, e: React.PointerEvent) {
    e.preventDefault();
    dragState.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: crop };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragState.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / PREVIEW_SIZE;
    const dy = (e.clientY - drag.startY) / PREVIEW_SIZE;
    let { x, y, width, height } = drag.startCrop;

    if (drag.handle === "move") {
      x = drag.startCrop.x + dx;
      y = drag.startCrop.y + dy;
    } else {
      if (drag.handle.includes("w")) {
        x = drag.startCrop.x + dx;
        width = drag.startCrop.width - dx;
      }
      if (drag.handle.includes("e")) {
        width = drag.startCrop.width + dx;
      }
      if (drag.handle.includes("n")) {
        y = drag.startCrop.y + dy;
        height = drag.startCrop.height - dy;
      }
      if (drag.handle.includes("s")) {
        height = drag.startCrop.height + dy;
      }
    }

    width = Math.max(0.1, Math.min(1, width));
    height = Math.max(0.1, Math.min(1, height));
    x = Math.max(0, Math.min(1 - width, x));
    y = Math.max(0, Math.min(1 - height, y));
    setCrop({ x, y, width, height });
  }

  function endDrag() {
    dragState.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }

  const isFull = crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/50 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5">
        <p className="font-display text-sm font-semibold text-ink-900">Crop image</p>
        <div
          className="relative mx-auto mt-4 select-none overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e9e4dc_0_25%,white_0_50%)] bg-[length:12px_12px]"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- interactive crop preview, not a rendered page asset */}
          <img src={imageUrl} alt="" className="pointer-events-none absolute inset-0 size-full object-contain" />
          <div className="absolute inset-0 bg-ink-950/40" style={{ clipPath: buildClipPath(crop) }} />
          <div
            onPointerDown={(e) => beginDrag("move", e)}
            className="absolute cursor-move border-2 border-crimson"
            style={{
              left: crop.x * PREVIEW_SIZE,
              top: crop.y * PREVIEW_SIZE,
              width: crop.width * PREVIEW_SIZE,
              height: crop.height * PREVIEW_SIZE,
            }}
          >
            {(["nw", "ne", "sw", "se"] as const).map((h) => (
              <div
                key={h}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  beginDrag(h, e);
                }}
                className="absolute size-4 rounded-full border-2 border-crimson bg-white"
                style={{
                  cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                  left: h.includes("w") ? -8 : undefined,
                  right: h.includes("e") ? -8 : undefined,
                  top: h.includes("n") ? -8 : undefined,
                  bottom: h.includes("s") ? -8 : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCrop(FULL_CROP)}
            disabled={isFull}
            className="flex-1 rounded-full border border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset crop
          </button>
          <button type="button" onClick={onCancel} className="flex items-center justify-center gap-1 rounded-full border border-sand px-4 py-2 text-xs font-semibold text-ink-900 hover:bg-canvas">
            <X className="size-3.5" weight="bold" /> Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isFull ? null : crop)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-ink-950 py-2 text-xs font-semibold text-white"
          >
            <Check className="size-3.5" weight="bold" /> Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function buildClipPath(crop: CropFraction): string {
  const x1 = crop.x * 100;
  const y1 = crop.y * 100;
  const x2 = (crop.x + crop.width) * 100;
  const y2 = (crop.y + crop.height) * 100;
  return `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${y1}%, ${x1}% ${y1}%, ${x1}% ${y2}%, ${x2}% ${y2}%, ${x2}% ${y1}%, 0 ${y1}%)`;
}
