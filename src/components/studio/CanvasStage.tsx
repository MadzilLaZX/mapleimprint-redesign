"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text as KonvaText, Group, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { MOCKUP_PRINT_AREA_BOX } from "@/lib/studio/printAreas";
import { layoutCurvedText } from "@/lib/studio/curvedText";
import type { DesignObjectRecord, DesignSideType } from "@/lib/studio/types";

// All object/print-area math below is done in this fixed "design space" — box coordinates,
// object x/y/width/height are all computed against these constants, never against the container's
// actual measured size. Responsiveness is handled entirely by Konva's own `scale` prop on <Stage>
// (see renderScale below), which shrinks the rendered output — and, critically, the canvas's own
// pixel buffer — to fit the container, rather than a CSS width:100% trick. A canvas's width/height
// HTML attributes are its native pixel buffer size and are NOT affected by an ancestor's
// max-width — that mismatch (fixed 520px buffer inside a narrower flex/grid column) is what
// clipped the mockup at the right edge on narrower layouts. Konva's own `scale` is the standard
// fix: it keeps pointer-event coordinates correctly mapped too, unlike a pure CSS transform.
const NATURAL_WIDTH = 520;
const NATURAL_HEIGHT = 650; // 4:5, matching the site's product-photo aspect convention

function useHtmlImage(url: string | null) {
  const [img] = useImage(url ?? "", "anonymous");
  return url ? img : undefined;
}

/** Measures the wrapping element and fits the stage inside it. Two modes:
 *
 *  - `fitHeight: true` ("contain" — the live Studio editor and Preview): fits inside whichever of
 *    width/height is tighter. The container must stretch to fill a REAL bounded height from its
 *    flex parent (see CanvasStage's root div) — a common laptop resolution like 1366x768 can be
 *    the shorter constraint once Studio is a fixed-height application shell (plenty of width left
 *    over, but the 4:5 canvas plus toolbar/location-selector chrome doesn't fit that viewport's
 *    height). Measuring both and taking the smaller ratio is what makes "Fit" actually mean fit.
 *  - `fitHeight: false` ("width" — ReviewPanel's stacked, scrollable location list): fits width
 *    only and lets height follow the aspect ratio, same as the original single-axis version. Those
 *    previews live in a normal scrollable column with no bounded height to measure against, and
 *    don't want one — the whole point there is a full-size preview per location, not a squeezed one. */
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

function DesignImageNode({
  obj,
  box,
  onSelect,
  onCommit,
  nodeRef,
  readOnly,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  nodeRef: (node: Konva.Image | null) => void;
  readOnly: boolean;
}) {
  const img = useHtmlImage(obj.assetUrl);
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
      draggable={!readOnly}
      onClick={readOnly ? undefined : onSelect}
      onTap={readOnly ? undefined : onSelect}
      onDragEnd={(e) =>
        onCommit({
          normalizedX: (e.target.x() - box.x - (obj.flipX ? width : 0)) / box.width,
          normalizedY: (e.target.y() - box.y - (obj.flipY ? height : 0)) / box.height,
        })
      }
      onTransformEnd={(e) => {
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
      }}
    />
  );
}

function fontStyleFor(obj: DesignObjectRecord): string {
  const parts: string[] = [];
  if (obj.italic) parts.push("italic");
  if (obj.bold) parts.push("bold");
  return parts.length > 0 ? parts.join(" ") : "normal";
}

function DesignTextNode({
  obj,
  box,
  onSelect,
  onCommit,
  onEditRequest,
  nodeRef,
  readOnly,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  onEditRequest: () => void;
  nodeRef: (node: Konva.Text | Konva.Group | null) => void;
  readOnly: boolean;
}) {
  const x = box.x + obj.normalizedX * box.width;
  const y = box.y + obj.normalizedY * box.height;
  const width = obj.normalizedWidth * box.width;
  const fontSize = obj.fontSize ?? 28;

  const dragHandlers = readOnly
    ? {}
    : {
        onClick: onSelect,
        onTap: onSelect,
        onDblClick: onEditRequest,
        onDblTap: onEditRequest,
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
          onCommit({
            normalizedX: (e.target.x() - box.x) / box.width,
            normalizedY: (e.target.y() - box.y) / box.height,
          }),
      };

  if (obj.curve) {
    // Curved text: one Text node per glyph, arced — see curvedText.ts. The invisible bounding Rect
    // is what the Transformer actually grabs (Konva can't usefully resize-handle a multi-child
    // Group of independently-rotated glyphs), so curved text is draggable/rotatable but resized via
    // the font-size slider in the inspector rather than corner handles.
    const glyphs = layoutCurvedText(obj.content ?? "", fontSize, obj.letterSpacing ?? 0, obj.curve);
    return (
      <Group
        ref={nodeRef as unknown as (node: Konva.Group | null) => void}
        x={x + width / 2}
        y={y + fontSize}
        rotation={obj.rotation}
        opacity={obj.opacity}
        draggable={!readOnly}
        {...dragHandlers}
      >
        <Rect x={-width / 2} y={-fontSize} width={width} height={fontSize * 2.4} fill="transparent" />
        {glyphs.map((g, i) => (
          <KonvaText
            key={i}
            text={g.char}
            x={g.x}
            y={g.y}
            fontSize={fontSize}
            fontFamily={obj.fontFamily ?? "Manrope, sans-serif"}
            fontStyle={fontStyleFor(obj)}
            fill={obj.fill ?? "#171412"}
            rotation={g.rotationDeg}
            offsetX={0}
            listening={false}
          />
        ))}
      </Group>
    );
  }

  return (
    <KonvaText
      ref={nodeRef as unknown as (node: Konva.Text | null) => void}
      text={obj.content ?? ""}
      x={x}
      y={y}
      width={width}
      align={obj.align ?? "left"}
      letterSpacing={obj.letterSpacing ?? 0}
      lineHeight={obj.lineHeight ?? 1.15}
      fontSize={fontSize}
      fontFamily={obj.fontFamily ?? "Manrope, sans-serif"}
      fontStyle={fontStyleFor(obj)}
      textDecoration=""
      fill={obj.fill ?? "#171412"}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={!readOnly}
      {...dragHandlers}
      onTransformEnd={(e) => {
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
      }}
    />
  );
}

