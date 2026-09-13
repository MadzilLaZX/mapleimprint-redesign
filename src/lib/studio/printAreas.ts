import type { DesignSideType } from "./types";
import type { LocationViewType } from "./productDecorationProfile";

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
export const PRINT_AREA_TEMPLATE_VERSION = "v4-rotated-sleeve-inner-neck-schematic";

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
  // Provisional placeholders, not a confirmed spec — the schematic view having visual room for a
  // bigger box doesn't mean a bigger physical print zone is actually approved (Section 17).
  "inside-neck": { widthIn: 2.5, heightIn: 1, safeMarginIn: 0.1, confirmed: false },
  "outside-neck": { widthIn: 2.5, heightIn: 1, safeMarginIn: 0.1, confirmed: false },
  "left-leg": { widthIn: 4, heightIn: 5, safeMarginIn: 0.2, confirmed: false },
  "right-leg": { widthIn: 4, heightIn: 5, safeMarginIn: 0.2, confirmed: false },
  "left-side": { widthIn: 3, heightIn: 1.5, safeMarginIn: 0.1, confirmed: false },
  "right-side": { widthIn: 3, heightIn: 1.5, safeMarginIn: 0.1, confirmed: false },
};

export interface PlacementGeometry {
  xFrac: number;
  yFrac: number;
  widthFrac: number;
  heightFrac: number;
  /** Degrees, Konva convention (positive = clockwise). Rotates the print area's local coordinate
   *  frame around its own center — every object inside stays in that LOCAL, unrotated frame (see
   *  CanvasStage's per-location Group), so this is purely a display/mockup transform. It is never
   *  baked into a DesignObject's own normalizedX/Y/rotation. Zero for every location except the
   *  two sleeves, where the garment itself isn't upright. */
  rotationDeg: number;
}

/** Where each location's print area sits over its garment product photo (or, for REVIEW_REQUIRED
 *  locations, the generic Placement Preview illustration/schematic — see backgroundKindFor()), as
 *  a fraction of the image's own width/height. STANDARD boxes (front/back/left-chest/joggers-
 *  front) are calibrated against S&S's actual front-facing flat-lay photography. Every other box
 *  below is an approximate position, not a calibrated overlay on a real photo.
 *
 *  Sleeve angles: "left-sleeve"/"right-sleeve" name which side of the ON-SCREEN photo the box sits
 *  on (screen-left / screen-right), the same convention the existing xFrac values already used —
 *  not the wearer's anatomical left/right, which would be reversed in a front-facing photo. A
 *  sleeve splays outward from the shoulder toward the cuff, so the two angles are mirrored
 *  opposites (screen-left tilts counter-clockwise, screen-right tilts clockwise), not copies of
 *  the same signed value — this is what Section 10 means by "do not mirror them incorrectly."
 *  These are placement-template data, not something rendered by rotating a border in CSS: the
 *  Konva Group representing each location's local coordinate space is the thing that actually
 *  rotates (see CanvasStage.tsx). */
