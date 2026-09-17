"use client";

import { useState } from "react";
import { Check, Image as ImageIcon, LinkSimple, SpinnerGap, Trash, WarningCircle, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { isLikelyUrl, normalizeDestination, QR_PRESETS, type QrCornerStyle, type QrDotStyle, type QrErrorCorrection, type QrFrameStyle, type QrStylePresetId } from "@/lib/studio/qr";
import type { DesignObjectRecord } from "@/lib/studio/types";

export interface QrPatchChanges {
  destination?: string;
  errorCorrection?: QrErrorCorrection;
  foregroundColor?: string;
  backgroundColor?: string;
  dotStyle?: QrDotStyle;
  cornerStyle?: QrCornerStyle;
  frameStyle?: QrFrameStyle;
  labelText?: string | null;
}

const DOT_STYLE_LABELS: { id: QrDotStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "dots", label: "Dots" },
  { id: "rounded", label: "Rounded" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Classy Rounded" },
  { id: "extra-rounded", label: "Extra Rounded" },
];

const CORNER_STYLE_LABELS: { id: QrCornerStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "dot", label: "Dot" },
  { id: "extra-rounded", label: "Rounded" },
];

/** Section "QR LIVE EDITING": every control the brief lists (Destination, QR Style, Foreground,
 *  Background, Corner Style, Dot Style, Logo, Frame, Label — Size/Position/Rotation are the
 *  generic controls already shared by every object type, see Inspector.tsx). Every change here
 *  round-trips through StudioClient's patchQrObject, which regenerates the actual rendered code
 *  AND re-validates it scans — this component only ever shows the current qr* fields, it never
 *  edits `assetUrl` directly. */
export function QRInspector({
  obj,
  regenerating,
  onPatch,
  onApplyPreset,
  onFix,
  onTriggerLogoUpload,
  onRemoveLogo,
}: {
  obj: DesignObjectRecord;
  regenerating: boolean;
  onPatch: (changes: QrPatchChanges) => void;
  onApplyPreset: (presetId: QrStylePresetId) => void;
  onFix: () => void;
  onTriggerLogoUpload: () => void;
  onRemoveLogo: () => void;
}) {
  const [destinationDraft, setDestinationDraft] = useState(obj.qrDestination ?? "");
  const [destinationTouched, setDestinationTouched] = useState(false);

  function commitDestination() {
    const normalized = normalizeDestination(destinationDraft);
    if (isLikelyUrl(normalized) && normalized !== obj.qrDestination) onPatch({ destination: normalized });
  }

  const destinationInvalid = destinationTouched && destinationDraft.trim().length > 0 && !isLikelyUrl(destinationDraft);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-ink-900/70">Destination</label>
        <div className="relative mt-1">
          <LinkSimple className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
          <input
            type="text"
            value={destinationDraft}
            onChange={(e) => setDestinationDraft(e.target.value)}
            onBlur={() => {
              setDestinationTouched(true);
              commitDestination();
            }}
            className={cn(
              "w-full rounded-lg border py-1.5 pl-9 pr-3 text-sm outline-none",
              destinationInvalid ? "border-crimson" : "border-sand focus:border-ink-950/30",
            )}
          />
        </div>
        {destinationInvalid && <p className="mt-1 text-[11px] text-crimson">That doesn&apos;t look like a valid link.</p>}
      </div>

      {/* Section "QR QUALITY STATES" */}
      <div className={cn("rounded-lg px-3 py-2.5 text-xs", regenerating ? "bg-canvas text-ink-900/60" : obj.qrValidated ? "bg-canvas text-ink-900/70" : "bg-crimson/10 text-crimson")}>
        {regenerating ? (
          <span className="flex items-center gap-1.5">
            <SpinnerGap className="size-3.5 animate-spin" weight="bold" /> Checking…
          </span>
        ) : obj.qrValidated ? (
          <span className="flex items-center gap-1.5">
            <Check className="size-3.5" weight="bold" /> QR code scans correctly
          </span>
        ) : (
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              <WarningCircle className="size-3.5" weight="bold" /> QR may be difficult to scan
            </p>
            <button type="button" onClick={onFix} className="mt-1.5 font-semibold underline underline-offset-2">
              Fix QR
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">QR Style</label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {QR_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.id)}
              className={cn(
                "rounded-lg border py-1.5 text-[11px] font-semibold",
                obj.qrStylePreset === p.id ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900 hover:bg-canvas",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-ink-900/70">Foreground</label>
          <input
            type="color"
            value={obj.qrForegroundColor ?? "#171412"}
            onChange={(e) => onPatch({ foregroundColor: e.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-sand"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-900/70">Background</label>
          <input
            type="color"
            value={obj.qrBackgroundColor ?? "#FFFFFF"}
            onChange={(e) => onPatch({ backgroundColor: e.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-sand"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Dot Style</label>
        <select
          value={obj.qrDotStyle ?? "square"}
          onChange={(e) => onPatch({ dotStyle: e.target.value as QrDotStyle })}
          className="mt-1 w-full rounded-lg border border-sand px-2 py-1.5 text-sm"
        >
          {DOT_STYLE_LABELS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Corner Style</label>
        <select
          value={obj.qrCornerStyle ?? "square"}
          onChange={(e) => onPatch({ cornerStyle: e.target.value as QrCornerStyle })}
          className="mt-1 w-full rounded-lg border border-sand px-2 py-1.5 text-sm"
        >
          {CORNER_STYLE_LABELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Logo</label>
        {obj.qrLogoUrl ? (
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-sand px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- small logo preview, not a page asset */}
            <img src={obj.qrLogoUrl} alt="" className="size-7 rounded object-contain" />
            <span className="flex-1 text-xs text-ink-900/70">Logo added — error correction raised automatically</span>
            <button type="button" aria-label="Remove logo" onClick={onRemoveLogo} className="rounded p-1 text-ink-900/50 hover:bg-canvas hover:text-crimson">
              <Trash className="size-3.5" weight="bold" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onTriggerLogoUpload}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas"
          >
            <ImageIcon className="size-3.5" weight="bold" /> Add logo
          </button>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Frame</label>
        <div className="mt-1 flex gap-1.5">
          {(["none", "border"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onPatch({ frameStyle: f })}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-xs font-semibold capitalize",
                (obj.qrFrameStyle ?? "none") === f ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900 hover:bg-canvas",
              )}
            >
              {f === "none" ? "No frame" : "Border"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Label</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={obj.qrLabelText ?? ""}
            onChange={(e) => onPatch({ labelText: e.target.value || null })}
            placeholder="SCAN ME"
            maxLength={24}
            className="w-full rounded-lg border border-sand py-1.5 pl-3 pr-8 text-sm outline-none focus:border-ink-950/30"
          />
          {obj.qrLabelText && (
            <button
              type="button"
              aria-label="Clear label"
              onClick={() => onPatch({ labelText: null })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-900/40 hover:text-ink-900"
            >
              <X className="size-3.5" weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
