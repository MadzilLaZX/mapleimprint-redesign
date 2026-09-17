// On-demand Google Fonts loader — the piece that makes a 100+-font registry safe performance-wise
// (brief: "DO NOT load 120 font families with every weight on initial Studio load"). Nothing here
// runs at page load; a font's stylesheet is only injected the moment something actually asks to
// render text in it (a customer picking it in the font picker, or a template that uses it being
// applied/rendered). Every result is cached so re-selecting a font, or opening ten templates that
// all use "Oswald," only ever pays the network/parse cost once per session.
"use client";

import { useEffect, useState } from "react";
import { getFontEntry, type FontEntry } from "./fontRegistry";

// family -> in-flight/settled load promise. Module-level (not React state) on purpose: many
// unrelated components (FontPicker rows, CanvasStage text nodes, template thumbnails) all need to
// ask "is this font ready yet" independently, and they should all share the exact same outcome
// rather than each re-triggering their own network request.
const loadCache = new Map<string, Promise<void>>();
const injectedLinks = new Set<string>();

function injectStylesheet(entry: FontEntry) {
  if (injectedLinks.has(entry.family)) return;
  injectedLinks.add(entry.family);
  const weightList = [...new Set(entry.weights)].sort((a, b) => a - b);
  const axisPairs = entry.hasItalic
    ? weightList.flatMap((w) => [`0,${w}`, `1,${w}`])
    : weightList.map((w) => `0,${w}`);
  const familyParam = `${entry.family.replace(/\s+/g, "+")}:ital,wght@${axisPairs.join(";")}`;
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Resolves once `family` is actually usable for canvas measurement/rendering — safe to call as
 *  often as you like (system fonts and already-loaded fonts resolve immediately). This is the
 *  function that prevents the exact bug the brief calls out: measuring/positioning curved-text
 *  glyphs (or any Konva.Text) against a temporary fallback face before the real font has finished
 *  loading, which would otherwise bake wrong widths into a design's saved geometry. */
export async function ensureFontLoaded(family: string | null | undefined): Promise<void> {
  const entry = getFontEntry(family);
  if (!entry) return; // unknown/freeform family — nothing to load, render with whatever the browser resolves
  if (entry.source === "system") return; // already available, zero cost

  const cached = loadCache.get(entry.family);
  if (cached) return cached;

  const promise = (async () => {
    injectStylesheet(entry);
    if (typeof document === "undefined" || !("fonts" in document)) return;
    try {
      // A representative weight/style load call per published variant — document.fonts.load only
      // guarantees the SPECIFIC weight/style you ask for, and templates/customers can pick any of
      // this family's real weights (see fontRegistry's `weights`), so request all of them rather
      // than just 400 normal.
      const loads: Promise<FontFace[]>[] = [];
      for (const w of entry.weights) {
        loads.push(document.fonts.load(`${w} 16px "${entry.family}"`));
        if (entry.hasItalic) loads.push(document.fonts.load(`italic ${w} 16px "${entry.family}"`));
      }
      await Promise.allSettled(loads);
      await document.fonts.ready;
    } catch {
      // A slow/blocked font host degrades to the category fallback via fontFamilyCss — never a
      // thrown error surfacing in the customer's editor.
    }
  })();

  loadCache.set(entry.family, promise);
  return promise;
}

/** True once `ensureFontLoaded(family)` has actually resolved — lets a component decide whether to
 *  render eagerly (system font) or wait a beat (a Google font mid-fetch on first use). */
export function isFontReadyNow(family: string | null | undefined): boolean {
  const entry = getFontEntry(family);
  if (!entry) return true;
  if (entry.source === "system") return true;
  return loadCache.has(entry.family) && !!(document.fonts && document.fonts.check(`${entry.weights[0]} 16px "${entry.family}"`));
}

/** Studio-wide hook: kicks off ensureFontLoaded for `family` and re-renders the calling component
 *  once it resolves. CanvasStage's text nodes (straight AND curved) use this so Konva never
 *  measures/positions glyphs against a temporary fallback face — the very first render after a
 *  customer switches font shows the OLD font for one frame (whatever was already ready), then
 *  re-renders with correct geometry the instant the real font finishes loading, exactly matching
 *  the brief's "await font ready, then force/recalculate text geometry." */
export function useFontReady(family: string | null | undefined): boolean {
  const [ready, setReady] = useState(() => isFontReadyNow(family));
  // Reset synchronously during render when `family` changes (React's documented pattern for
  // "adjusting state when a prop changes") rather than via a setState call inside the effect body
  // below, which would otherwise trigger an extra cascading render on every font switch.
  const [trackedFamily, setTrackedFamily] = useState(family);
  if (family !== trackedFamily) {
    setTrackedFamily(family);
    setReady(isFontReadyNow(family));
  }

  useEffect(() => {
    let cancelled = false;
    ensureFontLoaded(family).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [family]);

  return ready;
}
