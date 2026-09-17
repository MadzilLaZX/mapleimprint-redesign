"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TextAa,
  TextUnderline,
  TextStrikethrough,
  TextItalic,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  Sliders,
  Drop,
  Sparkle,
  ArrowsOutCardinal,
  Copy,
  Trash,
  PaintBrush,
  CaretDown,
  ArrowLineUp,
  ArrowLineDown,
  ArrowUp,
  ArrowDown,
  ArrowsClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { DesignObjectRecord, TextAlign } from "@/lib/studio/types";
import { FontPicker } from "./FontPicker";

type Patch = Partial<DesignObjectRecord>;

export interface TextToolbarProps {
  obj: DesignObjectRecord;
  onPatch: (patch: Patch) => void;
  onLivePatch: (patch: Patch) => void;
  onLivePatchEnd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLayer: (direction: "up" | "down") => void;
  onMoveLayerToEdge: (edge: "front" | "back") => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  hasCopiedStyle: boolean;
}

const ICON_BTN = "flex size-8 items-center justify-center rounded-lg text-ink-900/80 transition-colors hover:bg-canvas";
const ICON_BTN_ACTIVE = "bg-orange/15 text-crimson hover:bg-orange/20";

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} className={cn(ICON_BTN, active && ICON_BTN_ACTIVE)}>
      {children}
    </button>
  );
}

/** Every popover in this toolbar shares this shape: a trigger button plus a floating panel closed
 *  by a full-viewport transparent backdrop (click-outside) — simpler and more robust than a
 *  per-popover ref/event-listener pair for what's ultimately ~8 short-lived panels.
 *
 *  The panel is portaled to document.body rather than rendered inline: the toolbar row itself is
 *  `overflow-x-auto` (so it scrolls instead of badly overflowing on narrow widths — Section
 *  "Responsive toolbar"), and CSS has no way to let one axis of a scroll container clip while the
 *  other stays visible, so an inline `position: absolute` panel would get silently clipped by that
 *  same scrollbar. Portaling escapes the clipping box entirely; position is computed from the
 *  trigger's own on-screen rect at open time. */
