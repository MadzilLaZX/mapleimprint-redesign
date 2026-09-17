"use client";

import { FolderSimple, Hexagon, ImageSquare, QrCode, SquaresFour, TextT, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { StudioToolId } from "@/lib/studio/tools";
import { STUDIO_TOOLS } from "@/lib/studio/tools";

const ICONS: Record<StudioToolId, typeof TextT> = {
  designs: SquaresFour,
  uploads: UploadSimple,
  text: TextT,
  graphics: ImageSquare,
  shapes: Hexagon,
  qr: QrCode,
  "my-stuff": FolderSimple,
};

/** Primary left tool rail (Section 1). Narrow, permanent, icon+label — clicking a tool toggles the
 *  SecondaryPanel beside it. Deliberately just 6 fixed entries, not a menu, so the whole surface
 *  stays understandable within seconds (core Studio V2 principle: self-explanatory, no tutorial). */
export function ToolRail({
  activeTool,
  onSelectTool,
  className,
}: {
  activeTool: StudioToolId | null;
  onSelectTool: (tool: StudioToolId) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Design tools"
      className={cn(
        // Fixed bottom tab bar on mobile (Section 28) — taken out of document flow so it can't be
        // pushed offscreen by canvas/inspector content; back to a normal static left rail at lg+.
        "fixed inset-x-0 bottom-0 z-20 flex justify-around gap-1 border-t border-sand bg-white px-1 py-1.5 lg:static lg:z-auto lg:w-[76px] lg:flex-col lg:justify-start lg:gap-0.5 lg:border-t-0 lg:py-3",
        className,
      )}
    >
      {STUDIO_TOOLS.map((tool) => {
        const Icon = ICONS[tool.id];
        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            aria-pressed={active}
            aria-label={tool.label}
            onClick={() => onSelectTool(tool.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors lg:mx-2 lg:flex-none lg:gap-1 lg:px-0 lg:py-2.5 lg:text-[11px]",
              active ? "bg-crimson/10 text-crimson" : "text-ink-900/70 hover:bg-canvas hover:text-ink-900",
            )}
          >
            <Icon className="size-5" weight={active ? "fill" : "regular"} />
            {tool.label}
          </button>
        );
      })}
    </nav>
  );
}
