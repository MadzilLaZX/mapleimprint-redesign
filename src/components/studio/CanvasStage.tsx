"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Ellipse, Line, Arrow, Star, RegularPolygon, Path, Text as KonvaText, Group, Transformer, Label, Tag } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { cn } from "@/lib/cn";
import { CANVAS_NATURAL_WIDTH, CANVAS_NATURAL_HEIGHT, PLACEMENT_GEOMETRY, bannerPlacementGeometry } from "@/lib/studio/printAreas";
import { layoutCurvedText } from "@/lib/studio/curvedText";
import { localPointToStage } from "@/lib/studio/localCoordinates";
import type { DesignObjectRecord, DesignSideType } from "@/lib/studio/types";
import { useFontReady } from "@/lib/studio/fontLoader";
import { normalizeFontFamilyCss } from "@/lib/studio/fontRegistry";

// All object/print-area math below is done in this fixed "design space" — box coordinates,
// object x/y/width/height are all computed against these constants, never against the container's
// actual measured size. Responsiveness is handled entirely by Konva's own `scale` prop on <Stage>
// (see renderScale below), which shrinks the rendered output — and, critically, the canvas's own
// pixel buffer — to fit the container, rather than a CSS width:100% trick.
const NATURAL_WIDTH = CANVAS_NATURAL_WIDTH;
const NATURAL_HEIGHT = CANVAS_NATURAL_HEIGHT;

// Screen-pixel snap catch radius for the smart alignment guides — divided by the live render scale
// before comparing against LOCAL (box-space) coordinates, which is what keeps the snap feeling the
// same size on screen whether the canvas is zoomed to 50% or 200% (STUDIO V3 brief, "snap threshold
// must scale with zoom") rather than a fixed number of design-space units that would feel twice as
// grabby at 200% as at 100%.
const SNAP_CATCH_PX = 7;
const GUIDE_COLOR = "#ff6a00";

/** One location's worth of objects to render into a shared canvas. Multiple layers sharing the
 *  same GarmentView (see garmentViews.ts) are passed together so, e.g., Left Chest artwork stays
 *  visible while Front is being edited — STUDIO V3 brief Section 8. Exactly one layer should be
 *  `active` in an editable (non-readOnly) canvas; Review/Preview canvases pass every layer with
 *  `active: false` since nothing is ever editable there regardless. */
export interface CanvasLayerSpec {
  location: DesignSideType;
  objects: DesignObjectRecord[];
  active: boolean;
  /** Only set (and only meaningful) for "banner-face" — its real dimensions vary per order, so the
   *  fixed PLACEMENT_GEOMETRY table can't represent it; see bannerPlacementGeometry(). */
  printAreaOverrideIn?: { widthIn: number; heightIn: number };
}

function useHtmlImage(url: string | null) {
  const [img] = useImage(url ?? "", "anonymous");
  return url ? img : undefined;
}

function useResponsiveScale(fitHeight: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const widthScale = rect.width / NATURAL_WIDTH;
      if (!fitHeight) {
        setScale(Math.min(1, widthScale));
        return;
      }
      const heightScale = rect.height / NATURAL_HEIGHT;
      setScale(Math.min(1, widthScale, heightScale));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitHeight]);

  return { containerRef, scale };
}

function MockupBackground({ url }: { url: string | null }) {
  const img = useHtmlImage(url);
  if (!img) return null;
  return <KonvaImage image={img} width={NATURAL_WIDTH} height={NATURAL_HEIGHT} listening={false} />;
}

/** Full-bounding-box hit test regardless of pixel alpha — Konva's default image hit detection
 *  draws the actual image (with transparency) onto its offscreen hit canvas, so a transparent PNG's
 *  see-through margins silently fail to register clicks/taps. That's a real, separate bug from the
 *  late-mounting one below: even once selectable, a logo with lots of transparent padding would
 *  still need a click on an opaque pixel. STUDIO V3 brief, "Transparent images... do not require
 *  clicking an opaque pixel." */
function fullRectHitFunc(context: Konva.Context, shape: Konva.Shape) {
  context.beginPath();
  context.rect(0, 0, shape.width(), shape.height());
  context.closePath();
  context.fillStrokeShape(shape);
}

