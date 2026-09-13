"use client";

import type { ShapeKind } from "@/lib/studio/types";

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rectangle", label: "Rectangle" },
  { kind: "circle", label: "Circle" },
  { kind: "line", label: "Line" },
];

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
          {s.kind === "rectangle" && <div className="h-8 w-11 rounded-sm bg-ink-900" />}
          {s.kind === "circle" && <div className="size-8 rounded-full bg-ink-900" />}
          {s.kind === "line" && <div className="h-1 w-11 rounded-full bg-ink-900" />}
          <span className="text-[11px] font-medium text-ink-900/70">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
