"use client";

import { useEffect, useState } from "react";
import { ImageSquare } from "@phosphor-icons/react/dist/ssr";
import { backgroundUrlFor, CANVAS_NATURAL_WIDTH, CANVAS_NATURAL_HEIGHT, PLACEMENT_GEOMETRY } from "@/lib/studio/printAreas";
import { decorationProfileFor } from "@/lib/studio/productDecorationProfile";
import type { DesignObjectRecord, DesignProjectRecord } from "@/lib/studio/types";

/** Section "CART ITEM DESIGN PREVIEW": a real composite thumbnail showing the actual selected
 *  colour + the customer's actual artwork, not just the blank garment. There is no pre-generated
 *  Review preview image to reuse (`CartItem.previewImageUrl` exists in the type but is never set
 *  anywhere — checked before building this) and exporting one from Konva would need a ref threaded
 *  out through CanvasStage's `dynamic()` boundary, which is disproportionate for a cart thumbnail.
 *  Instead this builds a lightweight DOM composite directly from the same normalized-fraction data
 *  Studio already uses everywhere (PLACEMENT_GEOMETRY, normalizedX/Y/Width/Height) — no Konva, no
 *  canvas export, nothing new persisted. Fetches the frozen DesignProject once (GET /api/studio/
 *  [id], the same route Studio itself uses) — cheap and safe since "ordered" designs never change. */
export function DesignPreviewThumbnail({ designProjectId, widthPx = 80, fallbackImage }: { designProjectId: string; widthPx?: number; fallbackImage: string }) {
  const [project, setProject] = useState<DesignProjectRecord | null | "error">(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/studio/${designProjectId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: DesignProjectRecord) => {
        if (!cancelled) setProject(data);
      })
      .catch(() => {
        if (!cancelled) setProject("error");
      });
    return () => {
      cancelled = true;
    };
  }, [designProjectId]);

  const boxStyle = { width: widthPx, aspectRatio: `${CANVAS_NATURAL_WIDTH} / ${CANVAS_NATURAL_HEIGHT}` };

  if (project === "error" || (project && project.sides.every((s) => s.objects.length === 0))) {
    return (
      <div style={boxStyle} className="relative shrink-0 overflow-hidden rounded-xl bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size thumbnail, not a Next/Image-worthy asset */}
        <img src={fallbackImage} alt="" className="size-full object-cover" />
      </div>
    );
  }

  if (!project) {
    return <div style={boxStyle} className="relative shrink-0 animate-pulse rounded-xl bg-canvas" aria-hidden />;
  }

  const decoratedSide = project.sides.find((s) => s.sideType === "front" && s.objects.length > 0) ?? project.sides.find((s) => s.objects.length > 0);
  if (!decoratedSide) {
    return (
      <div style={boxStyle} className="relative shrink-0 overflow-hidden rounded-xl bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fallbackImage} alt="" className="size-full object-cover" />
      </div>
    );
  }

  const profile = decorationProfileFor(project.categorySlug, project.subcategorySlug, Boolean(project.mockupImages.back)).locations;
  const location = profile.find((l) => l.id === decoratedSide.sideType);
  const mockupUrl = location ? backgroundUrlFor(location.viewType, project.mockupImages, project.colourName, location.usesPlacementPreview) : fallbackImage;
  const box = PLACEMENT_GEOMETRY[decoratedSide.sideType];
  const scale = widthPx / CANVAS_NATURAL_WIDTH;

  return (
    <div style={boxStyle} className="relative shrink-0 overflow-hidden rounded-xl bg-white">
      {mockupUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mockupUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <ImageSquare className="absolute inset-0 m-auto size-5 text-muted" weight="bold" />
      )}
      <div
        className="absolute overflow-hidden"
        style={{ left: `${box.xFrac * 100}%`, top: `${box.yFrac * 100}%`, width: `${box.widthFrac * 100}%`, height: `${box.heightFrac * 100}%` }}
      >
        {decoratedSide.objects
          .filter((o) => !o.hidden)
          .map((obj) => (
            <ThumbnailObject key={obj.id} obj={obj} scale={scale} />
          ))}
      </div>
    </div>
  );
}

function ThumbnailObject({ obj, scale }: { obj: DesignObjectRecord; scale: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${obj.normalizedX * 100}%`,
    top: `${obj.normalizedY * 100}%`,
    width: `${obj.normalizedWidth * 100}%`,
    height: `${obj.normalizedHeight * 100}%`,
    opacity: obj.opacity,
    transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
    transformOrigin: "center",
  };

  if (obj.type === "image" || obj.type === "qr") {
    if (!obj.assetUrl) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={obj.assetUrl}
        alt=""
        style={{ ...style, objectFit: "contain", transform: `${style.transform ?? ""} ${obj.flipX ? "scaleX(-1)" : ""} ${obj.flipY ? "scaleY(-1)" : ""}`.trim() || undefined }}
      />
    );
  }

  if (obj.type === "text") {
    return (
      <div
        style={{
          ...style,
          fontFamily: obj.fontFamily ?? undefined,
          fontSize: (obj.fontSize ?? 16) * scale,
          fontWeight: obj.bold ? 700 : 400,
          fontStyle: obj.italic ? "italic" : undefined,
          color: obj.fill ?? "#171412",
          textAlign: (obj.align as React.CSSProperties["textAlign"]) ?? "center",
          lineHeight: 1.1,
          overflow: "hidden",
          whiteSpace: "pre-wrap",
        }}
      >
        {obj.content}
      </div>
    );
  }

  // Shapes: a tasteful simplification for a small thumbnail — real fill/opacity/rotation, but
  // every shape kind other than circle/ellipse renders as a plain rounded block rather than its
  // exact geometry (star, speech-bubble, etc.). Good enough to read as "there's a graphic here" at
  // 80px; the real shape is always visible on-canvas and in Review.
  return (
    <div
      style={{
        ...style,
        backgroundColor: obj.fill ?? "#171412",
        borderRadius: obj.shapeKind === "circle" || obj.shapeKind === "ellipse" ? "50%" : obj.shapeKind === "rounded-rectangle" ? "15%" : 0,
        border: obj.strokeColor && obj.strokeWidth ? `${Math.max(1, obj.strokeWidth * scale)}px solid ${obj.strokeColor}` : undefined,
      }}
    />
  );
}