function DesignImageNode({
  obj,
  box,
  interactive,
  onSelect,
  onCommit,
  onDragMove,
  onDragEnd,
  nodeRef,
  onClickSwitch,
  onMounted,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  interactive: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  onDragMove: (topLeftX: number, topLeftY: number, width: number, height: number) => { x: number; y: number };
  onDragEnd: () => void;
  nodeRef: (node: Konva.Image | null) => void;
  onClickSwitch?: () => void;
  /** Fires once this object's underlying <img> finishes loading and its Konva node has actually
   *  mounted (see the effect below) — CanvasStage uses this to re-run its Transformer-attach
   *  effect, which is what makes a freshly-uploaded image immediately selectable instead of
   *  needing a drag first (its Konva node doesn't exist at all until the async image resolves). */
  onMounted?: () => void;
}) {
  const img = useHtmlImage(obj.assetUrl);
  // Effects are the sanctioned place to react to a ref/DOM-adjacent event — by the time this runs,
  // the `ref` callback above has already fired in this same commit (React commits refs before
  // effects), so nodeRefs already has this node; this only needs to ask the parent to re-check.
  useEffect(() => {
    if (img) onMounted?.();
  }, [img, onMounted]);
  if (!img) return null;

  const width = obj.normalizedWidth * box.width;
  const height = obj.normalizedHeight * box.height;
  // Flip is baked into scaleX/scaleY (-1/1) rather than a separate transform, so it composes with
  // Konva's own Transformer resize without a second transform layer. Flipping a top-left-anchored
  // rect via negative scale mirrors it to the OTHER side of the anchor point, so the anchor is
  // shifted by the full width/height first to keep the same visual bounding box.
  const x = box.x + obj.normalizedX * box.width + (obj.flipX ? width : 0);
  const y = box.y + obj.normalizedY * box.height + (obj.flipY ? height : 0);
  const baseScaleX = obj.flipX ? -1 : 1;
  const baseScaleY = obj.flipY ? -1 : 1;
  const crop =
    obj.cropWidth && obj.cropHeight
      ? {
          x: (obj.cropX ?? 0) * img.naturalWidth,
          y: (obj.cropY ?? 0) * img.naturalHeight,
          width: obj.cropWidth * img.naturalWidth,
          height: obj.cropHeight * img.naturalHeight,
        }
      : undefined;

  const clickHandler = interactive ? onSelect : onClickSwitch;

  return (
    <KonvaImage
      ref={nodeRef}
      image={img}
      crop={crop}
      x={x}
      y={y}
      width={width}
      height={height}
      scaleX={baseScaleX}
      scaleY={baseScaleY}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={interactive}
      hitFunc={fullRectHitFunc}
      onClick={clickHandler}
      onTap={clickHandler}
      onDragMove={
        interactive
          ? (e) => {
              const node = e.target;
              const snapped = onDragMove(node.x() - (obj.flipX ? width : 0), node.y() - (obj.flipY ? height : 0), width, height);
              node.x(snapped.x + (obj.flipX ? width : 0));
              node.y(snapped.y + (obj.flipY ? height : 0));
            }
          : undefined
      }
      onDragEnd={
        interactive
          ? (e) => {
              onDragEnd();
              onCommit({
                normalizedX: (e.target.x() - box.x - (obj.flipX ? width : 0)) / box.width,
                normalizedY: (e.target.y() - box.y - (obj.flipY ? height : 0)) / box.height,
              });
            }
          : undefined
      }
      onTransformEnd={
        interactive
          ? (e) => {
              const node = e.target;
              // Absolute value: the Transformer multiplies whatever scale was already there (-1 for a
              // flipped image) by the drag factor, so the raw sign no longer means "flipped" — flip
              // state is tracked separately in obj.flipX/Y and reapplied as this node's base scale on
              // the next render, never derived from the Transformer's own scale sign.
              const scaleX = Math.abs(node.scaleX());
              const scaleY = Math.abs(node.scaleY());
              node.scaleX(baseScaleX);
              node.scaleY(baseScaleY);
              const newWidth = node.width() * scaleX;
              const newHeight = node.height() * scaleY;
              onCommit({
                normalizedX: (node.x() - box.x - (obj.flipX ? newWidth : 0)) / box.width,
                normalizedY: (node.y() - box.y - (obj.flipY ? newHeight : 0)) / box.height,
                normalizedWidth: newWidth / box.width,
                normalizedHeight: newHeight / box.height,
                rotation: node.rotation(),
              });
            }
          : undefined
      }
    />
  );
}

function fontStyleFor(obj: DesignObjectRecord): string {
  const parts: string[] = [];
  if (obj.italic) parts.push("italic");
  if (obj.bold) parts.push("bold");
  return parts.length > 0 ? parts.join(" ") : "normal";
}

/** Display-only case transform (Text toolbar upgrade) — never touches obj.content itself, so
 *  switching textTransform back to "none" always restores exactly what the customer typed,
 *  including their own capitalization choices mid-word. */
