"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { useReducedMotion } from "framer-motion";
import { MOCKUP_PRINT_AREA_BOX } from "@/lib/studio/printAreas";
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

/** Measures the wrapping element's content width so the stage can shrink to fit it — never grows
 *  past NATURAL_WIDTH (no upscaling past native resolution on huge screens). */
function useResponsiveScale() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(Math.min(1, width / NATURAL_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  return (
    <KonvaImage
      ref={nodeRef}
      image={img}
      x={box.x + obj.normalizedX * box.width}
      y={box.y + obj.normalizedY * box.height}
      width={obj.normalizedWidth * box.width}
      height={obj.normalizedHeight * box.height}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={!readOnly}
      onClick={readOnly ? undefined : onSelect}
      onTap={readOnly ? undefined : onSelect}
      onDragEnd={(e) =>
        onCommit({
          normalizedX: (e.target.x() - box.x) / box.width,
          normalizedY: (e.target.y() - box.y) / box.height,
        })
      }
      onTransformEnd={(e) => {
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
      }}
    />
  );
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
  nodeRef: (node: Konva.Text | null) => void;
  readOnly: boolean;
}) {
  return (
    <KonvaText
      ref={nodeRef}
      text={obj.content ?? ""}
      x={box.x + obj.normalizedX * box.width}
      y={box.y + obj.normalizedY * box.height}
      width={obj.normalizedWidth * box.width}
      fontSize={obj.fontSize ?? 28}
      fontFamily={obj.fontFamily ?? "Manrope, sans-serif"}
      fill={obj.fill ?? "#171412"}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={!readOnly}
      onClick={readOnly ? undefined : onSelect}
      onTap={readOnly ? undefined : onSelect}
      onDblClick={readOnly ? undefined : onEditRequest}
      onDblTap={readOnly ? undefined : onEditRequest}
      onDragEnd={(e) =>
        onCommit({
          normalizedX: (e.target.x() - box.x) / box.width,
          normalizedY: (e.target.y() - box.y) / box.height,
        })
      }
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onCommit({
          normalizedX: (node.x() - box.x) / box.width,
          normalizedY: (node.y() - box.y) / box.height,
          normalizedWidth: (node.width() * scaleX) / box.width,
          fontSize: (obj.fontSize ?? 28) * scaleX,
          rotation: node.rotation(),
        });
      }}
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
}) {
  const reduce = useReducedMotion();
  const { containerRef, scale } = useResponsiveScale();
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Image | Konva.Text>>(new Map());
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

  return (
    <div ref={containerRef} className="relative mx-auto w-full" style={{ maxWidth: NATURAL_WIDTH }}>
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
          {objects.map((obj) =>
            obj.type === "image" ? (
              <DesignImageNode
                key={obj.id}
                obj={obj}
                box={box}
                onSelect={() => onSelect(obj.id)}
                onCommit={(patch) => onCommitObject(obj.id, patch)}
                readOnly={readOnly}
                nodeRef={(node) => {
                  if (node) nodeRefs.current.set(obj.id, node);
                  else nodeRefs.current.delete(obj.id);
                }}
              />
            ) : (
              <DesignTextNode
                key={obj.id}
                obj={obj}
                box={box}
                onSelect={() => onSelect(obj.id)}
                onCommit={(patch) => onCommitObject(obj.id, patch)}
                onEditRequest={() => onEditRequest(obj.id)}
                readOnly={readOnly}
                nodeRef={(node) => {
                  if (node) nodeRefs.current.set(obj.id, node);
                  else nodeRefs.current.delete(obj.id);
                }}
              />
            ),
          )}
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
        <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-ink-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Print area
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
  );
}
