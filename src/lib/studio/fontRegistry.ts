// Central font registry — the ONE source of truth for every font Studio can offer, replacing the
// old hardcoded 11-entry array that used to live inline in Inspector.tsx/TextToolbar.tsx. Both the
// font picker UI and the on-demand loader (fontLoader.ts) read from this file; templates reference
// these same `family` strings too (see templates.ts), so there is exactly one font system in the
// app, per the brief's "do not create separate font systems for templates and manual text."
//
// LICENSING: every `source: "google"` entry below is a real, currently-published Google Fonts
// family — Google Fonts' entire catalog is OFL/Apache-licensed and explicitly cleared for
// commercial use (including print-on-demand merchandise), so no separate license audit is needed
// per family the way it would be for a proprietary/commercial font marketplace. `source: "system"`
// entries are the pre-existing web-safe fonts (already in the app, zero network cost, always
// available — kept as-is for the fastest possible default and as a safe fallback family).
//
// Weight/italic lists are best-effort per family (matching each family's actual published static
// weights) — good enough for "only show weights that actually exist," not a byte-exact mirror of
// Google's variable-font axis metadata.

export type FontCategory =
  | "sans-serif"
  | "serif"
  | "display"
  | "condensed"
  | "script"
  | "handwriting"
  | "monospace"
  | "collegiate"
  | "elegant"
  | "bold";

export interface FontEntry {
  /** Exact Google Fonts family name (or a system font name) — used verbatim as the CSS
   *  font-family value (with a generic fallback appended by fontFamilyCss()) and as the Google
   *  Fonts CSS2 API `family` query param. */
  family: string;
  category: FontCategory;
  source: "google" | "system";
  /** Static weights this family actually publishes. */
  weights: number[];
  hasItalic: boolean;
  popular?: boolean;
}

const CATEGORY_FALLBACK: Record<FontCategory, string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  display: "sans-serif",
  condensed: "sans-serif",
  script: "cursive",
  handwriting: "cursive",
  monospace: "monospace",
  collegiate: "sans-serif",
  elegant: "serif",
  bold: "sans-serif",
};