function Popover({
  label,
  icon,
  open,
  onOpenChange,
  children,
  panelClassName,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  panelClassName?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    onOpenChange(!open);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={handleToggle}
        className={cn("flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-900/80 transition-colors hover:bg-canvas", open && ICON_BTN_ACTIVE)}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <CaretDown className="size-2.5" weight="bold" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => onOpenChange(false)} />
            <div
              style={{ position: "fixed", top: pos.top, left: Math.min(pos.left, window.innerWidth - 288) }}
              className={cn("z-40 rounded-xl border border-sand bg-white p-3 shadow-xl", panelClassName ?? "w-64")}
            >
              {children}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

const CASE_OPTIONS: { value: NonNullable<DesignObjectRecord["textTransform"]>; label: string }[] = [
  { value: "none", label: "Original Case" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "title", label: "Title Case" },
];

const EFFECT_OPTIONS: { value: NonNullable<DesignObjectRecord["effectType"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "shadow", label: "Shadow" },
  { value: "lift", label: "Lift" },
  { value: "glow", label: "Glow" },
  { value: "background", label: "Background" },
  { value: "hollow", label: "Hollow" },
];

/** Compact contextual toolbar shown above the canvas whenever a TEXT element is selected — fast
 *  access to the formatting a customer reaches for most; the right-hand Inspector panel keeps
 *  every control (including these) in full detail, this is a shortcut layer on top of it, not a
 *  replacement. Every mutation goes through the same onPatch/onLivePatch StudioClient already uses
 *  for the sidebar, so undo/redo, autosave and Preview/Review all pick it up for free. */
export function TextToolbar({
  obj,
  onPatch,
  onLivePatch,
  onLivePatchEnd,
  onDuplicate,
  onDelete,
  onMoveLayer,
  onMoveLayerToEdge,
  onCopyStyle,
  onPasteStyle,
  hasCopiedStyle,
}: TextToolbarProps) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const setOpen = (name: string) => (v: boolean) => setOpenPopover(v ? name : null);

  const fontSize = obj.fontSize ?? 32;
  const align: TextAlign = obj.align ?? "left";
  const opacityPct = Math.round((obj.opacity ?? 1) * 100);
  const effectType = obj.effectType ?? "none";

  function bumpSize(delta: number) {
    const step = fontSize < 20 ? 1 : fontSize < 50 ? 2 : 5;
    const next = Math.max(6, Math.min(500, fontSize + (delta > 0 ? step : -step)));
    onPatch({ fontSize: next });
  }

  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-sand bg-white px-2 py-1.5 shadow-sm">
      {/* Font family */}
      <FontPicker value={obj.fontFamily} onChange={(family) => onPatch({ fontFamily: family })} className="w-36 shrink-0" />

      {/* Size */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-sand px-0.5">
        <button type="button" aria-label="Decrease font size" onClick={() => bumpSize(-1)} className="flex size-7 items-center justify-center text-sm font-bold text-ink-900/70 hover:text-ink-900">
          −
        </button>
        <input
          type="number"
          aria-label="Font size"
          value={fontSize}
          min={6}
          max={500}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onPatch({ fontSize: Math.max(6, Math.min(500, v)) });
          }}
          className="w-9 border-none bg-transparent text-center text-xs font-semibold text-ink-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label="Increase font size" onClick={() => bumpSize(1)} className="flex size-7 items-center justify-center text-sm font-bold text-ink-900/70 hover:text-ink-900">
          +
        </button>
      </div>

      {/* Colour */}
      <label title="Text colour" className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-canvas">
        <span className="font-display text-sm font-bold leading-none text-ink-900">
          A
          <span className="mt-0.5 block h-1 w-full rounded-full" style={{ backgroundColor: obj.fill ?? "#171412" }} />
        </span>
        <input
          type="color"
          aria-label="Text colour"
          value={obj.fill ?? "#171412"}
          onChange={(e) => onPatch({ fill: e.target.value })}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-sand" />

      {/* Bold / Italic / Underline / Strikethrough */}
      <ToolButton label="Bold" active={obj.bold} onClick={() => onPatch({ bold: !obj.bold })}>
        <span className="text-sm font-bold">B</span>
      </ToolButton>
      <ToolButton label="Italic" active={obj.italic} onClick={() => onPatch({ italic: !obj.italic })}>
        <TextItalic className="size-4" weight="bold" />
      </ToolButton>
      <ToolButton label="Underline" active={obj.underline} onClick={() => onPatch({ underline: !obj.underline })}>
        <TextUnderline className="size-4" weight="bold" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={obj.strikethrough} onClick={() => onPatch({ strikethrough: !obj.strikethrough })}>
        <TextStrikethrough className="size-4" weight="bold" />
      </ToolButton>

      {/* Text case */}
      <Popover label="Case" icon={<TextAa className="size-4" weight="bold" />} open={openPopover === "case"} onOpenChange={setOpen("case")} panelClassName="w-44">
        <div className="space-y-0.5">
          {CASE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onPatch({ textTransform: opt.value });
                setOpenPopover(null);
              }}
              className={cn(
                "block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",
                (obj.textTransform ?? "none") === opt.value ? "bg-orange/15 text-crimson" : "text-ink-900 hover:bg-canvas",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Popover>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-sand" />

      {/* Alignment */}
      <Popover
        label="Align"
        icon={align === "center" ? <AlignCenterHorizontal className="size-4" weight="bold" /> : align === "right" ? <AlignRight className="size-4" weight="bold" /> : <AlignLeft className="size-4" weight="bold" />}
        open={openPopover === "align"}
        onOpenChange={setOpen("align")}
        panelClassName="w-auto"
      >
        <div className="flex gap-1">
          {([
            { value: "left" as const, icon: AlignLeft, label: "Align left" },
            { value: "center" as const, icon: AlignCenterHorizontal, label: "Align center" },
            { value: "right" as const, icon: AlignRight, label: "Align right" },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => {
                onPatch({ align: value });
                setOpenPopover(null);
              }}
              className={cn(ICON_BTN, align === value && ICON_BTN_ACTIVE)}
            >
              <Icon className="size-4" weight="bold" />
            </button>
          ))}
        </div>
      </Popover>

      {/* Spacing (letter + line) */}
      <Popover label="Spacing" icon={<Sliders className="size-4" weight="bold" />} open={openPopover === "spacing"} onOpenChange={setOpen("spacing")}>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-900/70">Letter spacing</label>
              <span className="text-xs font-semibold text-ink-900">{obj.letterSpacing ?? 0}</span>
            </div>
            <input
              type="range"
              min={-10}
              max={100}
              value={obj.letterSpacing ?? 0}
              onChange={(e) => onLivePatch({ letterSpacing: Number(e.target.value) })}
              onMouseUp={onLivePatchEnd}
              onTouchEnd={onLivePatchEnd}
              onKeyUp={onLivePatchEnd}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-900/70">Line spacing</label>
              <span className="text-xs font-semibold text-ink-900">{(obj.lineHeight ?? 1.15).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.05}
              value={obj.lineHeight ?? 1.15}
              onChange={(e) => onLivePatch({ lineHeight: Number(e.target.value) })}
              onMouseUp={onLivePatchEnd}
              onTouchEnd={onLivePatchEnd}
              onKeyUp={onLivePatchEnd}
              className="mt-1 w-full"
            />
            <p className="mt-0.5 text-[10px] text-muted">Only visible on multi-line text.</p>
          </div>
        </div>
      </Popover>

      {/* Opacity */}
      <Popover label="Transparency" icon={<Drop className="size-4" weight="bold" />} open={openPopover === "opacity"} onOpenChange={setOpen("opacity")} panelClassName="w-56">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink-900/70">Transparency</label>
          <span className="text-xs font-semibold text-ink-900">{opacityPct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={opacityPct}
          onChange={(e) => onLivePatch({ opacity: Number(e.target.value) / 100 })}
          onMouseUp={onLivePatchEnd}
          onTouchEnd={onLivePatchEnd}
          onKeyUp={onLivePatchEnd}
          className="mt-1 w-full"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>0% (invisible)</span>
          <span>100%</span>
        </div>
      </Popover>

      {/* Effects */}
      <Popover label="Effects" icon={<Sparkle className="size-4" weight="bold" />} open={openPopover === "effects"} onOpenChange={setOpen("effects")} panelClassName="w-72">
        <div className="grid grid-cols-3 gap-1.5">
          {EFFECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onPatch(
                  opt.value === "none"
                    ? { effectType: "none" }
                    : opt.value === "shadow"
                      ? { effectType: "shadow", shadowColor: obj.shadowColor ?? "#000000", shadowOpacity: obj.shadowOpacity ?? 0.5, shadowBlur: obj.shadowBlur ?? 6, shadowOffsetX: obj.shadowOffsetX ?? 3, shadowOffsetY: obj.shadowOffsetY ?? 3 }
                      : opt.value === "lift"
                        ? { effectType: "lift", shadowColor: obj.shadowColor ?? "#000000", shadowOpacity: obj.shadowOpacity ?? 0.25, shadowBlur: obj.shadowBlur ?? 8, shadowOffsetX: 0, shadowOffsetY: obj.shadowOffsetY ?? 4 }
                        : opt.value === "glow"
                          ? { effectType: "glow", shadowColor: obj.shadowColor ?? "#FFB000", shadowOpacity: obj.shadowOpacity ?? 0.8, shadowBlur: obj.shadowBlur ?? 16, shadowOffsetX: 0, shadowOffsetY: 0 }
                          : opt.value === "background"
                            ? { effectType: "background", bgColor: obj.bgColor ?? "#171412", bgPadding: obj.bgPadding ?? 10, bgCornerRadius: obj.bgCornerRadius ?? 8 }
                            : { effectType: "hollow", strokeColor: obj.strokeColor ?? "#171412", strokeWidth: obj.strokeWidth ?? 2 },
                )
              }
              className={cn(
                "rounded-lg border px-2 py-2 text-[11px] font-semibold",
                effectType === opt.value ? "border-crimson bg-orange/15 text-crimson" : "border-sand text-ink-900 hover:bg-canvas",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Outline is independent of the preset above — can combine with Shadow/Glow/etc. */}
        <div className="mt-3 border-t border-sand pt-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ink-900/70">Outline</label>
            <button
              type="button"
              onClick={() => onPatch(obj.strokeWidth ? { strokeWidth: 0 } : { strokeColor: obj.strokeColor ?? "#171412", strokeWidth: 2 })}
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", obj.strokeWidth ? "bg-orange/15 text-crimson" : "bg-canvas text-ink-900/70")}
            >
              {obj.strokeWidth ? "On" : "Off"}
            </button>
          </div>
          {!!obj.strokeWidth && (
            <div className="mt-1.5 flex items-center gap-2">
              <input type="color" aria-label="Outline colour" value={obj.strokeColor ?? "#171412"} onChange={(e) => onPatch({ strokeColor: e.target.value })} className="h-7 w-9 rounded border border-sand" />
              <input
                type="range"
                min={1}
                max={12}
                value={obj.strokeWidth ?? 2}
                onChange={(e) => onLivePatch({ strokeWidth: Number(e.target.value) })}
                onMouseUp={onLivePatchEnd}
                onTouchEnd={onLivePatchEnd}
                className="flex-1"
              />
              <span className="w-5 text-right text-[10px] text-muted">{obj.strokeWidth ?? 2}</span>
            </div>
          )}
        </div>

        {effectType === "background" && (
          <div className="mt-3 border-t border-sand pt-3">
            <label className="text-xs font-medium text-ink-900/70">Background colour</label>
            <input type="color" aria-label="Background colour" value={obj.bgColor ?? "#171412"} onChange={(e) => onPatch({ bgColor: e.target.value })} className="mt-1 h-8 w-full rounded-lg border border-sand" />
          </div>
        )}
      </Popover>

      {/* Position + layer order */}
      <Popover label="Position" icon={<ArrowsOutCardinal className="size-4" weight="bold" />} open={openPopover === "position"} onOpenChange={setOpen("position")} panelClassName="w-64">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Align to print area</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <ToolButton label="Align left" onClick={() => onPatch({ normalizedX: 0 })}>
            <AlignLeft className="size-4" weight="bold" />
          </ToolButton>
          <ToolButton label="Align horizontal center" onClick={() => onPatch({ normalizedX: (1 - obj.normalizedWidth) / 2 })}>
            <AlignCenterHorizontal className="size-4" weight="bold" />
          </ToolButton>
          <ToolButton label="Align right" onClick={() => onPatch({ normalizedX: 1 - obj.normalizedWidth })}>
            <AlignRight className="size-4" weight="bold" />
          </ToolButton>
          <ToolButton label="Align top" onClick={() => onPatch({ normalizedY: 0 })}>
            <AlignTop className="size-4" weight="bold" />
          </ToolButton>
          <ToolButton label="Align vertical center" onClick={() => onPatch({ normalizedY: (1 - obj.normalizedHeight) / 2 })}>
            <AlignCenterVertical className="size-4" weight="bold" />
          </ToolButton>
          <ToolButton label="Align bottom" onClick={() => onPatch({ normalizedY: 1 - obj.normalizedHeight })}>
            <AlignBottom className="size-4" weight="bold" />
          </ToolButton>
        </div>

        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Layer order</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => onMoveLayer("up")} className="flex items-center justify-center gap-1.5 rounded-lg border border-sand py-1.5 text-[11px] font-semibold text-ink-900 hover:bg-canvas">
            <ArrowUp className="size-3.5" weight="bold" /> Forward
          </button>
          <button type="button" onClick={() => onMoveLayer("down")} className="flex items-center justify-center gap-1.5 rounded-lg border border-sand py-1.5 text-[11px] font-semibold text-ink-900 hover:bg-canvas">
            <ArrowDown className="size-3.5" weight="bold" /> Backward
          </button>
          <button type="button" onClick={() => onMoveLayerToEdge("front")} className="flex items-center justify-center gap-1.5 rounded-lg border border-sand py-1.5 text-[11px] font-semibold text-ink-900 hover:bg-canvas">
            <ArrowLineUp className="size-3.5" weight="bold" /> To front
          </button>
          <button type="button" onClick={() => onMoveLayerToEdge("back")} className="flex items-center justify-center gap-1.5 rounded-lg border border-sand py-1.5 text-[11px] font-semibold text-ink-900 hover:bg-canvas">
            <ArrowLineDown className="size-3.5" weight="bold" /> To back
          </button>
        </div>

        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Rotation</p>
        <div className="mt-1.5 flex items-center gap-2">
          <ArrowsClockwise className="size-3.5 text-ink-900/50" weight="bold" />
          <input
            type="range"
            min={-180}
            max={180}
            value={obj.rotation}
            onChange={(e) => onLivePatch({ rotation: Number(e.target.value) })}
            onMouseUp={onLivePatchEnd}
            onTouchEnd={onLivePatchEnd}
            className="flex-1"
          />
          <span className="w-9 text-right text-[10px] text-muted">{Math.round(obj.rotation)}°</span>
        </div>
      </Popover>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-sand" />

      {/* Copy / paste formatting */}
      <ToolButton label="Copy style" onClick={onCopyStyle}>
        <PaintBrush className="size-4" weight="bold" />
      </ToolButton>
      {hasCopiedStyle && (
        <button type="button" onClick={onPasteStyle} title="Paste style" className="flex h-8 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-crimson hover:bg-orange/10">
          Paste style
        </button>
      )}

      <ToolButton label="Duplicate (Ctrl/Cmd+D)" onClick={onDuplicate}>
        <Copy className="size-4" weight="bold" />
      </ToolButton>
      <ToolButton label="Delete" onClick={onDelete}>
        <Trash className="size-4" weight="bold" />
      </ToolButton>
    </div>
  );
}