export const PLACEMENT_GEOMETRY: Record<DesignSideType, PlacementGeometry> = {
  front: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36, rotationDeg: 0 },
  back: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36, rotationDeg: 0 },
  "left-chest": { xFrac: 0.56, yFrac: 0.22, widthFrac: 0.14, heightFrac: 0.11, rotationDeg: 0 },
  "right-chest": { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.14, heightFrac: 0.11, rotationDeg: 0 },
  "left-sleeve": { xFrac: 0.11, yFrac: 0.27, widthFrac: 0.15, heightFrac: 0.22, rotationDeg: -22 },
  "right-sleeve": { xFrac: 0.74, yFrac: 0.27, widthFrac: 0.15, heightFrac: 0.22, rotationDeg: 22 },
  "upper-back": { xFrac: 0.38, yFrac: 0.18, widthFrac: 0.24, heightFrac: 0.08, rotationDeg: 0 },
  hood: { xFrac: 0.34, yFrac: 0.06, widthFrac: 0.32, heightFrac: 0.14, rotationDeg: 0 },
  pocket: { xFrac: 0.36, yFrac: 0.55, widthFrac: 0.28, heightFrac: 0.12, rotationDeg: 0 },
  // Positioned within INNER_NECK_SCHEMATIC's own illustration space (see innerNeckSchematicSvg),
  // not over garment photography at all.
  "inside-neck": { xFrac: 0.36, yFrac: 0.48, widthFrac: 0.28, heightFrac: 0.22, rotationDeg: 0 },
  "outside-neck": { xFrac: 0.4, yFrac: 0.14, widthFrac: 0.2, heightFrac: 0.06, rotationDeg: 0 },
  // Joggers front reuses the "front" mockup view but the box sits low/centered on the thigh, not
  // chest-height — see productDecorationProfile.ts's note on why this isn't the tee's chest box.
  "left-leg": { xFrac: 0.28, yFrac: 0.42, widthFrac: 0.18, heightFrac: 0.22, rotationDeg: 0 },
  "right-leg": { xFrac: 0.54, yFrac: 0.42, widthFrac: 0.18, heightFrac: 0.22, rotationDeg: 0 },
  "left-side": { xFrac: 0.16, yFrac: 0.3, widthFrac: 0.18, heightFrac: 0.12, rotationDeg: 0 },
  "right-side": { xFrac: 0.66, yFrac: 0.3, widthFrac: 0.18, heightFrac: 0.12, rotationDeg: 0 },
};

/** @deprecated kept only as a type-compatible alias while any stale import lingers — use
 *  PLACEMENT_GEOMETRY, which carries rotationDeg. */
export const MOCKUP_PRINT_AREA_BOX = PLACEMENT_GEOMETRY;

/** The joggers family's one STANDARD location uses this lower-centered box instead of the tee
 *  chest box — same "front" mockup photo, anatomically different placement. */
export const JOGGERS_FRONT_BOX = { xFrac: 0.36, yFrac: 0.48, widthFrac: 0.28, heightFrac: 0.2 };

export type BackgroundKind = "front-photo" | "back-photo" | "inner-neck-schematic";

/** What kind of background a location's viewType calls for — this is what let Section 20's
 *  viewType enum replace the old hardcoded "is this front or back" special-casing. A schematic
 *  never depends on the product's own photography at all. */
export function backgroundKindFor(viewType: LocationViewType): BackgroundKind {
  switch (viewType) {
    case "PRODUCT_BACK":
    case "PRODUCT_BACK_PLACEMENT":
    case "HOOD_PLACEMENT":
    case "OUTER_NECK_PLACEMENT":
      return "back-photo";
    case "INNER_NECK_SCHEMATIC":
      return "inner-neck-schematic";
    default:
      return "front-photo";
  }
}

/** Back-compat wrapper for call sites that only know the DesignSideType, not its viewType —
 *  resolves the same way LOCATION_VIEW_TYPES + backgroundKindFor() would. Prefer the explicit
 *  viewType path in new code (CanvasStage, StudioClient); this exists for the few remaining
 *  call sites that pre-date Section 20 and haven't been threaded through yet. */
export function mockupViewFor(location: DesignSideType): DesignSideType {
  const backLocations: DesignSideType[] = ["back", "upper-back", "hood", "outside-neck"];
  return backLocations.includes(location) ? "back" : "front";
}

// Rare fallback — only used when a location's own background resolves to a camera angle the
// product genuinely has no photo for at all (e.g. a colourway with no back shot). A plain neutral
// card, deliberately NOT styled to look like a specific garment, so it can never be mistaken for
// real product photography — the "Placement Preview" badge (CanvasStage) pairs with this, but even
// without it this shouldn't read as an actual photo.
const GENERIC_SILHOUETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="650">
  <rect width="520" height="650" fill="#F6F1E9"/>
  <rect x="40" y="40" width="440" height="570" rx="24" fill="none" stroke="#D8CFC0" stroke-width="2" stroke-dasharray="8 8"/>
  <text x="260" y="335" font-family="sans-serif" font-size="15" fill="#9C9284" text-anchor="middle">Photo not yet available for this placement</text>
