"use client";

import { useEffect, useRef } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { useReducedMotion } from "framer-motion";
import { MOCKUP_PRINT_AREA_BOX } from "@/lib/studio/printAreas";
import type { DesignObjectRecord } from "@/lib/studio/types";

const STAGE_WIDTH = 520;
const STAGE_HEIGHT = 650; // 4:5, matching the site's product-photo aspect convention

function useHtmlImage(url: string | null) {
  const [img] = useImage(url ?? "", "anonymous");
  return url ? img : undefined;
}

function MockupBackground({ url }: { url: string | null }) {
  const img = useHtmlImage(url);
  if (!img) return null;
  return <KonvaImage image={img} width={STAGE_WIDTH} height={STAGE_HEIGHT} listening={false} />;
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
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Image | Konva.Text>>(new Map());
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const box = {
    x: MOCKUP_PRINT_AREA_BOX.xFrac * STAGE_WIDTH,
    y: MOCKUP_PRINT_AREA_BOX.yFrac * STAGE_HEIGHT,
    width: MOCKUP_PRINT_AREA_BOX.widthFrac * STAGE_WIDTH,
    height: MOCKUP_PRINT_AREA_BOX.heightFrac * STAGE_HEIGHT,
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
    <div className="relative mx-auto" style={{ width: STAGE_WIDTH, maxWidth: "100%" }}>
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
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
        <div
          className="absolute z-10 rounded-lg border-2 border-crimson bg-white/95 p-1 shadow-lg"
          style={{
            left: box.x + editingObj.normalizedX * box.width,
            top: box.y + editingObj.normalizedY * box.height,
            width: Math.max(120, editingObj.normalizedWidth * box.width),
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
            style={{ fontFamily: editingObj.fontFamily ?? undefined, fontSize: editingObj.fontSize ?? 16 }}
            aria-label="Edit text"
          />
        </div>
      )}
    </div>
  );
}