function ShapeNode({
  obj,
  box,
  onSelect,
  onCommit,
  nodeRef,
  readOnly,
}: {
  obj: DesignObjectRecord;
  box: { x: number; y: number; width: number; height: number };
  onSelect: () => void;
  onCommit: (patch: Partial<DesignObjectRecord>) => void;
  nodeRef: (node: Konva.Shape | Konva.Group | null) => void;
  readOnly: boolean;
}) {
  const x = box.x + obj.normalizedX * box.width;
  const y = box.y + obj.normalizedY * box.height;
  const width = obj.normalizedWidth * box.width;
  const height = obj.normalizedHeight * box.height;

  const shared = {
    rotation: obj.rotation,
    opacity: obj.opacity,
    fill: obj.fill ?? "#D41414",
    stroke: obj.strokeColor ?? undefined,
    strokeWidth: obj.strokeWidth ?? 0,
    draggable: !readOnly,
    onClick: readOnly ? undefined : onSelect,
    onTap: readOnly ? undefined : onSelect,
    onDragEnd: readOnly
      ? undefined
      : (e: Konva.KonvaEventObject<DragEvent>) =>
          onCommit({
            normalizedX: (e.target.x() - box.x) / box.width,
            normalizedY: (e.target.y() - box.y) / box.height,
          }),
    onTransformEnd: readOnly
      ? undefined
      : (e: Konva.KonvaEventObject<Event>) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onCommit({
            normalizedX: (node.x() - box.x) / box.width,
            normalizedY: (node.y() - box.y) / box.height,
            normalizedWidth: (node.width() * scaleX) / box.width,
            normalizedHeight: (node.height() * scaleY) / box.height,
            rotation: node.rotation(),
          });
        },
  };

  if (obj.shapeKind === "circle") {
    return (
      <Circle
        ref={nodeRef as unknown as (node: Konva.Circle | null) => void}
        x={x + width / 2}
        y={y + height / 2}
        radius={Math.min(width, height) / 2}
        {...shared}
      />
    );
  }
  if (obj.shapeKind === "line") {
    return (
      <Line
        ref={nodeRef as unknown as (node: Konva.Line | null) => void}
        x={x}
        y={y + height / 2}
        points={[0, 0, width, 0]}
        lineCap="round"
        {...shared}
        fill={undefined}
        stroke={obj.fill ?? "#171412"}
        strokeWidth={Math.max(2, obj.strokeWidth ?? 4)}
      />
    );
  }
  return (
    <Rect
      ref={nodeRef as unknown as (node: Konva.Rect | null) => void}
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={4}
      {...shared}
    />
  );
}

