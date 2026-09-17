"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/** Right inspector, docked into the fixed-height Studio shell (never the document). On desktop
 *  it's a normal static side panel that fills the shell's height and scrolls its own content when
 *  it overflows. On mobile it's a togglable bottom sheet — always mounted (so state inside it,
 *  like scroll position, survives open/close) but visually `hidden` until `mobileOpen`, which
 *  StudioClient sets whenever something is selected or the customer taps the price pill. Kept
 *  separate from SecondaryPanel (the tool-rail's panel) because that one is mount-on-demand and
 *  left-docked; this one is always-mounted and right-docked — different enough lifecycles that
 *  sharing one component would mean threading a mode flag through both call sites for one bit of
 *  reuse. */
export function InspectorDock({
  mobileOpen,
  onCloseMobile,
  children,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  children: React.ReactNode;
}) {
  return (
    // The mobile bottom-sheet look (fixed position, 55vh cap, rounded top, shadow) must never
    // survive past the lg breakpoint — it previously had no `max-lg:` scoping at all, so the
    // instant something got selected (which sets `mobileOpen` unconditionally, at every viewport
    // width — see StudioClient's derived-state effect), `max-h-[55vh]` capped the DESKTOP panel's
    // height too. `lg:h-full` sets `height`, not `max-height`, so it never overrode that cap —
    // two different properties don't compete in the cascade, the tighter constraint just wins.
    // Root cause of the "right inspector only fills the top half of the screen" bug.
    <aside
      className={cn(
        "z-20 flex-col border-sand bg-white lg:static lg:z-auto lg:flex lg:h-full lg:w-72 lg:border-l lg:shadow-none",
        mobileOpen
          ? "flex max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:max-h-[55vh] max-lg:rounded-t-3xl max-lg:border max-lg:shadow-2xl"
          : "hidden lg:flex",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-sand px-4 py-3 lg:hidden">
        <p className="font-display text-sm font-semibold text-ink-900">Details</p>
        <button
          type="button"
          aria-label="Close details"
          onClick={onCloseMobile}
          className="rounded-full p-1.5 text-ink-900/60 transition-colors hover:bg-canvas hover:text-ink-900"
        >
          <X className="size-4" weight="bold" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
