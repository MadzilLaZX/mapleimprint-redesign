"use client";

import { useEffect, useState } from "react";
import {
  ArrowsHorizontal,
  ArrowsVertical,
  CaretDown,
  Copy,
  Crop as CropIcon,
  Info,
  SpinnerGap,
  Stack,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { LayersPanel } from "@/components/studio/shell/LayersPanel";
import type { DesignObjectRecord, DesignSideType, SizeQty } from "@/lib/studio/types";
import { PRINT_AREAS } from "@/lib/studio/printAreas";

const FONT_CHOICES = ["Manrope, sans-serif", "Bricolage Grotesque, sans-serif", "Georgia, serif", "Courier New, monospace"];
const MIN_PRINT_PPI = 150;

export interface BgRemovalState {
  forObjectId: string | null;
  status: "idle" | "processing" | "ready" | "error";
  resultUrl?: string;
  error?: string;
}

function useNaturalImageSize(url: string | null) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  // Stale size from a previously-selected image is possible for one render after switching
  // objects (before the new onload fires) — acceptable for an advisory quality hint; gating on
  // `url` here at least guarantees nothing renders once there's genuinely no image at all.
  return url ? size : null;
}

function QualityFeedback({ obj, location }: { obj: DesignObjectRecord; location: DesignSideType }) {
  const natural = useNaturalImageSize(obj.assetUrl);
  if (!natural) return null;
  const area = PRINT_AREAS[location];
  const printedWidthIn = obj.normalizedWidth * area.widthIn;
  const ppi = printedWidthIn > 0 ? natural.w / printedWidthIn : 0;
  const looksGood = ppi >= MIN_PRINT_PPI;

  return (
    <div className={cn("mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed", looksGood ? "bg-canvas text-ink-900/70" : "bg-orange/10 text-ink-900")}>
      {looksGood ? (
        "✓ Print quality looks good"
      ) : (
        <div>
          <p className="font-medium">This image may look blurry at this size.</p>
          <p className="mt-1 text-ink-900/60">Try making it smaller, or upload a higher-resolution version.</p>
        </div>
      )}
    </div>
  );
}

