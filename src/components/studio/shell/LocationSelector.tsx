"use client";

import { useEffect, useRef, useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { DecorationLocation } from "@/lib/studio/productDecorationProfile";
import type { DesignSideType } from "@/lib/studio/types";

/** Every decoration location the product's family supports, in one scrollable strip — no "More"
 *  dropdown. The customer should see immediately which locations exist (Section 1); REVIEW_REQUIRED
 *  ones carry a single small dot rather than a repeated "SPECIAL" label (Section 4), and the actual
 *  explanation text lives elsewhere (StudioClient renders it near the canvas only for the active
 *  location) so the strip itself stays quiet. Locations don't need to already have a DesignSide row
 *  to appear here — `onSelect` is responsible for creating one on first click if needed (see
 *  StudioClient's handleSelectLocation); this component only renders and scrolls. */
export function LocationSelector({
  profile,
  activeSide,
  sidesWithArt,
  onSelect,
  pendingLocation,
}: {
  profile: DecorationLocation[];
  activeSide: DesignSideType;
  sidesWithArt: Set<DesignSideType>;
  onSelect: (side: DesignSideType) => void;
  pendingLocation: DesignSideType | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Map<DesignSideType, HTMLButtonElement>>(new Map());
  const [fade, setFade] = useState({ left: false, right: false });

  const locations = profile.filter((l) => l.status !== "UNAVAILABLE");

  function updateFade() {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    updateFade();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);
    return () => observer.disconnect();
  }, [locations.length]);

  // Auto-scroll the active location into view — matters most right after Studio loads (front is
  // already visible so this is a no-op) and after switching from the on-canvas location strip
  // itself, since a location near the scrolled-away edge should never require a second manual
  // scroll just to confirm it's now selected.
  useEffect(() => {
    const pill = pillRefs.current.get(activeSide);
    pill?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSide]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateFade}
        className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-sand bg-white p-1"
      >
        {locations.map((loc) => {
          const active = activeSide === loc.id;
          const pending = pendingLocation === loc.id;
          return (
            <button
              key={loc.id}
              ref={(node) => {
                if (node) pillRefs.current.set(loc.id, node);
                else pillRefs.current.delete(loc.id);
              }}
              type="button"
              disabled={pending}
              onClick={() => onSelect(loc.id)}
              aria-pressed={active}
              aria-label={loc.status === "REVIEW_REQUIRED" ? `${loc.label} — special placement, confirmed by Maple before production` : loc.label}
              className={cn(
                "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                active ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas",
                pending && "cursor-wait opacity-60",
              )}
            >
              {pending && <SpinnerGap className="size-3 animate-spin" weight="bold" />}
              {loc.label}
              {loc.status === "REVIEW_REQUIRED" && (
                <span className={cn("text-[10px] leading-none", active ? "text-orange" : "text-orange/80")} aria-hidden>
                  ●
                </span>
              )}
              <span className={cn(active ? "text-white/60" : sidesWithArt.has(loc.id) ? "text-crimson" : "text-muted/50")}>
                {sidesWithArt.has(loc.id) ? "✓" : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {fade.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-full bg-gradient-to-r from-canvas to-transparent" />
      )}
      {fade.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full bg-gradient-to-l from-canvas to-transparent" />
      )}
    </div>
  );
}