function displayTextFor(obj: DesignObjectRecord): string {
  const raw = obj.content ?? "";
  switch (obj.textTransform) {
    case "uppercase":
      return raw.toUpperCase();
    case "lowercase":
      return raw.toLowerCase();
    case "title":
      return raw.replace(/\p{L}[\p{L}\p{M}'’]*/gu, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
    default:
      return raw;
  }
}

/** Konva.Text's native `textDecoration` accepts a space-separated combination of "underline" and
 *  "line-through" and draws both — no custom overlay needed for either straight or (per-glyph)
 *  curved text. */
function textDecorationFor(obj: DesignObjectRecord): string {
  const parts: string[] = [];
  if (obj.underline) parts.push("underline");
  if (obj.strikethrough) parts.push("line-through");
  return parts.join(" ");
}

/** Shared shadow prop bundle for the "shadow"/"lift"/"glow" effect presets — all three are the
 *  same underlying Konva shadow capability with different default color/blur/offset (set when the
 *  customer picks the preset in the Effects popover); rendering only ever reads the raw fields,
 *  never the preset name, so a customer who nudges the sliders after picking "Lift" isn't fighting
 *  a hardcoded preset. */
function shadowPropsFor(obj: DesignObjectRecord): {
  shadowEnabled: boolean;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
} {
  const active = obj.effectType === "shadow" || obj.effectType === "lift" || obj.effectType === "glow";
  if (!active) return { shadowEnabled: false };
  return {
    shadowEnabled: true,
    shadowColor: obj.shadowColor ?? "#000000",
    shadowOpacity: obj.shadowOpacity ?? 0.5,
    shadowBlur: obj.shadowBlur ?? 6,
    shadowOffsetX: obj.shadowOffsetX ?? 2,
    shadowOffsetY: obj.shadowOffsetY ?? 2,
  };
}

function fillFor(obj: DesignObjectRecord): string {
  if (obj.effectType === "hollow") return "transparent";
  return obj.fill ?? "#171412";
}

function DesignTextNode({
  obj,
  box,
  interactive,
  onSelect,
  onCommit,
  onEditRequest,
  onDragMove,
  onDragEnd,
  nodeRef,
  onClickSwitch,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  interactive: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  onEditRequest: () => void;
  onDragMove: (topLeftX: number, topLeftY: number, width: number, height: number) => { x: number; y: number };
  onDragEnd: () => void;
  nodeRef: (node: Konva.Text | Konva.Group | null) => void;
  onClickSwitch?: () => void;
}) {
  const x = box.x + obj.normalizedX * box.width;
  const y = box.y + obj.normalizedY * box.height;
  const width = obj.normalizedWidth * box.width;
  const height = obj.normalizedHeight * box.height;
  const fontSize = obj.fontSize ?? 28;
  const clickHandler = interactive ? onSelect : onClickSwitch;
  // Font registry upgrade: with 100+ on-demand-loaded fonts, the requested family may still be
  // fetching the first time this object renders — this triggers the load and re-renders once it
  // resolves, so Konva never permanently bakes in geometry measured against a fallback face (both
  // straight Text's native layout AND curved text's own per-glyph measureText below depend on it).
  useFontReady(obj.fontFamily);
  const resolvedFontFamily = normalizeFontFamilyCss(obj.fontFamily);

  const dragHandlers = !interactive
    ? { onClick: clickHandler, onTap: clickHandler }
    : {
        onClick: onSelect,
        onTap: onSelect,
        onDblClick: onEditRequest,
        onDblTap: onEditRequest,
        onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
          const node = e.target;
          const snapped = onDragMove(node.x(), node.y(), width, height);
          node.x(snapped.x);
          node.y(snapped.y);
        },
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
          onDragEnd();
          onCommit({
            normalizedX: (e.target.x() - box.x) / box.width,
            normalizedY: (e.target.y() - box.y) / box.height,
          });
        },
      };

  if (obj.curve) {
    // Curved text: one Text node per glyph, arced — see curvedText.ts. The invisible bounding Rect
    // is what the Transformer actually grabs (Konva can't usefully resize-handle a multi-child
    // Group of independently-rotated glyphs), so the whole composition drags/rotates/resizes as
    // one unit even though it's several Text nodes underneath — Layers still shows a single item
    // (StudioClient never creates separate DesignObjectRecords per glyph). (Not wired into the
    // smart alignment guides — its drag anchor is its visual center rather than a top-left box,
    // and this is a rare enough object type that the added coordinate-conversion isn't worth it
    // here.)
    const glyphs = layoutCurvedText(
      displayTextFor(obj),
      fontSize,
      obj.letterSpacing ?? 0,
      obj.curve,
      resolvedFontFamily,
      obj.bold,
      obj.italic,
    );
    // Real bounding box from the actual laid-out glyphs, not a fixed guess — a tight curve (small
    // |curve|) and an extreme one (±100) have very different vertical sag, and a fixed-height hit
    // rect either wastes empty selectable space or (worse, at high curve) clips off part of the
    // visible arc entirely. Half-glyph-width/height margins account for each glyph's own box
    // around its x/y anchor, not just the anchor point itself.
    const glyphXs = glyphs.map((g) => g.x);
    const glyphYs = glyphs.map((g) => g.y);
    const hMargin = fontSize * 0.65;
    const bboxMinX = glyphs.length ? Math.min(...glyphXs) - hMargin : -width / 2;
    const bboxMaxX = glyphs.length ? Math.max(...glyphXs) + hMargin : width / 2;
    const bboxMinY = glyphs.length ? Math.min(...glyphYs) - fontSize * 1.1 : -fontSize;
    const bboxMaxY = glyphs.length ? Math.max(...glyphYs) + fontSize * 1.3 : fontSize * 1.4;
    return (
      <Group
        ref={nodeRef as unknown as (node: Konva.Group | null) => void}
        x={x + width / 2}
        y={y + fontSize}
        rotation={obj.rotation}
        opacity={obj.opacity}
        draggable={interactive}
        onClick={clickHandler}
        onTap={clickHandler}
        onDragEnd={
          interactive
            ? (e) =>
                onCommit({
                  normalizedX: (e.target.x() - width / 2 - box.x) / box.width,
                  normalizedY: (e.target.y() - fontSize - box.y) / box.height,
                })
            : undefined
        }
        onTransformEnd={
          interactive
            ? (e) => {
                // Corner-handle resize (Section "CURVE + RESIZE"): scales fontSize uniformly, which
                // is what makes the WHOLE composition — arc radius, glyph spacing, everything —
                // re-derive itself as one coherent shape on the next render (layoutCurvedText is a
                // pure function of fontSize), rather than leaving a raw Konva scale transform
                // sitting on the node that re-renders would silently fight or wipe out.
                const node = e.target;
                const scale = (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2;
                node.scaleX(1);
                node.scaleY(1);
                const newFontSize = Math.max(6, Math.round(fontSize * scale));
                onCommit({
                  normalizedX: (node.x() - width / 2 - box.x) / box.width,
                  normalizedY: (node.y() - fontSize - box.y) / box.height,
                  fontSize: newFontSize,
                  rotation: node.rotation(),
                });
              }
            : undefined
        }
      >
        <Rect x={bboxMinX} y={bboxMinY} width={bboxMaxX - bboxMinX} height={bboxMaxY - bboxMinY} fill="transparent" />
        {glyphs.map((g, i) => (
          <KonvaText
            key={i}
            text={g.char}
            x={g.x}
            y={g.y}
            fontSize={fontSize}
            fontFamily={resolvedFontFamily}
            fontStyle={fontStyleFor(obj)}
            textDecoration={textDecorationFor(obj)}
            fill={fillFor(obj)}
            stroke={obj.strokeColor ?? undefined}
            strokeWidth={obj.strokeColor && obj.strokeWidth ? obj.strokeWidth : 0}
            {...shadowPropsFor(obj)}
            rotation={g.rotationDeg}
            offsetX={0}
            listening={false}
          />
        ))}
      </Group>
    );
  }

  const showBackground = obj.effectType === "background";
  const bgPaddingPx = obj.bgPadding ?? 10;

  return (
    <>
      {showBackground && (
        <Rect
          x={x - bgPaddingPx}
          y={y - bgPaddingPx}
          width={width + bgPaddingPx * 2}
          height={height + bgPaddingPx * 2}
          fill={obj.bgColor ?? "#171412"}
          cornerRadius={obj.bgCornerRadius ?? 8}
          rotation={obj.rotation}
          opacity={obj.opacity}
          listening={false}
        />
      )}
      <KonvaText
      ref={nodeRef as unknown as (node: Konva.Text | null) => void}
      text={displayTextFor(obj)}
      x={x}
      y={y}
      width={width}
      align={obj.align ?? "left"}
      letterSpacing={obj.letterSpacing ?? 0}
      lineHeight={obj.lineHeight ?? 1.15}
      fontSize={fontSize}
      fontFamily={resolvedFontFamily}
      fontStyle={fontStyleFor(obj)}
      textDecoration={textDecorationFor(obj)}
      fill={fillFor(obj)}
      stroke={obj.strokeColor ?? undefined}
      strokeWidth={obj.strokeColor && obj.strokeWidth ? obj.strokeWidth : 0}
      {...shadowPropsFor(obj)}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={interactive}
      {...dragHandlers}
      onTransformEnd={
        interactive
          ? (e) => {
              const node = e.target;
              const scaleX = node.scaleX();
              node.scaleX(1);
              node.scaleY(1);
              onCommit({
                normalizedX: (node.x() - box.x) / box.width,
                normalizedY: (node.y() - box.y) / box.height,
                normalizedWidth: (node.width() * scaleX) / box.width,
                fontSize: fontSize * scaleX,
                rotation: node.rotation(),
              });
            }
          : undefined
      }
      />
    </>
  );
}

// Original Maple line art (0-100 viewBox) for the three shapes with no clean Konva primitive —
// everything else below maps onto a native Konva component (Rect/Circle/Ellipse/RegularPolygon/
// Star/Arrow), per the brief's "do not depend on external libraries for basic shapes." Heart
// reuses the exact path already hand-drawn for the Heart graphic in assetProviders.ts (same mark,
// now also available as a native fill/stroke/resizable shape rather than only a fixed asset).
const SHAPE_PATHS: Record<string, string> = {
  heart: "M50 88 C10 62 6 34 26 20 C38 12 48 20 50 30 C52 20 62 12 74 20 C94 34 90 62 50 88 Z",
  banner: "M2 30 H98 L88 50 L98 70 H2 L12 50 Z",
  "speech-bubble": "M18 10 H82 Q90 10 90 18 V65 Q90 73 82 73 H40 L25 92 L30 73 H18 Q10 73 10 65 V18 Q10 10 18 10 Z",
};
const SHAPE_PATH_VIEWBOX = 100;

function ShapeNode({
  obj,
  box,
  interactive,
  onSelect,
  onCommit,
  onDragMove,
  onDragEnd,
  nodeRef,
  onClickSwitch,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  interactive: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  onDragMove: (topLeftX: number, topLeftY: number, width: number, height: number) => { x: number; y: number };
  onDragEnd: () => void;
  nodeRef: (node: Konva.Shape | Konva.Group | null) => void;
  onClickSwitch?: () => void;
}) {
  const x = box.x + obj.normalizedX * box.width;
  const y = box.y + obj.normalizedY * box.height;
  const width = obj.normalizedWidth * box.width;
  const height = obj.normalizedHeight * box.height;
  const clickHandler = interactive ? onSelect : onClickSwitch;
  const kind = obj.shapeKind ?? "rectangle";
  const centerAnchored = kind === "circle" || kind === "ellipse" || kind === "triangle" || kind === "polygon" || kind === "star" || kind === "diamond";

  const shared = {
    rotation: obj.rotation,
    opacity: obj.opacity,
    fill: obj.fill ?? "#D41414",
    stroke: obj.strokeColor ?? undefined,
    strokeWidth: obj.strokeWidth ?? 0,
    draggable: interactive,
    onClick: clickHandler,
    onTap: clickHandler,
  };

  // Center-anchored shapes (Circle/Ellipse/RegularPolygon/Star): the node's own x/y IS its
  // center, so drag/transform math converts to/from the top-left convention every other object
  // type (and the smart-guide snapper) uses — this is the same conversion Circle already used
  // before the other center-anchored kinds existed here, just generalized.
  const centerHandlers = centerAnchored
    ? {
        onDragMove: interactive
          ? (e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target;
              const snapped = onDragMove(node.x() - width / 2, node.y() - height / 2, width, height);
              node.x(snapped.x + width / 2);
              node.y(snapped.y + height / 2);
            }
          : undefined,
        onDragEnd: interactive
          ? (e: Konva.KonvaEventObject<DragEvent>) => {
              onDragEnd();
              onCommit({
                normalizedX: (e.target.x() - width / 2 - box.x) / box.width,
                normalizedY: (e.target.y() - height / 2 - box.y) / box.height,
              });
            }
          : undefined,
        onTransformEnd: interactive
          ? (e: Konva.KonvaEventObject<Event>) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const newWidth = width * scaleX;
              const newHeight = height * scaleY;
              onCommit({
                normalizedX: (node.x() - newWidth / 2 - box.x) / box.width,
                normalizedY: (node.y() - newHeight / 2 - box.y) / box.height,
                normalizedWidth: newWidth / box.width,
                normalizedHeight: newHeight / box.height,
                rotation: node.rotation(),
              });
            }
          : undefined,
      }
    : {
        onDragMove: interactive
          ? (e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target;
              const snapped = onDragMove(node.x(), node.y(), width, height);
              node.x(snapped.x);
              node.y(snapped.y);
            }
          : undefined,
        onDragEnd: interactive
          ? (e: Konva.KonvaEventObject<DragEvent>) => {
              onDragEnd();
              onCommit({
                normalizedX: (e.target.x() - box.x) / box.width,
                normalizedY: (e.target.y() - box.y) / box.height,
              });
            }
          : undefined,
        onTransformEnd: interactive
          ? (e: Konva.KonvaEventObject<Event>) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const newWidth = width * scaleX;
              const newHeight = height * scaleY;
              onCommit({
                normalizedX: (node.x() - box.x) / box.width,
                normalizedY: (node.y() - box.y) / box.height,
                normalizedWidth: newWidth / box.width,
                normalizedHeight: newHeight / box.height,
                rotation: node.rotation(),
              });
            }
          : undefined,
      };

  if (kind === "circle") {
    return (
      <Circle
        ref={nodeRef as unknown as (node: Konva.Circle | null) => void}
        x={x + width / 2}
        y={y + height / 2}
        radius={Math.min(width, height) / 2}
        {...shared}
        {...centerHandlers}
      />
    );
  }
  if (kind === "ellipse") {
    return (
      <Ellipse
        ref={nodeRef as unknown as (node: Konva.Ellipse | null) => void}
        x={x + width / 2}
        y={y + height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        {...shared}
        {...centerHandlers}
      />
    );
  }
  if (kind === "triangle" || kind === "polygon" || kind === "diamond") {
    // Konva draws a RegularPolygon with its first vertex at the top (12 o'clock) for any side
    // count — sides:4 already reads as a diamond/rhombus with no extra rotation offset needed.
    const sides = kind === "triangle" ? 3 : kind === "diamond" ? 4 : 6;
    return (
      <RegularPolygon
        ref={nodeRef as unknown as (node: Konva.RegularPolygon | null) => void}
        x={x + width / 2}
        y={y + height / 2}
        sides={sides}
        radius={Math.min(width, height) / 2}
        {...shared}
        {...centerHandlers}
      />
    );
  }
  if (kind === "star") {
    const radius = Math.min(width, height) / 2;
    return (
      <Star
        ref={nodeRef as unknown as (node: Konva.Star | null) => void}
        x={x + width / 2}
        y={y + height / 2}
        numPoints={5}
        innerRadius={radius * 0.5}
        outerRadius={radius}
        {...shared}
        {...centerHandlers}
      />
    );
  }
  if (kind === "line" || kind === "arrow") {
    const LineOrArrow = kind === "arrow" ? Arrow : Line;
    // Neither fully top-left nor fully center anchored: x is the left edge, y is vertically
    // centered (points run horizontally from the node's own origin) — its own dedicated
    // conversion, distinct from both centerHandlers branches above.
    return (
      <LineOrArrow
        ref={nodeRef as unknown as (node: Konva.Line | Konva.Arrow | null) => void}
        x={x}
        y={y + height / 2}
        points={[0, 0, width, 0]}
        lineCap="round"
        pointerLength={kind === "arrow" ? Math.max(8, height * 4) : undefined}
        pointerWidth={kind === "arrow" ? Math.max(8, height * 4) : undefined}
        {...shared}
        fill={kind === "arrow" ? (obj.fill ?? "#171412") : undefined}
        stroke={obj.fill ?? "#171412"}
        strokeWidth={Math.max(2, obj.strokeWidth ?? 4)}
        onDragMove={
          interactive
            ? (e) => {
                const node = e.target;
                const snapped = onDragMove(node.x(), node.y() - height / 2, width, height);
                node.x(snapped.x);
                node.y(snapped.y + height / 2);
              }
            : undefined
        }
        onDragEnd={
          interactive
            ? (e) => {
                onDragEnd();
                onCommit({
                  normalizedX: (e.target.x() - box.x) / box.width,
                  normalizedY: (e.target.y() - height / 2 - box.y) / box.height,
                });
              }
            : undefined
        }
        onTransformEnd={
          interactive
            ? (e) => {
                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();
                node.scaleX(1);
                node.scaleY(1);
                const newWidth = width * scaleX;
                const newHeight = height * scaleY;
                onCommit({
                  normalizedX: (node.x() - box.x) / box.width,
                  normalizedY: (node.y() - newHeight / 2 - box.y) / box.height,
                  normalizedWidth: newWidth / box.width,
                  normalizedHeight: newHeight / box.height,
                  rotation: node.rotation(),
                });
              }
            : undefined
        }
      />
    );
  }
  if (kind === "speech-bubble" || kind === "banner" || kind === "heart") {
    return (
      <Path
        ref={nodeRef as unknown as (node: Konva.Path | null) => void}
        x={x}
        y={y}
        data={SHAPE_PATHS[kind]}
        scaleX={width / SHAPE_PATH_VIEWBOX}
        scaleY={height / SHAPE_PATH_VIEWBOX}
        {...shared}
        onDragMove={
          interactive
            ? (e) => {
                const node = e.target;
                const snapped = onDragMove(node.x(), node.y(), width, height);
                node.x(snapped.x);
                node.y(snapped.y);
              }
            : undefined
        }
        onDragEnd={
          interactive
            ? (e) => {
                onDragEnd();
                onCommit({
                  normalizedX: (e.target.x() - box.x) / box.width,
                  normalizedY: (e.target.y() - box.y) / box.height,
                });
              }
            : undefined
        }
        onTransformEnd={
          interactive
            ? (e) => {
                const node = e.target;
                // Path has no native width/height to reset — its scaleX/scaleY already directly
                // encode "how big" (see the render props above), so the post-drag scale IS the
                // new size fraction of the fixed 0-100 path box; nothing needs resetting to 1.
                const newWidth = node.scaleX() * SHAPE_PATH_VIEWBOX;
                const newHeight = node.scaleY() * SHAPE_PATH_VIEWBOX;
                onCommit({
                  normalizedX: (node.x() - box.x) / box.width,
                  normalizedY: (node.y() - box.y) / box.height,
                  normalizedWidth: newWidth / box.width,
                  normalizedHeight: newHeight / box.height,
                  rotation: node.rotation(),
                });
              }
            : undefined
        }
      />
    );
  }
  // "rectangle" / "rounded-rectangle" default
  return (
    <Rect
      ref={nodeRef as unknown as (node: Konva.Rect | null) => void}
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={kind === "rounded-rectangle" ? Math.min(width, height) * 0.22 : 4}
      {...shared}
      {...centerHandlers}
    />
  );
}

