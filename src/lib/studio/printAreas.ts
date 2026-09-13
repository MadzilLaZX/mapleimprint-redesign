import type { DesignSideType } from "./types";

// MVP print-area template: one representative geometry per location, applied uniformly rather
// than per-product-per-size. This is a deliberate simplification, not a real registered
// print-area spec — a real one needs Maple's actual production measurements per garment/size,
// which isn't in the current supplier data. `PRINT_AREA_TEMPLATE_VERSION` is stored on every
// DesignProject specifically so if/when real per-product geometry replaces this, existing designs
// keep the geometry they were created under rather than silently shifting.
//
// STANDARD locations (front, back, left-chest, joggers' front) are real, physically plausible
// print positions coverable with the photography this site already has. Every other location in
// DesignSideType is REVIEW_REQUIRED (see productDecorationProfile.ts) — its geometry here is an
// approximate placement box, `confirmed: false`, used only to draw the generic Placement Preview
// illustration; it is never shown as, or treated as, a confirmed production spec.
export const PRINT_AREA_TEMPLATE_VERSION = "v3-family-aware-locations";

export const PRINT_AREAS: Record<DesignSideType, { widthIn: number; heightIn: number; safeMarginIn: number; confirmed: boolean }> = {
  front: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25, confirmed: true },
  back: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25, confirmed: true },
  // Industry-standard "left chest" logo area — small and fixed-size rather than scaled to the
  // garment, matching how chest-logo decoration is conventionally sized regardless of shirt size.
  "left-chest": { widthIn: 4, heightIn: 4, safeMarginIn: 0.15, confirmed: true },
  "right-chest": { widthIn: 4, heightIn: 4, safeMarginIn: 0.15, confirmed: false },
  "left-sleeve": { widthIn: 3, heightIn: 3, safeMarginIn: 0.15, confirmed: false },
  "right-sleeve": { widthIn: 3, heightIn: 3, safeMarginIn: 0.15, confirmed: false },
  "upper-back": { widthIn: 4, heightIn: 2, safeMarginIn: 0.15, confirmed: false },
  hood: { widthIn: 5, heightIn: 5, safeMarginIn: 0.2, confirmed: false },
  pocket: { widthIn: 3, heightIn: 3, safeMarginIn: 0.15, confirmed: false },
  "inside-neck": { widthIn: 2.5, heightIn: 1, safeMarginIn: 0.1, confirmed: false },
  "outside-neck": { widthIn: 2.5, heightIn: 1, safeMarginIn: 0.1, confirmed: false },
  "left-leg": { widthIn: 4, heightIn: 5, safeMarginIn: 0.2, confirmed: false },
  "right-leg": { widthIn: 4, heightIn: 5, safeMarginIn: 0.2, confirmed: false },
  "left-side": { widthIn: 3, heightIn: 1.5, safeMarginIn: 0.1, confirmed: false },
  "right-side": { widthIn: 3, heightIn: 1.5, safeMarginIn: 0.1, confirmed: false },
};

/** Where each location's print area sits over its garment product photo (or, for REVIEW_REQUIRED
 *  locations, the generic Placement Preview illustration — see placementPreview.ts), as a fraction
 *  of the image's own width/height. STANDARD boxes (front/back/left-chest/joggers-front) are
 *  calibrated against S&S's actual front-facing flat-lay photography. Every other box below is an
 *  approximate position on the generic silhouette, not a calibrated overlay on a real photo. */
export const MOCKUP_PRINT_AREA_BOX: Record<DesignSideType, { xFrac: number; yFrac: number; widthFrac: number; heightFrac: number }> = {
  front: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36 },
  back: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36 },
  "left-chest": { xFrac: 0.56, yFrac: 0.22, widthFrac: 0.14, heightFrac: 0.11 },
  "right-chest": { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.14, heightFrac: 0.11 },
  "left-sleeve": { xFrac: 0.14, yFrac: 0.3, widthFrac: 0.12, heightFrac: 0.12 },
  "right-sleeve": { xFrac: 0.74, yFrac: 0.3, widthFrac: 0.12, heightFrac: 0.12 },
  "upper-back": { xFrac: 0.38, yFrac: 0.18, widthFrac: 0.24, heightFrac: 0.08 },
  hood: { xFrac: 0.34, yFrac: 0.06, widthFrac: 0.32, heightFrac: 0.14 },
  pocket: { xFrac: 0.36, yFrac: 0.55, widthFrac: 0.28, heightFrac: 0.12 },
  "inside-neck": { xFrac: 0.4, yFrac: 0.16, widthFrac: 0.2, heightFrac: 0.05 },
  "outside-neck": { xFrac: 0.4, yFrac: 0.14, widthFrac: 0.2, heightFrac: 0.05 },
  // Joggers front reuses the "front" mockup view but the box sits low/centered on the thigh, not
  // chest-height — see productDecorationProfile.ts's note on why this isn't the tee's chest box.
  "left-leg": { xFrac: 0.28, yFrac: 0.42, widthFrac: 0.18, heightFrac: 0.22 },
  "right-leg": { xFrac: 0.54, yFrac: 0.42, widthFrac: 0.18, heightFrac: 0.22 },
  "left-side": { xFrac: 0.16, yFrac: 0.3, widthFrac: 0.18, heightFrac: 0.12 },
  "right-side": { xFrac: 0.66, yFrac: 0.3, widthFrac: 0.18, heightFrac: 0.12 },
};

/** The joggers family's one STANDARD location uses this lower-centered box instead of the tee
 *  chest box — same "front" mockup photo, anatomically different placement. */
export const JOGGERS_FRONT_BOX = { xFrac: 0.36, yFrac: 0.48, widthFrac: 0.28, heightFrac: 0.2 };

/** Which real garment photo (front or back) a location's mockup should composite onto. Every
 *  location without its own camera angle reuses whichever side it visually belongs to. */
export function mockupViewFor(location: DesignSideType): DesignSideType {
  const backLocations: DesignSideType[] = ["back", "upper-back", "hood"];
  return backLocations.includes(location) ? "back" : "front";
}

// Rare fallback — only used when a REVIEW_REQUIRED location's own mockupViewFor() resolves to a
// camera angle the product genuinely has no photo for at all (e.g. a colourway with no back shot).
// A plain neutral card, deliberately NOT styled to look like a specific garment, so it can never be
// mistaken for real product photography — the "Placement Preview" badge (CanvasStage) pairs with
// this, but even without it this shouldn't read as an actual photo.
const GENERIC_SILHOUETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="650">
  <rect width="520" height="650" fill="#F6F1E9"/>
  <rect x="40" y="40" width="440" height="570" rx="24" fill="none" stroke="#D8CFC0" stroke-width="2" stroke-dasharray="8 8"/>
  <text x="260" y="335" font-family="sans-serif" font-size="15" fill="#9C9284" text-anchor="middle">Photo not yet available for this placement</text>
</svg>`;
export const GENERIC_PLACEMENT_MOCKUP = `data:image/svg+xml,${encodeURIComponent(GENERIC_SILHOUETTE_SVG)}`;
