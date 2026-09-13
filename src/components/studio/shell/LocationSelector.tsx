"use client";

import { useState } from "react";
import { CaretDown, SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { DecorationLocation } from "@/lib/studio/productDecorationProfile";
import type { DesignSideType } from "@/lib/studio/types";

/** Section 23. Only locations the product is already designing show as pills; everything else the
 *  product's family supports lives behind "More" — never ten pills in a row. ✓/— communicates
 *  "has artwork" without relying on colour alone (Section 30), and REVIEW_REQUIRED locations carry
 *  their own badge so a customer never thinks a special placement is auto-confirmed. */
export function LocationSelector({
  profile,
  openSides,
  activeSide,
  sidesWithArt,
  onSelect,
  onAddLocation,
  addingLocation,
}: {
  profile: DecorationLocation[];
  openSides: DesignSideType[];
  activeSide: DesignSideType;
  sidesWithArt: Set<DesignSideType>;
  onSelect: (side: DesignSideType) => void;
  onAddLocation: (side: DesignSideType) => void;
  addingLocation: DesignSideType | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openSet = new Set(openSides);
  const closedLocations = profile.filter((l) => !openSet.has(l.id) && l.status !== "UNAVAILABLE");
  const labelFor = (id: DesignSideType) => profile.find((l) => l.id === id)?.label ?? id;

  return (
    <div className="relative flex items-center gap-1 rounded-full border border-sand bg-white p-1">
      {openSides.map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => onSelect(side)}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            activeSide === side ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas",
          )}
        >
          {labelFor(side)}
          <span className={cn(activeSide === side ? "text-white/60" : sidesWithArt.has(side) ? "text-crimson" : "text-muted/50")}>
            {sidesWithArt.has(side) ? "✓" : "—"}
          </span>
        </button>
      ))}

      {closedLocations.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-900/70 transition-colors hover:bg-canvas"
          >
            More
            <CaretDown className="size-3" weight="bold" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-sand bg-white p-2 shadow-xl">
              {closedLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  disabled={addingLocation === loc.id}
                  onClick={() => {
                    onAddLocation(loc.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-900 transition-colors hover:bg-canvas disabled:opacity-50"
                >
                  <span>{loc.label}</span>
                  {addingLocation === loc.id ? (
                    <SpinnerGap className="size-3.5 animate-spin text-muted" weight="bold" />
                  ) : loc.status === "REVIEW_REQUIRED" ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-orange">
                      <WarningCircle className="size-3" weight="bold" />
                      Special
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