/** The inline text-edit textarea — a real HTML element positioned on top of the (responsively
 *  scaled, possibly rotated) canvas, not a Konva node. Its own component so the textarea ref is
 *  declared, assigned and read in one clearly-scoped place (React's ref-usage lint rule flags ref
 *  reads that appear far from where the ref is declared much more readily when they're buried
 *  inside a large parent's render body). */
function EditingTextOverlay({
  editingObj,
  box,
  groupCenterX,
  groupCenterY,
  rotationDeg,
  scale,
  onEditCommit,
}: {
  editingObj: DesignObjectRecord;
  box: { width: number; height: number };
  groupCenterX: number;
  groupCenterY: number;
  rotationDeg: number;
  scale: number;
  onEditCommit: (id: string, content: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Select the placeholder text once mounted, so typing immediately replaces it instead of
    // inserting mid-string — matters most right after addText() seeds "Your text".
    textareaRef.current?.select();
  }, []);

  const topLeft = localPointToStage(editingObj.normalizedX * box.width, editingObj.normalizedY * box.height, {
    centerX: groupCenterX,
    centerY: groupCenterY,
    width: box.width,
    height: box.height,
    rotationDeg,
  });

  function commit() {
    onEditCommit(editingObj.id, textareaRef.current?.value ?? "");
  }

  return (
    <div
      className="absolute z-10 rounded-lg border-2 border-crimson bg-white/95 p-1 shadow-lg"
      style={{
        left: topLeft.x * scale,
        top: topLeft.y * scale,
        width: Math.max(120, editingObj.normalizedWidth * box.width * scale),
        transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
        transformOrigin: "top left",
      }}
    >
      <textarea
        key={editingObj.id}
        ref={textareaRef}
        autoFocus
        defaultValue={editingObj.content ?? ""}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") onEditCommit(editingObj.id, editingObj.content ?? "");
        }}
        rows={2}
        className="w-full resize-none border-none bg-transparent text-sm text-ink-900 outline-none"
        style={{ fontFamily: editingObj.fontFamily ?? undefined, fontSize: (editingObj.fontSize ?? 16) * scale }}
        aria-label="Edit text"
      />
    </div>
  );
}