</svg>`;
export const GENERIC_PLACEMENT_MOCKUP = `data:image/svg+xml,${encodeURIComponent(GENERIC_SILHOUETTE_SVG)}`;

// A conservative, non-exhaustive list of colour-name substrings that read as "dark" — good enough
// to pick a legible fabric tone for the inner-neck schematic without needing to fabricate a real
// per-colour luminance value the supplier data doesn't provide. Ties go light, since a wrongly
// "light" schematic on a dark shirt is still perfectly legible; a wrongly "dark" one risks the
// dark-on-dark illegibility Section 16 explicitly warns against.
const DARK_COLOUR_HINTS = ["black", "navy", "charcoal", "dark", "forest", "maroon", "midnight", "graphite", "espresso", "jet", "purple", "burgundy"];

export function isDarkGarmentColour(colourName: string): boolean {
  const lower = colourName.toLowerCase();
  return DARK_COLOUR_HINTS.some((hint) => lower.includes(hint));
}

/** Dedicated interior-collar illustration for INNER_NECK_SCHEMATIC (Section 14) — an original
 *  Maple technical diagram, not a photo and not a copy of any reference image: collar seam, the
 *  garment's interior fabric, and the actual print/label zone, drawn plainly enough that "this is
 *  the inside of the collar" reads immediately. Two legibility variants (light/dark fabric) picked
 *  by isDarkGarmentColour() — see Section 16's "clarity over photorealism" instruction. The
 *  PLACEMENT_GEOMETRY box for "inside-neck" is positioned against THIS illustration's own layout,
 *  not against any garment photo. */
export function innerNeckSchematicSvg(colourName: string): string {
  const dark = isDarkGarmentColour(colourName);
  const fabric = dark ? "#2A2724" : "#F3EEE4";
  const fabricShade = dark ? "#38342F" : "#E9E2D3";
  const seam = dark ? "#6B6459" : "#B9AD98";
  const label = dark ? "#B9AD98" : "#8C816E";
  // No print-zone rectangle is drawn into the illustration itself — CanvasStage already overlays
  // the real dashed print-area box (from PLACEMENT_GEOMETRY["inside-neck"]) plus the "Placement
  // Preview" badge on top of every location's background, this one included. Drawing a second box
  // baked into the SVG would risk two slightly-misaligned rectangles competing for attention.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="650">
    <rect width="520" height="650" fill="${dark ? "#171412" : "#F6F1E9"}"/>
    <!-- Interior collar opening: a wide shallow arc, as if looking down inside the neckline -->
    <path d="M110 210 Q260 90 410 210 L410 260 Q260 150 110 260 Z" fill="${fabricShade}" stroke="${seam}" stroke-width="2"/>
    <!-- Collar seam line -->
    <path d="M110 260 Q260 150 410 260" fill="none" stroke="${seam}" stroke-width="2" stroke-dasharray="5 5"/>
    <!-- Main interior garment panel, hanging below the collar -->
    <rect x="90" y="255" width="340" height="330" rx="18" fill="${fabric}" stroke="${seam}" stroke-width="2"/>
    <text x="260" y="150" font-family="sans-serif" font-size="13" font-weight="600" letter-spacing="1.5" fill="${label}" text-anchor="middle">INSIDE COLLAR VIEW</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The one place that resolves "what background image does this location actually show" — every
 *  caller (StudioClient, PreviewMode, ReviewPanel) goes through this instead of re-deriving
 *  front/back/schematic logic itself, which is what let three call sites drift in earlier passes.
 *  Falls back to the generic "photo not available" card when the product genuinely has no photo
 *  for the required camera angle (e.g. a colourway with no back shot) — never a silently wrong one. */
export function backgroundUrlFor(
  viewType: LocationViewType,
  mockupImages: Partial<Record<DesignSideType, string>>,
  colourName: string,
  usesPlacementPreview: boolean,
): string | null {
  const kind = backgroundKindFor(viewType);
  if (kind === "inner-neck-schematic") return innerNeckSchematicSvg(colourName);
  const key: DesignSideType = kind === "back-photo" ? "back" : "front";
  return mockupImages[key] ?? (usesPlacementPreview ? GENERIC_PLACEMENT_MOCKUP : null);
}