export function Inspector({
  selectedObject,
  onPatch,
  onDuplicate,
  onDelete,
  onOpenCrop,
  bgRemoval,
  onRemoveBackground,
  onAcceptRemovedBackground,
  onDismissBackgroundRemoval,
  activeSide,
  layerObjects,
  selectedId,
  onSelectLayer,
  onMoveLayer,
  onToggleHiddenLayer,
  onDuplicateLayer,
  onDeleteLayer,
  productName,
  brandName,
  colourName,
  sizeBreakdown,
  totalQuantity,
  priceBreakdown,
}: {
  selectedObject: DesignObjectRecord | null;
  onPatch: (id: string, patch: Partial<DesignObjectRecord>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenCrop: () => void;
  bgRemoval: BgRemovalState;
  onRemoveBackground: () => void;
  onAcceptRemovedBackground: () => void;
  onDismissBackgroundRemoval: () => void;
  activeSide: DesignSideType;
  layerObjects: DesignObjectRecord[];
  selectedId: string | null;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: "up" | "down") => void;
  onToggleHiddenLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  productName: string;
  brandName: string;
  colourName: string;
  sizeBreakdown: SizeQty[];
  totalQuantity: number;
  priceBreakdown: { blankSubtotal: number; designFee: number; printingSubtotal: number; total: number; quantity: number; locations: number } | null;
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [productInfoOpen, setProductInfoOpen] = useState(false);

  return (
    <div className="space-y-4">
      {selectedObject ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {selectedObject.type === "text" ? "Text" : selectedObject.type === "shape" ? "Shape" : "Image"}
          </p>

          {selectedObject.type === "text" && <TextInspector obj={selectedObject} onPatch={(patch) => onPatch(selectedObject.id, patch)} />}
          {selectedObject.type === "shape" && <ShapeInspector obj={selectedObject} onPatch={(patch) => onPatch(selectedObject.id, patch)} />}
          {selectedObject.type === "image" && (
            <ImageInspector
              obj={selectedObject}
              activeSide={activeSide}
              onPatch={(patch) => onPatch(selectedObject.id, patch)}
              onOpenCrop={onOpenCrop}
              bgRemoval={bgRemoval}
              onRemoveBackground={onRemoveBackground}
              onAcceptRemovedBackground={onAcceptRemovedBackground}
              onDismissBackgroundRemoval={onDismissBackgroundRemoval}
            />
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onDuplicate} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas">
              <Copy className="size-3.5" weight="bold" />
              Duplicate
            </button>
            <button type="button" onClick={onDelete} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand py-2 text-xs font-semibold text-crimson hover:bg-crimson/5">
              <Trash className="size-3.5" weight="bold" />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your product</p>
          <p className="mt-1.5 font-display text-sm font-semibold text-ink-900">{productName}</p>
          <p className="text-xs text-muted">{brandName}</p>
          <p className="mt-2 text-xs text-ink-900/70">{colourName}</p>
          <p className="text-xs text-ink-900/70">
            {sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")} · {totalQuantity} total
          </p>

          <button
            type="button"
            onClick={() => setProductInfoOpen((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-lg bg-canvas px-3 py-2 text-xs font-semibold text-ink-900"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" weight="bold" /> Print area info
            </span>
            <CaretDown className={cn("size-3 transition-transform", productInfoOpen && "rotate-180")} weight="bold" />
          </button>
          {productInfoOpen && <ProductInfo location={activeSide} />}
        </div>
      )}

      <div className="border-t border-sand pt-3">
        <button
          type="button"
          onClick={() => setLayersOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted"
        >
          <span className="flex items-center gap-1.5">
            <Stack className="size-3.5" weight="bold" /> Layers
          </span>
          <CaretDown className={cn("size-3 transition-transform", layersOpen && "rotate-180")} weight="bold" />
        </button>
        {layersOpen && (
          <div className="mt-2">
            <LayersPanel
              objects={layerObjects}
              selectedId={selectedId}
              onSelect={onSelectLayer}
              onMove={onMoveLayer}
              onToggleHidden={onToggleHiddenLayer}
              onDuplicate={onDuplicateLayer}
              onDelete={onDeleteLayer}
            />
          </div>
        )}
      </div>

      {priceBreakdown && (
        <div className="space-y-1.5 border-t border-sand pt-4 text-xs">
          <div className="flex justify-between text-ink-900/70">
            <span>Shirts × {priceBreakdown.quantity}</span>
            <span>${priceBreakdown.blankSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ink-900/70">
            <span>Design/customization</span>
            <span>${priceBreakdown.designFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ink-900/70">
            <span>
              Printing ({priceBreakdown.locations} {priceBreakdown.locations === 1 ? "location" : "locations"})
            </span>
            <span>${priceBreakdown.printingSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-sand pt-1.5 font-semibold text-ink-900">
            <span>Total</span>
            <span>${priceBreakdown.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductInfo({ location }: { location: DesignSideType }) {
  const area = PRINT_AREAS[location];
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-canvas px-3 py-2.5 text-xs text-ink-900/70">
      <p>
        <span className="font-semibold text-ink-900">Print area</span> — {area.widthIn} × {area.heightIn} in
      </p>
      <p>Ideal for large graphics, logos and photos.</p>
      {!area.confirmed && (
        <p className="text-orange">Approximate — the Maple team confirms exact sizing for this placement before production.</p>
      )}
    </div>
  );
}

function TextInspector({ obj, onPatch }: { obj: DesignObjectRecord; onPatch: (patch: Partial<DesignObjectRecord>) => void }) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Font</label>
        <select
          value={obj.fontFamily ?? FONT_CHOICES[0]}
          onChange={(e) => onPatch({ fontFamily: e.target.value })}
          className="mt-1 w-full rounded-lg border border-sand px-2 py-1.5 text-sm"
        >
          {FONT_CHOICES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f.split(",")[0]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Size</label>
        <input type="range" min={12} max={80} value={obj.fontSize ?? 32} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} className="mt-1 w-full" />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Colour</label>
        <input type="color" value={obj.fill ?? "#171412"} onChange={(e) => onPatch({ fill: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-sand" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPatch({ bold: !obj.bold })}
          className={cn("flex-1 rounded-lg border py-1.5 text-sm font-bold", obj.bold ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900")}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => onPatch({ italic: !obj.italic })}
          className={cn("flex-1 rounded-lg border py-1.5 text-sm italic", obj.italic ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900")}
        >
          I
        </button>
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onPatch({ align: a })}
            className={cn("flex-1 rounded-lg border py-1.5 text-[10px] font-semibold uppercase", obj.align === a ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900")}
          >
            {a.slice(0, 1)}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Letter spacing</label>
        <input type="range" min={-2} max={20} value={obj.letterSpacing ?? 0} onChange={(e) => onPatch({ letterSpacing: Number(e.target.value) })} className="mt-1 w-full" />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Line spacing</label>
        <input type="range" min={0.8} max={2} step={0.05} value={obj.lineHeight ?? 1.15} onChange={(e) => onPatch({ lineHeight: Number(e.target.value) })} className="mt-1 w-full" />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Curve</label>
        <input type="range" min={-100} max={100} value={obj.curve ?? 0} onChange={(e) => onPatch({ curve: Number(e.target.value) || null })} className="mt-1 w-full" />
      </div>
    </>
  );
}

function ShapeInspector({ obj, onPatch }: { obj: DesignObjectRecord; onPatch: (patch: Partial<DesignObjectRecord>) => void }) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Colour</label>
        <input type="color" value={obj.fill ?? "#171412"} onChange={(e) => onPatch({ fill: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-sand" />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-900/70">Opacity</label>
        <input type="range" min={0.2} max={1} step={0.05} value={obj.opacity} onChange={(e) => onPatch({ opacity: Number(e.target.value) })} className="mt-1 w-full" />
      </div>
    </>
  );
}

function ImageInspector({
  obj,
  activeSide,
  onPatch,
  onOpenCrop,
  bgRemoval,
  onRemoveBackground,
  onAcceptRemovedBackground,
  onDismissBackgroundRemoval,
}: {
  obj: DesignObjectRecord;
  activeSide: DesignSideType;
  onPatch: (patch: Partial<DesignObjectRecord>) => void;
  onOpenCrop: () => void;
  bgRemoval: BgRemovalState;
  onRemoveBackground: () => void;
  onAcceptRemovedBackground: () => void;
  onDismissBackgroundRemoval: () => void;
}) {
  const isProcessing = bgRemoval.forObjectId === obj.id && bgRemoval.status === "processing";
  const isReady = bgRemoval.forObjectId === obj.id && bgRemoval.status === "ready";
  const isError = bgRemoval.forObjectId === obj.id && bgRemoval.status === "error";

  return (
    <div>
      <QualityFeedback obj={obj} location={activeSide} />

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onOpenCrop} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas">
          <CropIcon className="size-3.5" weight="bold" /> Crop
        </button>
        <button
          type="button"
          onClick={() => onPatch({ flipX: !obj.flipX })}
          aria-pressed={obj.flipX}
          className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold", obj.flipX ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900 hover:bg-canvas")}
        >
          <ArrowsHorizontal className="size-3.5" weight="bold" /> Flip
        </button>
        <button
          type="button"
          onClick={() => onPatch({ flipY: !obj.flipY })}
          aria-pressed={obj.flipY}
          className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold", obj.flipY ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900 hover:bg-canvas")}
        >
          <ArrowsVertical className="size-3.5" weight="bold" /> Flip
        </button>
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-900/70">Opacity</label>
        <input type="range" min={0.2} max={1} step={0.05} value={obj.opacity} onChange={(e) => onPatch({ opacity: Number(e.target.value) })} className="mt-1 w-full" />
      </div>

      <div className="mt-4 border-t border-sand pt-4" aria-live="polite">
        {isReady ? (
          <div>
            <p className="text-xs font-medium text-ink-900/70">Background removed — preview</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="overflow-hidden rounded-lg border border-sand bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={obj.assetUrl ?? ""} alt="Original" className="aspect-square w-full object-contain" />
              </div>
              <div className="overflow-hidden rounded-lg border border-sand bg-[repeating-conic-gradient(#e9e4dc_0_25%,white_0_50%)] bg-[length:12px_12px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bgRemoval.resultUrl} alt="Background removed" className="aspect-square w-full object-contain" />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={onAcceptRemovedBackground} className="flex-1 rounded-full bg-ink-950 py-2 text-xs font-semibold text-white">
                Use removed version
              </button>
              <button type="button" onClick={onDismissBackgroundRemoval} className="flex-1 rounded-full border border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas">
                Keep original
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRemoveBackground}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-sand py-2 text-xs font-semibold text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <SpinnerGap className="size-3.5 animate-spin" weight="bold" /> Processing…
              </>
            ) : (
              "Remove Background"
            )}
          </button>
        )}
        {isError && (
          <div className="mt-2 rounded-lg bg-crimson/10 px-3 py-2 text-xs text-crimson">
            <p>{bgRemoval.error}</p>
            <button type="button" onClick={onRemoveBackground} className="mt-1 font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