function normalizeDeg(deg: number): number {
  return Math.round(((deg % 360) + 540) % 360 - 180);
}

function boxFor(location: DesignSideType, override?: { widthIn: number; heightIn: number }) {
  const geometry = override ? bannerPlacementGeometry(override.widthIn, override.heightIn) : PLACEMENT_GEOMETRY[location];
  return {
    box: { x: 0, y: 0, width: geometry.widthFrac * NATURAL_WIDTH, height: geometry.heightFrac * NATURAL_HEIGHT },
    groupCenterX: (geometry.xFrac + geometry.widthFrac / 2) * NATURAL_WIDTH,
    groupCenterY: (geometry.yFrac + geometry.heightFrac / 2) * NATURAL_HEIGHT,
    rotationDeg: geometry.rotationDeg,
  };
}

export function CanvasStage({
  layers,
  mockupUrl,
  selectedId,
  onSelect,
  onCommitObject,
  editingTextId,
  onEditRequest,
  onEditCommit,
  onSwitchLocation,
  readOnly = false,
  placementPreview = false,
  zoom = 1,
  fitMode = "contain",
}: {
  /** Every location visible in this canvas right now — see CanvasLayerSpec. Exactly one should be
   *  `active` in an editable canvas; pass a single-entry array with `active: false` for a plain
   *  read-only single-location view (ReviewPanel's per-location cell, a schematic view, etc). */
  layers: CanvasLayerSpec[];
  mockupUrl: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommitObject: (id: string, patch: Partial<DesignObjectRecord>) => void;
  editingTextId: string | null;
  onEditRequest: (id: string) => void;
  onEditCommit: (id: string, content: string) => void;
  /** Clicking artwork that belongs to a non-active layer switches editing to that layer's location
   *  — optional; omit to leave other layers' artwork visible but inert (still satisfies "artwork
   *  must remain visible" on its own). */
  onSwitchLocation?: (location: DesignSideType) => void;
  readOnly?: boolean;
  /** True when this location has no real per-location product photo and is rendering the generic
   *  garment silhouette instead — see productDecorationProfile.ts. Swaps the "Print area" badge
   *  for an explicit "Placement Preview" one so a customer never mistakes it for exact photography. */
  placementPreview?: boolean;
  zoom?: number;
  fitMode?: "contain" | "width";
}) {
  const { containerRef, scale: fitScale } = useResponsiveScale(fitMode === "contain");
  const scale = fitScale * zoom;
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  // Bumped once an image object's Konva node actually mounts — see DesignImageNode's own effect
  // and the comment there. The Transformer-attach effect below depends on this in addition to
  // selectedId, which is what fixes the "uploaded image isn't selectable until you move it" bug:
  // an image's Konva node doesn't exist until its (async) <img> has loaded, so the very first
  // render right after upload has no node in nodeRefs yet — without this, the attach effect runs
  // once, finds nothing, and never runs again once the image finishes loading and registers its
  // ref. useCallback (stable, empty deps — setState setters are always stable) rather than a
  // fresh closure every render: DesignImageNode's effect depends on this function's identity, and
  // a fresh one each render would re-fire that effect every render forever.
  const [nodeVersion, setNodeVersion] = useState(0);
  const bumpNodeVersion = useCallback(() => setNodeVersion((v) => v + 1), []);
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [rotateReadout, setRotateReadout] = useState<{ x: number; y: number; deg: number } | null>(null);

  const activeLayer = layers.find((l) => l.active) ?? null;
  const activeGeometry = activeLayer ? boxFor(activeLayer.location, activeLayer.printAreaOverrideIn) : null;

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, layers, nodeVersion]);

  const editingObj = editingTextId ? layers.flatMap((l) => l.objects).find((o) => o.id === editingTextId) : null;

  /** Smart alignment guides (STUDIO V3 brief, Section 3): snaps a dragged object's TOP-LEFT corner
   *  against the active print area's own center/edges and every other visible object's edges/center
   *  on that SAME print area — never against a different location's artwork, even when it's visible
   *  in the same composite view (the brief is explicit: "do not snap to objects belonging to
   *  unrelated garment surfaces"). Returns the (possibly adjusted) top-left position; callers pass
   *  their own node's current position/size and apply the result straight back onto the Konva node. */
  function snapDrag(objId: string, x: number, y: number, width: number, height: number): { x: number; y: number } {
    if (!activeLayer || !activeGeometry) return { x, y };
    const threshold = SNAP_CATCH_PX / (scale || 1);
    const box = activeGeometry.box;
    const vTargets = [0, box.width / 2, box.width];
    const hTargets = [0, box.height / 2, box.height];
    for (const o of activeLayer.objects) {
      if (o.id === objId || o.hidden) continue;
      const ow = o.normalizedWidth * box.width;
      const oh = o.normalizedHeight * box.height;
      const ox = o.normalizedX * box.width;
      const oy = o.normalizedY * box.height;
      vTargets.push(ox, ox + ow / 2, ox + ow);
      hTargets.push(oy, oy + oh / 2, oy + oh);
    }
    let snapX = x;
    let vGuide: number | null = null;
    for (const cx of [x, x + width / 2, x + width]) {
      for (const t of vTargets) {
        if (Math.abs(cx - t) < threshold) {
          snapX = x + (t - cx);
          vGuide = t;
        }
      }
    }
    let snapY = y;
    let hGuide: number | null = null;
    for (const cy of [y, y + height / 2, y + height]) {
      for (const t of hTargets) {
        if (Math.abs(cy - t) < threshold) {
          snapY = y + (t - cy);
          hGuide = t;
        }
      }
    }
    setGuides({ v: vGuide, h: hGuide });
    return { x: snapX, y: snapY };
  }

  function clearGuides() {
    setGuides({ v: null, h: null });
  }

  // QR codes must resize as squares (Section "QR ASPECT RATIO": "Do not allow free distortion") —
  // Konva's Transformer takes keepRatio/enabledAnchors as stage-level props, not per-node, so this
  // looks up whichever object is currently selected (across every layer, active or not) to decide.
  const selectedObj = selectedId ? layers.flatMap((l) => l.objects).find((o) => o.id === selectedId) : null;
  const selectedIsQr = selectedObj?.type === "qr";

  const preparedLayers = layers.map((layer) => {
    const { box, groupCenterX, groupCenterY, rotationDeg } = boxFor(layer.location, layer.printAreaOverrideIn);
    const interactive = !readOnly && layer.active;
    const renderObjects = layer.objects
      .filter((o) => !o.hidden)
      .map((obj) => ({
        obj,
        onClickSwitch: !interactive && !readOnly && onSwitchLocation ? () => onSwitchLocation(layer.location) : undefined,
      }));
    return { layer, box, groupCenterX, groupCenterY, rotationDeg, shouldClip: rotationDeg !== 0, interactive, renderObjects };
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        fitMode === "contain" ? "flex h-full w-full items-center justify-center" : "mx-auto flex w-full items-center justify-center",
        zoom > 1 && "overflow-auto",
      )}
      style={fitMode === "width" ? { maxWidth: NATURAL_WIDTH } : undefined}
    >
      <div className="relative" style={{ width: NATURAL_WIDTH * scale, height: NATURAL_HEIGHT * scale }}>
        <Stage
          ref={stageRef}
          width={NATURAL_WIDTH * scale}
          height={NATURAL_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(e) => {
            if (!readOnly && e.target === e.target.getStage()) onSelect(null);
          }}
          className="overflow-hidden rounded-3xl bg-white"
        >
          <Layer>
            <MockupBackground url={mockupUrl} />
            {preparedLayers.map(({ layer, box, groupCenterX, groupCenterY, rotationDeg, shouldClip, interactive, renderObjects }) => {
              return (
                // This Group IS the print area's local coordinate space (Section 8/9 of the earlier
                // brief) — positioned at the mockup location's center and rotated by rotationDeg,
                // with offsetX/Y set to its own half-size so rotation pivots around its center.
                // Every child below is drawn in LOCAL, unrotated coordinates; Konva's own transform
                // is what makes them appear correctly on the mockup. One Group per open location
                // sharing this view (STUDIO V3): only the active one gets the dashed boundary and
                // Transformer/drag/select — the rest render their real artwork at full opacity so
                // the composite reads as "what the finished garment actually looks like."
                <Group
                  key={layer.location}
                  x={groupCenterX}
                  y={groupCenterY}
                  offsetX={box.width / 2}
                  offsetY={box.height / 2}
                  rotation={rotationDeg}
                  clipX={shouldClip ? 0 : undefined}
                  clipY={shouldClip ? 0 : undefined}
                  clipWidth={shouldClip ? box.width : undefined}
                  clipHeight={shouldClip ? box.height : undefined}
                >
                  {interactive && !readOnly && (
                    <Rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      stroke="#D41414"
                      strokeWidth={1}
                      dash={[6, 6]}
                      listening={false}
                      opacity={0.55}
                    />
                  )}
                  {interactive && guides.v !== null && (
                    <Line points={[guides.v, -40, guides.v, box.height + 40]} stroke={GUIDE_COLOR} strokeWidth={1} listening={false} />
                  )}
                  {interactive && guides.h !== null && (
                    <Line points={[-40, guides.h, box.width + 40, guides.h]} stroke={GUIDE_COLOR} strokeWidth={1} listening={false} />
                  )}
                  {renderObjects.map(({ obj, onClickSwitch }) => {
                    // Plain per-render closures, assigned directly to the `ref` prop each node
                    // type forwards onto its Konva node — this is the sanctioned place refs get
                    // written (React calls it during commit, never during render itself), so it
                    // does NOT trip react-hooks/refs the way reading nodeRefs.current inside the
                    // render body to build/cache a callback would.
                    const nodeRef = (node: Konva.Node | null) => {
                      if (node) nodeRefs.current.set(obj.id, node);
                      else nodeRefs.current.delete(obj.id);
                    };
                    if (obj.type === "image" || obj.type === "qr") {
                      return (
                        <DesignImageNode
                          key={obj.id}
                          obj={obj}
                          box={box}
                          interactive={interactive}
                          onSelect={() => onSelect(obj.id)}
                          onCommit={(patch) => onCommitObject(obj.id, patch)}
                          onDragMove={(x, y, w, h) => snapDrag(obj.id, x, y, w, h)}
                          onDragEnd={clearGuides}
                          nodeRef={nodeRef as (node: Konva.Image | null) => void}
                          onClickSwitch={onClickSwitch}
                          onMounted={bumpNodeVersion}
                        />
                      );
                    }
                    if (obj.type === "shape") {
                      return (
                        <ShapeNode
                          key={obj.id}
                          obj={obj}
                          box={box}
                          interactive={interactive}
                          onSelect={() => onSelect(obj.id)}
                          onCommit={(patch) => onCommitObject(obj.id, patch)}
                          onDragMove={(x, y, w, h) => snapDrag(obj.id, x, y, w, h)}
                          onDragEnd={clearGuides}
                          nodeRef={nodeRef}
                          onClickSwitch={onClickSwitch}
                        />
                      );
                    }
                    return (
                      <DesignTextNode
                        key={obj.id}
                        obj={obj}
                        box={box}
                        interactive={interactive}
                        onSelect={() => onSelect(obj.id)}
                        onCommit={(patch) => onCommitObject(obj.id, patch)}
                        onEditRequest={() => onEditRequest(obj.id)}
                        onDragMove={(x, y, w, h) => snapDrag(obj.id, x, y, w, h)}
                        onDragEnd={clearGuides}
                        nodeRef={nodeRef}
                        onClickSwitch={onClickSwitch}
                      />
                    );
                  })}
                </Group>
              );
            })}
            {!readOnly && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                anchorSize={12}
                anchorCornerRadius={6}
                borderStroke="#D41414"
                anchorStroke="#D41414"
                anchorFill="#ffffff"
                // Subtle rotation snapping (Section 2): catches near the 8 common angles within a
                // few degrees rather than fighting every small manual adjustment — Konva's own
                // rotationSnapTolerance is exactly this "small threshold" behaviour built in.
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                rotationSnapTolerance={3}
                flipEnabled={false}
                keepRatio={selectedIsQr}
                enabledAnchors={selectedIsQr ? ["top-left", "top-right", "bottom-left", "bottom-right"] : undefined}
                onTransformStart={(e) => {
                  const node = e.target;
                  const pos = node.getAbsolutePosition();
                  setRotateReadout({ x: pos.x, y: pos.y, deg: normalizeDeg(node.rotation()) });
                }}
                onTransform={(e) => {
                  const node = e.target;
                  const pos = node.getAbsolutePosition();
                  setRotateReadout({ x: pos.x, y: pos.y, deg: normalizeDeg(node.rotation()) });
                }}
                onTransformEnd={() => setRotateReadout(null)}
              />
            )}
            {rotateReadout && (
              <Label x={rotateReadout.x} y={rotateReadout.y - 32} listening={false}>
                <Tag fill="#171412" cornerRadius={5} />
                <KonvaText text={`${rotateReadout.deg}°`} fontSize={12} fontStyle="700" fill="#ffffff" padding={5} />
              </Label>
            )}
          </Layer>
        </Stage>

        {!readOnly && (
          <p
            className={cn(
              "pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white",
              placementPreview ? "bg-orange/90" : "bg-ink-950/80",
            )}
          >
            {placementPreview ? "Placement Preview" : "Print area"}
          </p>
        )}

        {!readOnly && editingObj && activeGeometry && (
          <EditingTextOverlay
            editingObj={editingObj}
            box={activeGeometry.box}
            groupCenterX={activeGeometry.groupCenterX}
            groupCenterY={activeGeometry.groupCenterY}
            rotationDeg={activeGeometry.rotationDeg}
            scale={scale}
            onEditCommit={onEditCommit}
          />
        )}
      </div>
    </div>
  );
}
