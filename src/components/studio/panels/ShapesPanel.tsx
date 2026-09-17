"use client";

import type { ShapeKind } from "@/lib/studio/types";

// Section "NATIVE SHAPES": every one of these is a real editable Konva object (fill/stroke/
// opacity/rotation/resize — see CanvasStage's ShapeNode), not an external icon library asset.
// Previews here are plain CSS/inline-SVG, just enough to recognize the shape at a glance.
const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rectangle", label: "Rectangle" },
  { kind: "rounded-rectangle", label: "Rounded" },
  { kind: "circle", label: "Circle" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "triangle", label: "Triangle" },
  { kind: "diamond", label: "Diamond" },
  { kind: "polygon", label: "Hexagon" },
  { kind: "star", label: "Star" },
  { kind: "line", label: "Line" },
  { kind: "arrow", label: "Arrow" },
  { kind: "speech-bubble", label: "Speech" },
  { kind: "banner", label: "Banner" },
  { kind: "heart", label: "Heart" },
];

function ShapePreview({ kind }: { kind: ShapeKind }) {
  switch (kind) {
    case "rectangle":
      return <div className="h-8 w-11 bg-ink-900" />;
    case "rounded-rectangle":
      return <div className="h-8 w-11 rounded-lg bg-ink-900" />;
    case "circle":
      return <div className="size-8 rounded-full bg-ink-900" />;
    case "ellipse":
      return <div className="h-7 w-11 rounded-full bg-ink-900" />;
    case "triangle":
      return <div className="size-0 border-x-[16px] border-b-[26px] border-x-transparent border-b-ink-900" />;
    case "diamond":
      return <div className="size-7 rotate-45 bg-ink-900" />;
    case "polygon":
      return <div className="size-8 bg-ink-900" style={{ clipPath: "polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0% 50%)" }} />;
    case "star":
      return (
        <div
          className="size-8 bg-ink-900"
          style={{ clipPath: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" }}
        />
      );
    case "line":
      return <div className="h-1 w-11 rounded-full bg-ink-900" />;
    case "arrow":
      return (
        <svg width="44" height="16" viewBox="0 0 44 16" fill="none">
          <path d="M2 8 H36" stroke="#171412" strokeWidth="3" />
          <path d="M28 2 L40 8 L28 14" stroke="#171412" strokeWidth="3" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case "speech-bubble":
      return (
        <svg width="34" height="30" viewBox="0 0 100 100" fill="#171412">
          <path d="M18 10 H82 Q90 10 90 18 V65 Q90 73 82 73 H40 L25 92 L30 73 H18 Q10 73 10 65 V18 Q10 10 18 10 Z" />
        </svg>
      );
    case "banner":
      return (
        <svg width="40" height="20" viewBox="0 0 100 100" fill="#171412">
          <path d="M2 30 H98 L88 50 L98 70 H2 L12 50 Z" />
        </svg>
      );
    case "heart":
      return (
        <svg width="30" height="30" viewBox="0 0 100 100" fill="#171412">
          <path d="M50 88 C10 62 6 34 26 20 C38 12 48 20 50 30 C52 20 62 12 74 20 C94 34 90 62 50 88 Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function ShapesPanel({ onAddShape }: { onAddShape: (kind: ShapeKind) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHAPES.map((s) => (
        <button
          key={s.kind}
          type="button"
          onClick={() => onAddShape(s.kind)}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-sand transition-colors hover:border-ink-950/30 hover:bg-canvas"
        >
          <ShapePreview kind={s.kind} />
          <span className="text-[11px] font-medium text-ink-900/70">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