export function CanvasStage({
  location,
  mockupUrl,
  objects,
  selectedId,
  onSelect,
  onCommitObject,
  editingTextId,
  onEditRequest,
  onEditCommit,
  readOnly = false,
  placementPreview = false,
  zoom = 1,
  fitMode = "contain",
}: {
  location: DesignSideType;
  mockupUrl: string | null;
  objects: DesignObjectRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommitObject: (id: string, patch: Partial<DesignObjectRecord>) => void;
  editingTextId: string | null;
  onEditRequest: (id: string) => void;
  onEditCommit: (id: string, content: string) => void;
  readOnly?: boolean;
  /** True when this location has no real per-location product photo and is rendering the generic
   *  garment silhouette instead — see productDecorationProfile.ts. Swaps the "Print area" badge
   *  for an explicit "Placement Preview" one so a customer never mistakes it for exact photography. */
  placementPreview?: boolean;
  /** Extra zoom multiplier on top of the responsive fit-to-container scale; 1 = fit. Panning past
   *  the viewport at zoom > 1 is handled by the wrapping container's native scroll, not custom
   *  drag logic — see ZoomControls/CanvasWorkspace. */
  zoom?: number;
  /** "contain" (default) fits inside both width and height of a real bounded container — use for
   *  anything living in Studio's fixed-height shell. "width" fits width only, height follows the
   *  aspect ratio — use for a normal scrollable list of full-size previews (ReviewPanel). */
  fitMode?: "contain" | "width";
}) {
  const reduce = useReducedMotion();
  const { containerRef, scale: fitScale } = useResponsiveScale(fitMode === "contain");
  const scale = fitScale * zoom;
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const locationBox = MOCKUP_PRINT_AREA_BOX[location];
  // Design-space box (fixed), used for all object math below.
  const box = {
    x: locationBox.xFrac * NATURAL_WIDTH,
    y: locationBox.yFrac * NATURAL_HEIGHT,
    width: locationBox.widthFrac * NATURAL_WIDTH,
    height: locationBox.heightFrac * NATURAL_HEIGHT,
  };

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  const editingObj = editingTextId ? objects.find((o) => o.id === editingTextId) : null;
  const visibleObjects = objects.filter((o) => !o.hidden);

  return (
    // Outer div is what ResizeObserver measures (see useResponsiveScale) and must have a REAL
    // CSS-computed width/height of its own — h-full/w-full stretching to fill whatever flex/grid
    // space the caller gives it, not sized to its own content, or width/height-based fitting would
    // be circular. It centers a fixed-size inner box (exactly the stage's rendered pixel size) so
    // that every absolutely-positioned overlay below (badge, text-edit textarea) can keep
    // positioning itself relative to THAT inner box's 0,0 — i.e. the stage's own top-left corner —
    // regardless of how much extra space the outer box centers around it.
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
          {!readOnly && (
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
          {visibleObjects.map((obj) => {
            const nodeRef = (node: Konva.Node | null) => {
              if (node) nodeRefs.current.set(obj.id, node);
              else nodeRefs.current.delete(obj.id);
            };
            if (obj.type === "image") {
              return (
                <DesignImageNode
                  key={obj.id}
                  obj={obj}
                  box={box}
                  onSelect={() => onSelect(obj.id)}
                  onCommit={(patch) => onCommitObject(obj.id, patch)}
                  readOnly={readOnly}
                  nodeRef={nodeRef as (node: Konva.Image | null) => void}
                />
              );
            }
            if (obj.type === "shape") {
              return (
                <ShapeNode
                  key={obj.id}
                  obj={obj}
                  box={box}
                  onSelect={() => onSelect(obj.id)}
                  onCommit={(patch) => onCommitObject(obj.id, patch)}
                  readOnly={readOnly}
                  nodeRef={nodeRef}
                />
              );
            }
            return (
              <DesignTextNode
                key={obj.id}
                obj={obj}
                box={box}
                onSelect={() => onSelect(obj.id)}
                onCommit={(patch) => onCommitObject(obj.id, patch)}
                onEditRequest={() => onEditRequest(obj.id)}
                readOnly={readOnly}
                nodeRef={nodeRef}
              />
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
              rotationSnaps={reduce ? [0, 90, 180, 270] : undefined}
              flipEnabled={false}
            />
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

      {!readOnly && editingObj && (
        // This overlay is a real HTML element positioned on top of the (now responsively scaled)
        // canvas, so its CSS position must be scaled by the same factor as the canvas itself —
        // box.x/y/width are in fixed design-space pixels, not the canvas's current rendered size.
        <div
          className="absolute z-10 rounded-lg border-2 border-crimson bg-white/95 p-1 shadow-lg"
          style={{
            left: (box.x + editingObj.normalizedX * box.width) * scale,
            top: (box.y + editingObj.normalizedY * box.height) * scale,
            width: Math.max(120, editingObj.normalizedWidth * box.width * scale),
          }}
        >
          <textarea
            key={editingObj.id}
            ref={(node) => {
              editTextareaRef.current = node;
              // Select the placeholder text on open so typing immediately replaces it instead of
              // inserting mid-string — matters most right after addText() seeds "Your text".
              node?.select();
            }}
            autoFocus
            defaultValue={editingObj.content ?? ""}
            onBlur={() => onEditCommit(editingObj.id, editTextareaRef.current?.value ?? "")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onEditCommit(editingObj.id, editTextareaRef.current?.value ?? "");
              }
              if (e.key === "Escape") onEditCommit(editingObj.id, editingObj.content ?? "");
            }}
            rows={2}
            className="w-full resize-none border-none bg-transparent text-sm text-ink-900 outline-none"
            style={{ fontFamily: editingObj.fontFamily ?? undefined, fontSize: (editingObj.fontSize ?? 16) * scale }}
            aria-label="Edit text"
          />
        </div>
      )}
      </div>
    </div>
  );
}
