"use client";

import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Trash } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { DesignObjectRecord } from "@/lib/studio/types";

function defaultLabel(obj: DesignObjectRecord): string {
  if (obj.name) return obj.name;
  if (obj.type === "text") return obj.content?.slice(0, 24) || "Text";
  if (obj.type === "shape") return `${obj.shapeKind ?? "Shape"}`.replace(/^\w/, (c) => c.toUpperCase());
  return "Image";
}

/** Section 8. Array order IS z-order (last element = topmost, drawn last) — this panel shows that
 *  order top-first (reversed) so what's visually on top of the shirt is also on top of the list,
 *  and never exposes Konva/zIndex internals to the customer. Reordering uses up/down buttons
 *  rather than drag-and-drop so it stays fully keyboard-operable (Section 30). */
export function LayersPanel({
  objects,
  selectedId,
  onSelect,
  onMove,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: {
  objects: DesignObjectRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onToggleHidden: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const topFirst = [...objects].reverse();

  if (objects.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted">Nothing on this side yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {topFirst.map((obj, displayIndex) => {
        const isTop = displayIndex === 0;
        const isBottom = displayIndex === topFirst.length - 1;
        const selected = obj.id === selectedId;
        return (
          <li
            key={obj.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
              selected ? "border-crimson/40 bg-crimson/5" : "border-transparent hover:bg-canvas",
            )}
          >
            <button type="button" onClick={() => onSelect(obj.id)} className="min-w-0 flex-1 truncate text-left font-medium text-ink-900">
              {defaultLabel(obj)}
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Move up"
                disabled={isTop}
                onClick={() => onMove(obj.id, "up")}
                className="rounded p-1 text-ink-900/50 hover:bg-white hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" weight="bold" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={isBottom}
                onClick={() => onMove(obj.id, "down")}
                className="rounded p-1 text-ink-900/50 hover:bg-white hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" weight="bold" />
              </button>
              <button
                type="button"
                aria-label={obj.hidden ? "Show layer" : "Hide layer"}
                onClick={() => onToggleHidden(obj.id)}
                className="rounded p-1 text-ink-900/50 hover:bg-white hover:text-ink-900"
              >
                {obj.hidden ? <EyeSlash className="size-3.5" weight="bold" /> : <Eye className="size-3.5" weight="bold" />}
              </button>
              <button type="button" aria-label="Duplicate layer" onClick={() => onDuplicate(obj.id)} className="rounded p-1 text-ink-900/50 hover:bg-white hover:text-ink-900">
                <Copy className="size-3.5" weight="bold" />
              </button>
              <button type="button" aria-label="Delete layer" onClick={() => onDelete(obj.id)} className="rounded p-1 text-ink-900/50 hover:bg-white hover:text-crimson">
                <Trash className="size-3.5" weight="bold" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
