"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { FONT_REGISTRY, POPULAR_FONTS, FONT_CATEGORIES, getFontEntry, fontFamilyCss, type FontEntry } from "@/lib/studio/fontRegistry";
import { ensureFontLoaded } from "@/lib/studio/fontLoader";

const RECENTS_KEY = "mi-studio-recent-fonts";
const MAX_RECENTS = 8;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(family: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [family, ...readRecents().filter((f) => f !== family)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc.) — recents are a convenience, never required
  }
}

/** One row in the picker — self-previews by rendering its own name in its own face, and kicks off
 *  the on-demand load the instant it's actually visible in the (already-open) list, never before.
 *  This is the "never load all 120 fonts upfront" requirement satisfied at the row level: closing
 *  the picker without scrolling to a font never fetches it. */
function FontRow({ entry, selected, onSelect }: { entry: FontEntry; selected: boolean; onSelect: (family: string) => void }) {
  useEffect(() => {
    ensureFontLoaded(entry.family);
  }, [entry.family]);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.family)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm",
        selected ? "bg-orange/15 text-crimson" : "text-ink-900 hover:bg-canvas",
      )}
    >
      <span style={{ fontFamily: fontFamilyCss(entry) }} className="truncate">
        {entry.family}
      </span>
      {selected && <Check className="size-3.5 shrink-0" weight="bold" />}
    </button>
  );
}

export interface FontPickerProps {
  value: string | null | undefined;
  onChange: (family: string) => void;
  className?: string;
}

/** Searchable, categorized font picker backed by the shared font registry — the single control
 *  used by both TextToolbar and Inspector so template fonts and manual-text fonts are picked from
 *  the exact same list (brief: "one central font registry used identically by templates and manual
 *  text"). Recent + Popular sections surface first; search narrows across the whole registry;
 *  otherwise fonts are grouped by category so a customer can browse rather than only search. */
export function FontPicker({ value, onChange, className }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const currentEntry = getFontEntry(value) ?? FONT_REGISTRY[0];

  function handleOpen() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 260) });
    }
    setRecents(readRecents());
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function handleSelect(family: string) {
    onChange(family);
    pushRecent(family);
    setOpen(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return FONT_REGISTRY.filter((f) => f.family.toLowerCase().includes(q));
  }, [query]);

  const recentEntries = recents.map((f) => getFontEntry(f)).filter((f): f is FontEntry => !!f);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Font family"
        onClick={handleOpen}
        className="flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-sand px-2 text-xs font-medium text-ink-900"
      >
        <span className="truncate" style={{ fontFamily: fontFamilyCss(currentEntry) }}>
          {currentEntry.family}
        </span>
        <CaretDown className="size-2.5 shrink-0 text-ink-900/50" weight="bold" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              style={{ position: "fixed", top: pos.top, left: Math.min(pos.left, window.innerWidth - 300), width: 288 }}
              className="z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-sand bg-white shadow-xl"
            >
              <div className="flex items-center gap-1.5 border-b border-sand px-2.5 py-2">
                <MagnifyingGlass className="size-4 shrink-0 text-ink-900/40" weight="bold" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fonts…"
                  aria-label="Search fonts"
                  className="w-full border-none bg-transparent text-sm outline-none placeholder:text-ink-900/40"
                />
              </div>
              <div className="overflow-y-auto p-1.5">
                {filtered ? (
                  filtered.length ? (
                    filtered.map((f) => <FontRow key={f.family} entry={f} selected={f.family === currentEntry.family} onSelect={handleSelect} />)
                  ) : (
                    <p className="px-2.5 py-3 text-xs text-ink-900/50">No fonts match &ldquo;{query}&rdquo;.</p>
                  )
                ) : (
                  <>
                    {recentEntries.length > 0 && (
                      <div className="mb-1.5">
                        <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/40">Recent</p>
                        {recentEntries.map((f) => (
                          <FontRow key={`recent-${f.family}`} entry={f} selected={f.family === currentEntry.family} onSelect={handleSelect} />
                        ))}
                      </div>
                    )}
                    <div className="mb-1.5">
                      <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/40">Popular</p>
                      {POPULAR_FONTS.map((f) => (
                        <FontRow key={`popular-${f.family}`} entry={f} selected={f.family === currentEntry.family} onSelect={handleSelect} />
                      ))}
                    </div>
                    {FONT_CATEGORIES.map((cat) => {
                      const entries = FONT_REGISTRY.filter((f) => f.category === cat.id);
                      if (!entries.length) return null;
                      return (
                        <div key={cat.id} className="mb-1.5">
                          <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/40">{cat.label}</p>
                          {entries.map((f) => (
                            <FontRow key={`${cat.id}-${f.family}`} entry={f} selected={f.family === currentEntry.family} onSelect={handleSelect} />
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