export const FONT_REGISTRY: FontEntry[] = [
  // --- Brand / system (already loaded, zero network cost) ---
  { family: "Manrope", category: "sans-serif", source: "system", weights: [400, 500, 600, 700, 800], hasItalic: false, popular: true },
  { family: "Bricolage Grotesque", category: "sans-serif", source: "system", weights: [400, 500, 600, 700, 800], hasItalic: false, popular: true },
  { family: "Arial", category: "sans-serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Helvetica", category: "sans-serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Verdana", category: "sans-serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Trebuchet MS", category: "sans-serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Impact", category: "display", source: "system", weights: [400], hasItalic: false },
  { family: "Georgia", category: "serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Times New Roman", category: "serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Palatino", category: "serif", source: "system", weights: [400, 700], hasItalic: true },
  { family: "Courier New", category: "monospace", source: "system", weights: [400, 700], hasItalic: true },

  // --- Sans serif (Google) ---
  { family: "Inter", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true, popular: true },
  { family: "Roboto", category: "sans-serif", source: "google", weights: [300, 400, 500, 700, 900], hasItalic: true, popular: true },
  { family: "Open Sans", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Poppins", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800, 900], hasItalic: true, popular: true },
  { family: "Montserrat", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800, 900], hasItalic: true, popular: true },
  { family: "Lato", category: "sans-serif", source: "google", weights: [300, 400, 700, 900], hasItalic: true },
  { family: "Nunito Sans", category: "sans-serif", source: "google", weights: [400, 600, 700, 800, 900], hasItalic: true },
  { family: "DM Sans", category: "sans-serif", source: "google", weights: [400, 500, 700, 900], hasItalic: true },
  { family: "Work Sans", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800], hasItalic: true },
  { family: "Outfit", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800], hasItalic: false },
  { family: "Plus Jakarta Sans", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Urbanist", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
  { family: "Archivo", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
  { family: "Barlow", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800], hasItalic: true },
  { family: "PT Sans", category: "sans-serif", source: "google", weights: [400, 700], hasItalic: true },
  { family: "Noto Sans", category: "sans-serif", source: "google", weights: [400, 500, 600, 700], hasItalic: true },
  { family: "Source Sans 3", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 900], hasItalic: true },
  { family: "Rubik", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
  { family: "Karla", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Cabin", category: "sans-serif", source: "google", weights: [400, 500, 600, 700], hasItalic: true },
  { family: "Mulish", category: "sans-serif", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
  { family: "Quicksand", category: "sans-serif", source: "google", weights: [400, 500, 600, 700], hasItalic: false },
  { family: "Raleway", category: "sans-serif", source: "google", weights: [300, 400, 500, 600, 700, 800, 900], hasItalic: true },

  // --- Condensed ---
  { family: "Barlow Condensed", category: "condensed", source: "google", weights: [300, 400, 500, 600, 700], hasItalic: true },
  { family: "Roboto Condensed", category: "condensed", source: "google", weights: [300, 400, 700], hasItalic: true },
  { family: "Oswald", category: "condensed", source: "google", weights: [300, 400, 500, 600, 700], hasItalic: false, popular: true },
  { family: "Teko", category: "condensed", source: "google", weights: [300, 400, 500, 600, 700], hasItalic: false },
  { family: "Rajdhani", category: "condensed", source: "google", weights: [300, 400, 500, 600, 700], hasItalic: false },
  { family: "Saira Condensed", category: "condensed", source: "google", weights: [300, 400, 500, 600, 700, 800, 900], hasItalic: false },
  { family: "Fjalla One", category: "condensed", source: "google", weights: [400], hasItalic: false },

  // --- Display / bold / collegiate ---
  { family: "Bebas Neue", category: "display", source: "google", weights: [400], hasItalic: false, popular: true },
  { family: "Anton", category: "collegiate", source: "google", weights: [400], hasItalic: false, popular: true },
  { family: "League Spartan", category: "collegiate", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: false, popular: true },
  { family: "Archivo Black", category: "bold", source: "google", weights: [400], hasItalic: false },
  { family: "Black Ops One", category: "bold", source: "google", weights: [400], hasItalic: false },
  { family: "Alfa Slab One", category: "display", source: "google", weights: [400], hasItalic: false },
  { family: "Abril Fatface", category: "display", source: "google", weights: [400], hasItalic: false },
  { family: "Bungee", category: "display", source: "google", weights: [400], hasItalic: false },
  { family: "Bungee Shade", category: "display", source: "google", weights: [400], hasItalic: false },
  { family: "Righteous", category: "display", source: "google", weights: [400], hasItalic: false },
  { family: "Shrikhand", category: "display", source: "google", weights: [400], hasItalic: false },

  // --- Serif / editorial ---
  { family: "Playfair Display", category: "serif", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true, popular: true },
  { family: "DM Serif Display", category: "serif", source: "google", weights: [400], hasItalic: true, popular: true },
  { family: "Cormorant Garamond", category: "elegant", source: "google", weights: [300, 400, 500, 600, 700], hasItalic: true, popular: true },
  { family: "Libre Baskerville", category: "serif", source: "google", weights: [400, 700], hasItalic: true },
  { family: "Lora", category: "serif", source: "google", weights: [400, 500, 600, 700], hasItalic: true },
  { family: "Merriweather", category: "serif", source: "google", weights: [300, 400, 700, 900], hasItalic: true },
  { family: "Bitter", category: "serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Crimson Text", category: "serif", source: "google", weights: [400, 600, 700], hasItalic: true },
  { family: "EB Garamond", category: "elegant", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Bodoni Moda", category: "elegant", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
  { family: "Prata", category: "elegant", source: "google", weights: [400], hasItalic: false },
  { family: "Cinzel", category: "elegant", source: "google", weights: [400, 500, 600, 700, 800, 900], hasItalic: false, popular: true },
  { family: "Spectral", category: "serif", source: "google", weights: [300, 400, 500, 600, 700, 800], hasItalic: true },
  { family: "Newsreader", category: "serif", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "Noto Serif", category: "serif", source: "google", weights: [400, 500, 600, 700], hasItalic: true },
  { family: "Source Serif 4", category: "serif", source: "google", weights: [400, 500, 600, 700, 900], hasItalic: true },

  // --- Script / handwriting ---
  { family: "Lobster", category: "script", source: "google", weights: [400], hasItalic: false },
  { family: "Pacifico", category: "script", source: "google", weights: [400], hasItalic: false },
  { family: "Permanent Marker", category: "handwriting", source: "google", weights: [400], hasItalic: false },
  { family: "Caveat", category: "handwriting", source: "google", weights: [400, 500, 600, 700], hasItalic: false },
  { family: "Dancing Script", category: "script", source: "google", weights: [400, 500, 600, 700], hasItalic: false, popular: true },
  { family: "Sacramento", category: "script", source: "google", weights: [400], hasItalic: false },
  { family: "Great Vibes", category: "script", source: "google", weights: [400], hasItalic: false },

  // --- Monospace (rounding out the category the brief asked for but didn't list examples for) ---
  { family: "Space Mono", category: "monospace", source: "google", weights: [400, 700], hasItalic: true },
  { family: "JetBrains Mono", category: "monospace", source: "google", weights: [400, 500, 600, 700, 800], hasItalic: true },
  { family: "IBM Plex Mono", category: "monospace", source: "google", weights: [400, 500, 600, 700], hasItalic: true },
];

export const POPULAR_FONTS: FontEntry[] = FONT_REGISTRY.filter((f) => f.popular);

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "sans-serif", label: "Sans Serif" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "condensed", label: "Condensed" },
  { id: "collegiate", label: "Sport / Collegiate" },
  { id: "elegant", label: "Elegant" },
  { id: "bold", label: "Bold / Heavy" },
  { id: "script", label: "Script" },
  { id: "handwriting", label: "Handwriting" },
  { id: "monospace", label: "Monospace" },
];

const BY_FAMILY = new Map(FONT_REGISTRY.map((f) => [f.family, f]));

export function getFontEntry(family: string | null | undefined): FontEntry | null {
  if (!family) return null;
  // Accept either a bare family name ("Bebas Neue") or a full CSS font-family value
  // ("Bebas Neue, sans-serif") — templates/DesignObjectRecord historically stored the latter.
  const bare = family.split(",")[0].trim().replace(/^["']|["']$/g, "");
  return BY_FAMILY.get(bare) ?? null;
}

/** The canonical CSS font-family VALUE for a registry entry — always a real family name plus its
 *  own category's generic fallback, so a not-yet-loaded font still renders something reasonable
 *  instead of an entirely unstyled system default for a beat. */
export function fontFamilyCss(entry: FontEntry): string {
  return `"${entry.family}", ${CATEGORY_FALLBACK[entry.category]}`;
}

/** Back-compat helper for any DesignObjectRecord.fontFamily value, registered or not (an old
 *  saved design might reference a family that predates this registry, or a template's freeform
 *  string) — always returns a usable CSS value instead of throwing. */
export function normalizeFontFamilyCss(family: string | null | undefined): string {
  const entry = getFontEntry(family);
  if (entry) return fontFamilyCss(entry);
  return family && family.trim() ? family : "Manrope, sans-serif";
}
