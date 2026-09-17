// Maple Template system (Designs/Templates upgrade; product-family scoping added by the STUDIO V4
// brief). A GRAPHIC is one asset; a TEMPLATE is a whole editable composition (text + graphics +
// layout) built from the same normalized DesignObject model as a DesignProject. Applying a
// template deep-copies its objects (fresh ids) into the customer's active side — Studio never
// keeps a live reference back to the template, so editing a customer's design can never mutate
// (or be mutated by) the shared library.
//
// Every apparel object's normalizedX/Y/Width/Height are already fractions (0-1) of whichever
// print-area box is active when the template is applied (see StudioClient.applyTemplate +
// CanvasStage's boxFor()) — that's what makes a template automatically "fit" a left-chest box as
// sensibly as a full front box, with no per-print-area coordinate math needed here. Flat-print
// families (business card/flyer/poster) rely on the same mechanism against their own dedicated
// print-area boxes (see printAreas.ts) — see DesignTemplate's `orientation`/`productSubtypes`
// below for the extra compatibility dimensions those add.
//
// Every template here is a Maple-owned internal demo (shapes, typography, and the hand-built/
// curated marks in assetProviders.ts) — proof of the UX, not a final/complete library. No
// third-party, purchased, or scraped content is used anywhere here.

import type { DesignObjectRecord, DesignSideType, ShapeKind, TextAlign } from "./types";
import type { ProductFamily } from "./productDecorationProfile";
import { MapleAssetProvider, recolorMapleAsset } from "./assetProviders";

export type TemplateCategory =
  | "business"
  | "trades"
  | "food-cafe"
  | "sports"
  | "sports-teams"
  | "schools"
  | "events"
  | "birthday"
  | "family"
  | "clubs"
  | "fundraisers"
  | "canadian"
  | "automotive"
  | "streetwear"
  | "vintage"
  | "minimal"
  | "memorial"
  | "graduation"
  // Business card (Section "BUSINESS CARD TEMPLATE CATEGORIES")
  | "corporate"
  | "luxury"
  | "creative"
  | "contractor"
  | "real-estate"
  | "restaurant"
  | "beauty"
  | "photography"
  | "technology"
  | "qr-contact"
  | "social-media"
  | "appointment-card"
  // Flyer (Section "FLYER TEMPLATE CATEGORIES")
  | "grand-opening"
  | "sale"
  | "nightlife"
  | "church-community"
  | "service-business"
  | "qr-registration"
  | "qr-ticket"
  // Poster (Section "POSTER TEMPLATE CATEGORIES")
  | "concert"
  | "art"
  | "announcement"
  | "qr-cta";

export type TemplateObjectSeed = Omit<DesignObjectRecord, "id">;
export type ProductOrientation = "portrait" | "landscape" | "square";

/** STUDIO V4 brief's TemplateCompatibility, flattened directly onto DesignTemplate rather than
 *  nested — productFamilies/compatiblePrintAreas already existed here from the original template
 *  system; orientation/productSubtypes are the two new dimensions. `compatiblePrintAreas` is now
 *  typed as real DesignSideType (not just "front"|"back") specifically so a card template can
 *  declare `["card-front"]` and a flyer `["flyer-front"]` — this typing alone is what makes
 *  "Section TEMPLATE DIMENSION SAFETY" (a 3.5x2 card template can't load into a 12x16 tee print
 *  area) a compile-time-checked fact rather than a runtime hope. */
export interface DesignTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  thumbnailUrl: string;
  productFamilies: ProductFamily[];
  /** Optional finer filter within a family — none of the current templates need it, but
   *  templatesFor() already threads it through so a future template can opt in without another
   *  migration (Section "TEMPLATE SEARCH FILTERING" only requires family-level filtering today). */
  productSubtypes?: string[];
  /** Locations this composition targets. For apparel, advisory (the normalized coordinate system
   *  already makes a template render sensibly against any print area — see the file header) — a
   *  hint, not a hard gate. For the flat-print families (business card/flyer/poster), this IS the
   *  hard gate: it's typed as real DesignSideType, not just "front"|"back", specifically so a card
   *  template can declare `["card-front"]` and never structurally fit a 12x16in tee print area
   *  (Section "TEMPLATE DIMENSION SAFETY"). */
  compatiblePrintAreas: DesignSideType[];
  orientation?: ProductOrientation;
  objects: TemplateObjectSeed[];
  linkedAssetIds: string[];
  tags: string[];
  featured: boolean;
  licenseMetadata: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  /** Cross-cutting discovery grouping, independent of `category` — lets the Designs panel offer a
   *  "Creative" browse pill alongside the normal category pills without a template losing its real
   *  category (a colorful logo-style plumbing template is still filed under "trades", AND shows up
   *  under "Creative"). Undefined on every template from the original collection — added here
   *  purely additively, so nothing about an existing template's data changes by this field
   *  existing. See CREATIVE_SPECS below. */
  collection?: "creative" | "pro";
  /** Best-effort art-direction tag (Pro collection sets this on every template; older collections
   *  leave it undefined — purely additive, see this field's own intro above). Used by the Designs
   *  panel's optional style filter chips. */
  style?: "minimal" | "modern" | "bold" | "retro" | "luxury" | "streetwear" | "vintage" | "corporate" | "elegant" | "sport";
}

const IMAGE_DEFAULTS = { flipX: false, flipY: false, cropX: null, cropY: null, cropWidth: null, cropHeight: null } as const;
const QR_DEFAULTS = {
  qrDestination: null,
  qrErrorCorrection: null,
  qrForegroundColor: null,
  qrBackgroundColor: null,
  qrDotStyle: null,
  qrCornerStyle: null,
  qrLogoUrl: null,
  qrStylePreset: null,
  qrFrameStyle: null,
  qrLabelText: null,
  qrValidated: null,
} as const;

function textSeed(overrides: Partial<TemplateObjectSeed>): TemplateObjectSeed {
  return {
    ...IMAGE_DEFAULTS,
    ...QR_DEFAULTS,
    type: "text",
    assetUrl: null,
    content: "Text",
    fontFamily: "Manrope, sans-serif",
    fontSize: 32,
    fill: "#171412",
    normalizedX: 0.1,
    normalizedY: 0.4,
    normalizedWidth: 0.8,
    normalizedHeight: 0.15,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.1,
    curve: null,
    shapeKind: null,
    strokeColor: null,
    strokeWidth: null,
    ...overrides,
  };
}

function shapeSeed(overrides: Partial<TemplateObjectSeed>): TemplateObjectSeed {
  return {
    ...IMAGE_DEFAULTS,
    ...QR_DEFAULTS,
    type: "shape",
    assetUrl: null,
    content: null,
    fontFamily: null,
    fontSize: null,
    fill: "#171412",
    normalizedX: 0.2,
    normalizedY: 0.4,
    normalizedWidth: 0.6,
    normalizedHeight: 0.02,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: null,
    letterSpacing: null,
    lineHeight: null,
    curve: null,
    shapeKind: "rectangle",
    strokeColor: null,
    strokeWidth: null,
    ...overrides,
  };
}

function graphicSeed(assetId: string, overrides: Partial<TemplateObjectSeed>): TemplateObjectSeed {
  return {
    ...IMAGE_DEFAULTS,
    ...QR_DEFAULTS,
    type: "image",
    assetUrl: null, // resolved at apply-time via resolveTemplateAssets() — see below
    content: assetId, // carries the maple asset id until resolved; never persisted this way
    fontFamily: null,
    fontSize: null,
    fill: null,
    normalizedX: 0.35,
    normalizedY: 0.15,
    normalizedWidth: 0.3,
    normalizedHeight: 0.3,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: null,
    letterSpacing: null,
    lineHeight: null,
    curve: null,
    shapeKind: null,
    strokeColor: null,
    strokeWidth: null,
    ...overrides,
  };
}

const NOW = "2026-09-15T00:00:00.000Z";
const TEE_HOODIE: ProductFamily[] = ["tee", "hoodie"];

interface TemplateLine {
  text: string;
  y: number;
  size: number;
  bold?: boolean;
  italic?: boolean;
  ls?: number;
  fill?: string;
  font?: string;
  curve?: number;
  align?: TextAlign;
  /** Only read by cbuild() (the Creative-collection builder) — build() (the original collection)
   *  never reads these, so adding them here is purely additive and changes nothing about how any
   *  existing template line lays out. */
  x?: number;
  width?: number;
  rotation?: number;
  /** Only read by pbuild() (the Pro-collection builder) — build()/cbuild() never read these, so
   *  adding them here is purely additive and changes nothing about any existing line's layout. */
  textTransform?: "none" | "uppercase" | "lowercase" | "title";
  effectType?: "none" | "shadow" | "lift" | "glow" | "background" | "hollow";
  strokeColor?: string;
  strokeWidth?: number;
}

interface TemplateGraphic {
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
}

interface TemplateSpec {
  id: string;
  name: string;
  category: TemplateCategory;
  tags: string[];
  productFamilies?: ProductFamily[];
  compatiblePrintAreas?: DesignSideType[];
  graphic?: TemplateGraphic;
  divider?: { y: number; w?: number; fill?: string };
  lines: TemplateLine[];
  featured?: boolean;
}

const DISPLAY_FONT = "Bricolage Grotesque, sans-serif";
const BODY_FONT = "Manrope, sans-serif";

function build(spec: TemplateSpec): DesignTemplate {
  const objects: TemplateObjectSeed[] = [];
  if (spec.graphic) {
    objects.push(
      graphicSeed(`maple-${spec.graphic.assetId}`, {
        normalizedX: spec.graphic.x,
        normalizedY: spec.graphic.y,
        normalizedWidth: spec.graphic.w,
        normalizedHeight: spec.graphic.h,
        fill: spec.graphic.fill ?? "#171412",
      }),
    );
  }
  for (const line of spec.lines) {
    objects.push(
      textSeed({
        content: line.text,
        fontSize: line.size,
        fontFamily: line.font ?? BODY_FONT,
        // QA pass fix: these two were previously never read here (only cbuild(), the Creative-
        // collection builder, honoured them) — every original-collection line silently fell back
        // to textSeed's own defaults (x:0.1, width:0.8) regardless of what was authored on the
        // spec, which is exactly what let several original templates' headings overflow their box
        // and word-wrap. Additive and safe: every original line that never set x/width keeps
        // getting the same 0.1/0.8 defaults as before (`line.x`/`line.width` are `undefined` for
        // them), so this only changes output for lines that now explicitly specify one.
        normalizedX: line.x ?? 0.1,
        normalizedY: line.y,
        normalizedWidth: line.width ?? 0.8,
        bold: line.bold ?? false,
        italic: line.italic ?? false,
        letterSpacing: line.ls ?? 0,
        fill: line.fill ?? "#171412",
        curve: line.curve ?? null,
        align: line.align ?? "center",
      }),
    );
  }
  if (spec.divider) {
    objects.push(
      shapeSeed({
        normalizedX: (1 - (spec.divider.w ?? 0.4)) / 2,
        normalizedY: spec.divider.y,
        normalizedWidth: spec.divider.w ?? 0.4,
        normalizedHeight: 0.012,
        fill: spec.divider.fill ?? "#D41414",
      }),
    );
  }
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    thumbnailUrl: "",
    productFamilies: spec.productFamilies ?? TEE_HOODIE,
    compatiblePrintAreas: spec.compatiblePrintAreas ?? ["front", "back", "left-chest"],
    tags: spec.tags,
    linkedAssetIds: spec.graphic ? [`maple-${spec.graphic.assetId}`] : [],
    featured: spec.featured ?? false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects,
  };
}

const SPECS: TemplateSpec[] = [
  // ---------------------------------------------------------------- BUSINESS / STAFF
  {
    id: "business-modern-company",
    name: "Modern Company",
    category: "business",
    tags: ["business", "company", "staff", "uniform", "professional", "modern"],
    graphic: { assetId: "banner-ribbon", x: 0.3, y: 0.1, w: 0.4, h: 0.14 },
    lines: [
      { text: "YOUR COMPANY", y: 0.34, size: 22, bold: true, font: DISPLAY_FONT, ls: 0.9 , x: 0.01, width: 0.98 },
      { text: "PROFESSIONAL SERVICES", y: 0.479, size: 13, ls: 2, fill: "#5b5348" , x: 0.01, width: 0.98 },
    ],
    featured: true,
  },
  {
    id: "business-professional-staff",
    name: "Professional Staff",
    category: "business",
    tags: ["business", "staff", "team", "uniform", "professional"],
    graphic: { assetId: "briefcase", x: 0.38, y: 0.1, w: 0.24, h: 0.24 },
    lines: [
      { text: "TEAM", y: 0.4, size: 30, bold: true, font: DISPLAY_FONT, ls: 3 },
      { text: "SINCE 2015", y: 0.558, size: 12, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "business-minimal-corporate",
    name: "Minimal Corporate",
    category: "business",
    tags: ["business", "minimal", "corporate", "clean", "logo"],
    lines: [{ text: "YOUR BRAND", y: 0.42, size: 24, bold: true, font: DISPLAY_FONT, ls: 4, x: 0.01, width: 0.98 }],
  },
  {
    id: "business-established-badge",
    name: "Established Badge",
    category: "business",
    tags: ["business", "badge", "established", "local"],
    graphic: { assetId: "shield", x: 0.38, y: 0.08, w: 0.24, h: 0.26, fill: "#171412" },
    lines: [
      { text: "EST. 2010", y: 0.38, size: 16, bold: true },
      { text: "QUALITY WORK GUARANTEED", y: 0.472, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "business-local-favourite",
    name: "Local Business",
    category: "business",
    tags: ["business", "local", "community", "shop"],
    graphic: { assetId: "maple-leaf", x: 0.4, y: 0.09, w: 0.2, h: 0.2, fill: "#D41414" },
    lines: [
      { text: "PROUDLY LOCAL", y: 0.34, size: 20, bold: true, font: DISPLAY_FONT },
      { text: "OTTAWA, ON", y: 0.451, size: 12, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "business-service-team",
    name: "Service Team",
    category: "business",
    tags: ["business", "service", "staff", "team"],
    graphic: { assetId: "handshake", x: 0.32, y: 0.09, w: 0.36, h: 0.24 },
    lines: [
      { text: "SERVICE TEAM", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 , x: 0.053, width: 0.894 },
    ],
  },

  // ---------------------------------------------------------------- TRADES
  {
    id: "trades-plumbing",
    name: "Plumbing Co.",
    category: "trades",
    tags: ["plumber", "plumbing", "trades", "business", "service"],
    graphic: { assetId: "wrench-gear", x: 0.36, y: 0.08, w: 0.28, h: 0.28 },
    lines: [
      { text: "NORTHRIDGE", y: 0.4, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "PLUMBING & HEATING", y: 0.53, size: 13, ls: 1, fill: "#5b5348" },
      { text: "EST. 2008", y: 0.608, size: 10, ls: 2, fill: "#5b5348" },
    ],
    featured: true,
  },
  {
    id: "trades-electrical",
    name: "Electrical",
    category: "trades",
    tags: ["electrician", "electrical", "trades", "power"],
    graphic: { assetId: "lightning", x: 0.4, y: 0.08, w: 0.2, h: 0.24, fill: "#171412" },
    lines: [
      { text: "SPARK ELECTRIC", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT , x: 0.029, width: 0.942 },
      { text: "LICENSED · INSURED", y: 0.501, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "trades-construction",
    name: "Construction",
    category: "trades",
    tags: ["construction", "trades", "builder", "crew"],
    graphic: { assetId: "hammer", x: 0.36, y: 0.09, w: 0.28, h: 0.26 },
    lines: [
      { text: "BUILD CREW", y: 0.4, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "GENERAL CONTRACTING", y: 0.53, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "trades-landscaping",
    name: "Landscaping",
    category: "trades",
    tags: ["landscaping", "trades", "lawn", "garden"],
    graphic: { assetId: "mountain", x: 0.34, y: 0.09, w: 0.32, h: 0.2 },
    lines: [
      { text: "GREEN ACRES", y: 0.36, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "LANDSCAPING CO.", y: 0.481, size: 12, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "trades-hvac",
    name: "HVAC",
    category: "trades",
    tags: ["hvac", "trades", "heating", "cooling"],
    graphic: { assetId: "fan-hvac", x: 0.37, y: 0.08, w: 0.26, h: 0.26 },
    lines: [
      { text: "COMFORT AIR", y: 0.4, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "HEATING · COOLING", y: 0.521, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "trades-roofing",
    name: "Roofing",
    category: "trades",
    tags: ["roofing", "trades", "roof", "construction"],
    graphic: { assetId: "roof-house", x: 0.36, y: 0.09, w: 0.28, h: 0.24 },
    lines: [
      { text: "SUMMIT ROOFING", y: 0.39, size: 20, bold: true, font: DISPLAY_FONT , x: 0.04, width: 0.92 },
      { text: "RESIDENTIAL · COMMERCIAL", y: 0.501, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "trades-auto-repair",
    name: "Auto Repair",
    category: "trades",
    tags: ["auto repair", "mechanic", "trades", "garage", "automotive"],
    graphic: { assetId: "car-silhouette", x: 0.28, y: 0.14, w: 0.44, h: 0.2 },
    lines: [
      { text: "PRECISION AUTO", y: 0.4, size: 20, bold: true, font: DISPLAY_FONT },
      { text: "REPAIR & SERVICE", y: 0.511, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },

  // ---------------------------------------------------------------- RESTAURANT / CAFÉ
  {
    id: "cafe-modern",
    name: "Modern Café",
    category: "food-cafe",
    tags: ["cafe", "coffee", "restaurant", "modern"],
    graphic: { assetId: "coffee-cup", x: 0.4, y: 0.08, w: 0.2, h: 0.2 },
    lines: [
      { text: "MAPLE CAFÉ", y: 0.32, size: 24, bold: true, font: DISPLAY_FONT },
      { text: "COFFEE · PASTRIES · COMMUNITY", y: 0.45, size: 10, ls: 1, fill: "#5b5348" , x: 0.029, width: 0.941 },
    ],
    featured: true,
  },
  {
    id: "cafe-vintage-coffee",
    name: "Vintage Coffee",
    category: "food-cafe",
    tags: ["coffee", "cafe", "vintage", "roastery"],
    graphic: { assetId: "coffee-bean", x: 0.4, y: 0.08, w: 0.2, h: 0.22 },
    lines: [
      { text: "DAILY GRIND", y: 0.35, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "ROASTED FRESH SINCE 1998", y: 0.471, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "cafe-restaurant-staff",
    name: "Restaurant Staff",
    category: "food-cafe",
    tags: ["restaurant", "staff", "kitchen", "crew"],
    lines: [
      { text: "KITCHEN CREW", y: 0.38, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 , x: 0.01, width: 0.98 },
      { text: "FRONT OF HOUSE", y: 0.51, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "cafe-bakery",
    name: "Bakery",
    category: "food-cafe",
    tags: ["bakery", "pastries", "food", "cafe"],
    graphic: { assetId: "croissant", x: 0.34, y: 0.1, w: 0.32, h: 0.18 },
    lines: [
      { text: "THE BAKERY", y: 0.35, size: 24, bold: true, font: DISPLAY_FONT },
      { text: "FRESH BAKED DAILY", y: 0.48, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "cafe-pizza-shop",
    name: "Pizza Shop",
    category: "food-cafe",
    tags: ["pizza", "restaurant", "food"],
    graphic: { assetId: "pizza-slice", x: 0.38, y: 0.08, w: 0.24, h: 0.22 },
    lines: [
      { text: "TONY'S PIZZA", y: 0.36, size: 22, bold: true, italic: true, font: DISPLAY_FONT },
      { text: "WOOD FIRED SINCE 1985", y: 0.481, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "cafe-food-truck",
    name: "Food Truck",
    category: "food-cafe",
    tags: ["food truck", "restaurant", "food", "street food"],
    graphic: { assetId: "food-truck", x: 0.28, y: 0.12, w: 0.44, h: 0.2 },
    lines: [
      { text: "STREET EATS", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 },
    ],
  },

  // ---------------------------------------------------------------- SPORTS
  {
    id: "sports-basketball",
    name: "Basketball",
    category: "sports",
    tags: ["basketball", "sports", "team", "league"],
    graphic: { assetId: "basketball", x: 0.38, y: 0.08, w: 0.24, h: 0.24, fill: "#171412" },
    lines: [
      { text: "TIGERS", y: 0.38, size: 30, bold: true, font: DISPLAY_FONT, ls: 2 },
      { text: "BASKETBALL", y: 0.538, size: 13, ls: 3, fill: "#5b5348" },
      { text: "2026", y: 0.616, size: 11, ls: 2, fill: "#5b5348" },
    ],
    featured: true,
  },
  {
    // My earlier "tpl-canada-maple" literal (which fixed a real maple-leaf asset-id bug) is
    // dropped here in favour of this collection's own "canada-maple" spec entry further down —
    // build() already prefixes every spec's graphic.assetId with "maple-" automatically, so this
    // collection never had that bug to begin with.
    id: "sports-soccer",
    name: "Soccer",
    category: "sports",
    tags: ["soccer", "football", "sports", "team", "league"],
    graphic: { assetId: "soccer-ball", x: 0.38, y: 0.08, w: 0.24, h: 0.24, fill: "#171412" },
    lines: [
      { text: "UNITED FC", y: 0.38, size: 26, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "SOCCER CLUB", y: 0.519, size: 12, ls: 3, fill: "#5b5348" },
    ],
  },
  {
    id: "sports-hockey",
    name: "Hockey",
    category: "sports",
    tags: ["hockey", "sports", "team", "league"],
    graphic: { assetId: "hockey-stick", x: 0.38, y: 0.08, w: 0.24, h: 0.24, fill: "#171412" },
    lines: [
      { text: "ICE WOLVES", y: 0.38, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "HOCKEY CLUB", y: 0.51, size: 12, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "sports-baseball",
    name: "Baseball",
    category: "sports",
    tags: ["baseball", "sports", "team", "league"],
    graphic: { assetId: "baseball", x: 0.4, y: 0.08, w: 0.2, h: 0.2, fill: "#171412" },
    lines: [
      { text: "RIVER CATS", y: 0.34, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "BASEBALL", y: 0.47, size: 12, ls: 3, fill: "#5b5348" },
    ],
  },
  {
    id: "sports-volleyball",
    name: "Volleyball",
    category: "sports",
    tags: ["volleyball", "sports", "team", "league"],
    graphic: { assetId: "volleyball", x: 0.4, y: 0.08, w: 0.2, h: 0.2, fill: "#171412" },
    lines: [
      { text: "SPIKE SQUAD", y: 0.34, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "VOLLEYBALL", y: 0.461, size: 12, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "sports-team-staff",
    name: "Team Staff",
    category: "sports",
    tags: ["team", "staff", "sports", "crew"],
    graphic: { assetId: "shield", x: 0.4, y: 0.09, w: 0.2, h: 0.22 },
    lines: [
      { text: "TEAM STAFF", y: 0.38, size: 20, bold: true, font: DISPLAY_FONT, ls: 2 },
    ],
  },
  {
    id: "sports-coach",
    name: "Coach",
    category: "sports",
    tags: ["coach", "sports", "team", "staff"],
    graphic: { assetId: "whistle", x: 0.36, y: 0.09, w: 0.28, h: 0.22 },
    lines: [{ text: "COACH", y: 0.38, size: 26, bold: true, font: DISPLAY_FONT, ls: 3 }],
  },

  // ---------------------------------------------------------------- SCHOOLS / GRADUATION
  {
    id: "school-spirit",
    name: "School Spirit",
    category: "schools",
    tags: ["school", "spirit", "club", "student"],
    graphic: { assetId: "book-open", x: 0.36, y: 0.09, w: 0.28, h: 0.2 },
    lines: [
      { text: "LINCOLN HIGH", y: 0.36, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "SCHOOL SPIRIT", y: 0.481, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "graduation-class-of",
    name: "Class Of",
    category: "graduation",
    tags: ["graduation", "grad", "class of", "school"],
    graphic: { assetId: "graduation-hat-2", x: 0.36, y: 0.08, w: 0.28, h: 0.2 },
    lines: [{ text: "CLASS OF 2026", y: 0.34, size: 22, bold: true, font: DISPLAY_FONT }],
    featured: true,
  },
  {
    id: "graduation-grad-badge",
    name: "Graduation Badge",
    category: "graduation",
    tags: ["graduation", "grad", "badge", "school"],
    graphic: { assetId: "laurel", x: 0.28, y: 0.08, w: 0.44, h: 0.34, fill: "#171412" },
    lines: [
      { text: "GRAD", y: 0.24, size: 16, bold: true },
      { text: "2026", y: 0.332, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "school-student-council",
    name: "Student Council",
    category: "schools",
    tags: ["school", "student council", "club"],
    lines: [
      { text: "STUDENT COUNCIL", y: 0.38, size: 20, bold: true, font: DISPLAY_FONT, ls: 1 , x: 0.01, width: 0.98 },
      { text: "LEAD · SERVE · INSPIRE", y: 0.491, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "school-club",
    name: "School Club",
    category: "schools",
    tags: ["school", "club", "student"],
    graphic: { assetId: "club-badge", x: 0.38, y: 0.08, w: 0.24, h: 0.26, fill: "#171412" },
    lines: [{ text: "CHESS CLUB", y: 0.4, size: 20, bold: true, font: DISPLAY_FONT }],
  },
  {
    id: "school-varsity",
    name: "Varsity",
    category: "schools",
    tags: ["school", "varsity", "sports", "team"],
    lines: [
      { text: "VARSITY", y: 0.36, size: 30, bold: true, font: DISPLAY_FONT, ls: 3 },
      { text: "EST. 1990", y: 0.518, size: 12, ls: 1, fill: "#5b5348" },
    ],
  },

  // ---------------------------------------------------------------- EVENTS / BIRTHDAY / FAMILY / CLUBS / FUNDRAISERS
  {
    id: "birthday-crew",
    name: "Birthday Crew",
    category: "birthday",
    tags: ["birthday", "party", "crew", "celebration"],
    graphic: { assetId: "heart", x: 0.4, y: 0.09, w: 0.2, h: 0.2, fill: "#D41414" },
    lines: [
      { text: "SARAH'S", y: 0.34, size: 22, bold: true, font: DISPLAY_FONT },
      { text: "BIRTHDAY CREW", y: 0.461, size: 16, bold: true, ls: 1 },
    ],
    featured: true,
  },
  {
    id: "birthday-balloon-bash",
    name: "Balloon Bash",
    category: "birthday",
    tags: ["birthday", "party", "balloons", "celebration"],
    graphic: { assetId: "balloon", x: 0.36, y: 0.08, w: 0.28, h: 0.26 },
    lines: [{ text: "PARTY CREW", y: 0.4, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 }],
  },
  {
    id: "birthday-milestone",
    name: "Milestone Birthday",
    category: "birthday",
    tags: ["birthday", "milestone", "party"],
    lines: [
      { text: "30 & FABULOUS", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT , x: 0.054, width: 0.891 },
      { text: "THE BIRTHDAY CREW", y: 0.501, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "event-staff",
    name: "Event Staff",
    category: "events",
    tags: ["event", "staff", "crew"],
    lines: [
      { text: "EVENT STAFF", y: 0.36, size: 25, bold: true, font: DISPLAY_FONT, ls: 2.5 , x: 0.01, width: 0.98 },
      { text: "2026", y: 0.518, size: 14, fill: "#5b5348" },
    ],
    divider: { y: 0.46, w: 0.4 },
  },
  {
    id: "event-volunteer-team",
    name: "Volunteer Team",
    category: "events",
    tags: ["volunteer", "event", "team", "community"],
    graphic: { assetId: "fundraiser-heart-hands", x: 0.36, y: 0.08, w: 0.28, h: 0.24 },
    lines: [{ text: "VOLUNTEER TEAM", y: 0.38, size: 19, bold: true, font: DISPLAY_FONT, ls: 1, x: 0.01, width: 0.98 }],
  },
  {
    id: "event-festival-staff",
    name: "Festival Staff",
    category: "events",
    tags: ["festival", "event", "staff", "crew"],
    graphic: { assetId: "confetti", x: 0.38, y: 0.08, w: 0.24, h: 0.24, fill: "#D41414" },
    lines: [{ text: "FESTIVAL STAFF", y: 0.39, size: 20, bold: true, font: DISPLAY_FONT, ls: 1, x: 0.01, width: 0.98 }],
  },
  {
    id: "event-bachelor-party",
    name: "Bachelor Party",
    category: "events",
    tags: ["bachelor party", "wedding", "event", "crew"],
    lines: [
      { text: "GROOM'S CREW", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 , x: 0.023, width: 0.954 },
      { text: "ONE LAST RIDE", y: 0.501, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "event-bachelorette-party",
    name: "Bachelorette Party",
    category: "events",
    tags: ["bachelorette party", "wedding", "event", "crew"],
    graphic: { assetId: "heart", x: 0.42, y: 0.09, w: 0.16, h: 0.16, fill: "#D41414" },
    lines: [
      { text: "BRIDE'S CREW", y: 0.32, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "SAYING I DO 2026", y: 0.441, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "event-wedding-crew",
    name: "Wedding Crew",
    category: "events",
    tags: ["wedding", "event", "crew", "family"],
    lines: [
      { text: "THE WEDDING CREW", y: 0.4, size: 18, bold: true, font: DISPLAY_FONT, ls: 0.9 , x: 0.01, width: 0.98 },
    ],
  },
  {
    id: "family-reunion",
    name: "Family Reunion",
    category: "family",
    tags: ["family", "reunion", "group", "crew"],
    graphic: { assetId: "family-group", x: 0.36, y: 0.08, w: 0.28, h: 0.26 },
    lines: [
      { text: "THE JOHNSON FAMILY", y: 0.38, size: 18, bold: true, font: DISPLAY_FONT , x: 0.01, width: 0.98 },
      { text: "FAMILY REUNION 2026", y: 0.482, size: 10, ls: 1, fill: "#5b5348" },
    ],
    featured: true,
  },
  {
    id: "family-crew",
    name: "Family Crew",
    category: "family",
    tags: ["family", "crew", "group"],
    lines: [
      { text: "FAMILY CREW", y: 0.4, size: 26, bold: true, font: DISPLAY_FONT, ls: 2 , x: 0.01, width: 0.98 },
    ],
  },
  {
    id: "club-badge-classic",
    name: "Club Badge",
    category: "clubs",
    tags: ["club", "society", "badge", "members"],
    graphic: { assetId: "club-badge", x: 0.36, y: 0.06, w: 0.28, h: 0.3, fill: "#171412" },
    lines: [{ text: "MEMBER", y: 0.28, size: 12, bold: true, fill: "#F6F1E9" }],
  },
  {
    id: "club-est",
    name: "Established Club",
    category: "clubs",
    tags: ["club", "society", "established"],
    lines: [
      { text: "THE CLUB", y: 0.36, size: 26, bold: true, font: DISPLAY_FONT, ls: 2 },
      { text: "EST. 2016", y: 0.499, size: 12, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "fundraiser-community",
    name: "Community Fundraiser",
    category: "fundraisers",
    tags: ["fundraiser", "charity", "community", "volunteer"],
    graphic: { assetId: "fundraiser-heart-hands", x: 0.36, y: 0.08, w: 0.28, h: 0.24, fill: "#D41414" },
    lines: [
      { text: "TOGETHER WE RISE", y: 0.38, size: 18, bold: true, font: DISPLAY_FONT , x: 0.054, width: 0.892 },
      { text: "COMMUNITY FUNDRAISER", y: 0.482, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "fundraiser-charity-walk",
    name: "Charity Walk",
    category: "fundraisers",
    tags: ["fundraiser", "charity", "walk", "run", "community"],
    lines: [
      { text: "CHARITY WALK", y: 0.38, size: 22, bold: true, font: DISPLAY_FONT, ls: 1 , x: 0.046, width: 0.907 },
      { text: "2026", y: 0.501, size: 13, fill: "#5b5348" },
    ],
  },

  // ---------------------------------------------------------------- CANADIAN
  {
    id: "canada-maple",
    name: "Canada / Maple",
    category: "canadian",
    tags: ["canada", "maple", "canadian", "proud"],
    graphic: { assetId: "maple-leaf", x: 0.36, y: 0.1, w: 0.28, h: 0.28, fill: "#D41414" },
    lines: [{ text: "CANADA", y: 0.42, size: 24, bold: true, font: DISPLAY_FONT, ls: 3 }],
    featured: true,
  },
  {
    id: "canada-ottawa",
    name: "Ottawa",
    category: "canadian",
    tags: ["ottawa", "canada", "canadian", "local"],
    graphic: { assetId: "maple-flag", x: 0.3, y: 0.09, w: 0.4, h: 0.22 },
    lines: [{ text: "OTTAWA", y: 0.36, size: 22, bold: true, font: DISPLAY_FONT, ls: 3 }],
  },
  {
    id: "canada-pride",
    name: "Canadian Pride",
    category: "canadian",
    tags: ["canada", "canadian pride", "canadian"],
    lines: [
      { text: "TRUE NORTH", y: 0.38, size: 24, bold: true, font: DISPLAY_FONT, ls: 2 },
      { text: "STRONG & FREE", y: 0.51, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "canada-local-community",
    name: "Local Community",
    category: "canadian",
    tags: ["canada", "community", "local", "canadian"],
    graphic: { assetId: "maple-leaf", x: 0.42, y: 0.09, w: 0.16, h: 0.16, fill: "#171412" },
    lines: [{ text: "COMMUNITY STRONG", y: 0.36, size: 16, bold: true, font: DISPLAY_FONT, ls: 1, x: 0.01, width: 0.98 }],
  },

  // ---------------------------------------------------------------- AUTOMOTIVE
  {
    id: "automotive-garage",
    name: "Garage",
    category: "automotive",
    tags: ["automotive", "garage", "trades", "cars"],
    graphic: { assetId: "wrench-gear", x: 0.36, y: 0.08, w: 0.28, h: 0.28 },
    lines: [
      { text: "THE GARAGE", y: 0.4, size: 24, bold: true, font: DISPLAY_FONT, ls: 1 },
      { text: "PARTS · SERVICE · REPAIR", y: 0.53, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "automotive-motorsport",
    name: "Motorsport",
    category: "automotive",
    tags: ["automotive", "motorsport", "racing", "cars"],
    graphic: { assetId: "checkered-flag", x: 0.4, y: 0.08, w: 0.2, h: 0.24 },
    lines: [{ text: "RACE TEAM", y: 0.38, size: 22, bold: true, italic: true, font: DISPLAY_FONT, ls: 1 }],
  },
  {
    id: "automotive-detailing",
    name: "Detailing",
    category: "automotive",
    tags: ["automotive", "detailing", "cars", "car wash"],
    graphic: { assetId: "car-silhouette", x: 0.28, y: 0.1, w: 0.44, h: 0.2 },
    lines: [
      { text: "SHINE DETAILING", y: 0.36, size: 18, bold: true, font: DISPLAY_FONT },
      { text: "MOBILE AUTO CARE", y: 0.462, size: 10, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "automotive-car-club",
    name: "Car Club",
    category: "automotive",
    tags: ["automotive", "car club", "cars", "enthusiast"],
    graphic: { assetId: "car-silhouette", x: 0.28, y: 0.1, w: 0.44, h: 0.2 },
    lines: [{ text: "CAR CLUB", y: 0.36, size: 26, bold: true, font: DISPLAY_FONT, ls: 2 }],
  },

  // ---------------------------------------------------------------- STREETWEAR / VINTAGE / MINIMAL
  {
    id: "streetwear-oversized",
    name: "Oversized Typography",
    category: "streetwear",
    tags: ["streetwear", "urban", "bold", "oversized"],
    lines: [{ text: "BOLD", y: 0.32, size: 64, bold: true, font: DISPLAY_FONT, ls: -1 }],
  },
  {
    id: "streetwear-minimal-logo",
    name: "Streetwear Minimal Logo",
    category: "streetwear",
    tags: ["streetwear", "minimal", "logo", "urban"],
    graphic: { assetId: "star-burst", x: 0.42, y: 0.32, w: 0.16, h: 0.16 },
    lines: [],
  },
  {
    id: "streetwear-gothic",
    name: "Gothic",
    category: "streetwear",
    tags: ["streetwear", "gothic", "urban", "bold"],
    lines: [{ text: "RUIN", y: 0.36, size: 48, bold: true, italic: true, font: DISPLAY_FONT, ls: 2 }],
  },
  {
    id: "streetwear-urban-crown",
    name: "Urban Crown",
    category: "streetwear",
    tags: ["streetwear", "urban", "crown", "bold"],
    graphic: { assetId: "crown", x: 0.38, y: 0.1, w: 0.24, h: 0.24 },
    lines: [{ text: "ROYALTY", y: 0.4, size: 32, bold: true, italic: true, font: DISPLAY_FONT, ls: 2 }],
    featured: true,
  },
  {
    id: "streetwear-flame",
    name: "Flame",
    category: "streetwear",
    tags: ["streetwear", "urban", "flame", "bold"],
    graphic: { assetId: "flame", x: 0.4, y: 0.08, w: 0.2, h: 0.24, fill: "#D41414" },
    lines: [{ text: "HEAT", y: 0.4, size: 40, bold: true, font: DISPLAY_FONT, ls: 1 }],
  },
  {
    id: "vintage-club",
    name: "Vintage Club",
    category: "vintage",
    tags: ["vintage", "retro", "badge", "club"],
    graphic: { assetId: "laurel", x: 0.25, y: 0.08, w: 0.5, h: 0.4, fill: "#5b5348" },
    lines: [
      { text: "EST. 1998", y: 0.26, size: 20, bold: true },
      { text: "SINCE THE START", y: 0.371, size: 11, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "vintage-badge",
    name: "Vintage Badge",
    category: "vintage",
    tags: ["vintage", "retro", "badge"],
    graphic: { assetId: "compass", x: 0.38, y: 0.08, w: 0.24, h: 0.24 },
    lines: [{ text: "TIMELESS", y: 0.4, size: 20, bold: true, font: DISPLAY_FONT, ls: 2 }],
  },
  {
    id: "minimal-logo",
    name: "Minimal Logo",
    category: "minimal",
    tags: ["minimal", "simple", "logo"],
    graphic: { assetId: "star-burst", x: 0.42, y: 0.32, w: 0.16, h: 0.16 },
    lines: [],
  },
  {
    id: "minimal-wordmark",
    name: "Minimal Wordmark",
    category: "minimal",
    tags: ["minimal", "simple", "wordmark", "clean"],
    lines: [{ text: "simple.", y: 0.4, size: 30, bold: false, font: DISPLAY_FONT }],
  },
  {
    id: "minimal-line",
    name: "Minimal Line Mark",
    category: "minimal",
    tags: ["minimal", "simple", "clean"],
    lines: [{ text: "LESS IS MORE", y: 0.4, size: 16, bold: true, ls: 3 }],
    divider: { y: 0.36, w: 0.3 },
  },

  // ---------------------------------------------------------------- MEMORIAL
  {
    id: "memorial-in-loving-memory",
    name: "In Loving Memory",
    category: "memorial",
    tags: ["memorial", "in memory", "remembrance"],
    graphic: { assetId: "wings", x: 0.28, y: 0.08, w: 0.44, h: 0.2 },
    lines: [
      { text: "IN LOVING MEMORY", y: 0.34, size: 18, bold: true, font: DISPLAY_FONT , x: 0.044, width: 0.913 },
      { text: "FOREVER IN OUR HEARTS", y: 0.442, size: 11, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "memorial-forever-remembered",
    name: "Forever Remembered",
    category: "memorial",
    tags: ["memorial", "in memory", "remembrance", "family"],
    lines: [
      { text: "FOREVER REMEMBERED", y: 0.4, size: 15, bold: true, font: DISPLAY_FONT, ls: 0.9 , x: 0.01, width: 0.98 },
    ],
    divider: { y: 0.47, w: 0.3 },
  },
];

// ===========================================================================================
// CREATIVE COLLECTION — additive expansion, built by a SEPARATE builder (cbuild, below) so the
// original collection's `build()`/`SPECS` above are never touched or re-used in a way that could
// change their output. Every template here still ultimately produces the exact same
// `TemplateObjectSeed[]` shape as the original collection (text/image/shape seeds via the same
// textSeed/shapeSeed/graphicSeed helpers above) — it's a richer AUTHORING format (multiple
// graphics + shapes per template, palettes, rotation), not a second rendering/editor system.
// ===========================================================================================

/** Reusable named palettes (design brief's own swatches, plus a couple more) — every Creative
 *  template below picks one, so the collection reads as a coherent catalog instead of random
 *  per-template colors. `a` = primary/dominant, `b` = secondary/accent, `c` = light/cream ink. */
const PALETTES = {
  navyOrange: { a: "#0E2A47", b: "#F28C28", c: "#F7F2E8" },
  forestCream: { a: "#214E34", b: "#F3E9D2", c: "#C97A40" },
  burgundyGold: { a: "#741C2F", b: "#D4A94F", c: "#F5EFE6" },
  royalBlue: { a: "#174EA6", b: "#FFFFFF", c: "#62A7FF" },
  retroSunset: { a: "#D5532F", b: "#F4B942", c: "#7B2D26" },
  tealNavy: { a: "#17A2A4", b: "#102A43", c: "#F4F1E8" },
  purpleGold: { a: "#552583", b: "#FDB927", c: "#FFFFFF" },
  redCream: { a: "#C72C41", b: "#F5E9DA", c: "#222222" },
  yellowCharcoal: { a: "#F5C518", b: "#252525", c: "#FFFFFF" },
  terracottaCream: { a: "#C96A4A", b: "#F5E7D3", c: "#31493C" },
  mintForest: { a: "#9ED9B7", b: "#164A35", c: "#F7F3E8" },
  pinkRed: { a: "#F58CA8", b: "#C8203F", c: "#FFF5F5" },
  blackGold: { a: "#161616", b: "#D5A848", c: "#F5F0E6" },
  cyanNavy: { a: "#25C4E8", b: "#10233F", c: "#FFFFFF" },
  // --- Added for the Pro collection (pbuild/PRO_SPECS below) — same curated-swatch pattern, named
  // for real hex craftsmanship rather than raw/random color picks. Additive only. ---
  charcoalIce: { a: "#1C1C1E", b: "#E8ECEF", c: "#8A9199" },
  oxbloodCream: { a: "#5C1A1B", b: "#EFE3D0", c: "#2B2B2B" },
  sagestoneClay: { a: "#7C8B6F", b: "#E7DCC8", c: "#B5643A" },
  duneRust: { a: "#D8C3A0", b: "#8B3A2A", c: "#2E2A25" },
  graphiteLime: { a: "#232526", b: "#C6FF3D", c: "#F2F2F2" },
  inkSaffron: { a: "#14100D", b: "#E8A93B", c: "#F4EFE4" },
  plumBlush: { a: "#402138", b: "#F3C6D0", c: "#F8ECE9" },
  slateSteel: { a: "#2E3A46", b: "#9FB3C2", c: "#F1F3F4" },
  espressoCream: { a: "#2B1B14", b: "#EBD9BE", c: "#B5794A" },
  oliveTan: { a: "#4B5320", b: "#D8C9A3", c: "#8A6E4B" },
  cobaltChalk: { a: "#0B3D91", b: "#F2EFE9", c: "#7FB2E5" },
  mossGold: { a: "#33422E", b: "#C9A24B", c: "#F1EEE1" },
  denimWhite: { a: "#2C3E56", b: "#FFFFFF", c: "#A7B7C9" },
  sandstoneInk: { a: "#C9B79C", b: "#1B1B1B", c: "#F5EFE3" },
  crimsonInk: { a: "#8B1E2B", b: "#141414", c: "#F2EDE4" },
  deepJuniper: { a: "#0E3B2E", b: "#D8C79A", c: "#F4F1E6" },
  glacierGraphite: { a: "#3A4750", b: "#EAF2F2", c: "#93B8B8" },
} as const;

interface CreativeGraphic {
  /** Bare Maple asset id (matches MAPLE_GRAPHICS[].id in assetProviders.ts — no "maple-" prefix). */
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  rotation?: number;
  opacity?: number;
}

interface CreativeShape {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  shapeKind?: ShapeKind;
  strokeColor?: string;
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
}

interface CreativeSpec {
  id: string;
  name: string;
  category: TemplateCategory;
  tags: string[];
  productFamilies?: ProductFamily[];
  compatiblePrintAreas?: DesignSideType[];
  /** Bottom of the stack — badge circles, ribbon/banner rectangles, ring outlines. */
  shapes?: CreativeShape[];
  /** Middle of the stack — icons, rendered pre-colored (see cbuild) so the actual applied design
   *  (and its thumbnail) shows the intended palette color, not the library's default black. */
  graphics?: CreativeGraphic[];
  /** Top of the stack — wordmark/tagline text. */
  lines: TemplateLine[];
  featured?: boolean;
}

/** Builder for the Creative collection. Produces the exact same object shape as build() above
 *  (TemplateObjectSeed via textSeed/shapeSeed/graphicSeed) — the difference is only in what this
 *  function accepts as input (multiple shapes/graphics, palette colors, rotation) and that a
 *  graphic's `assetUrl` is pre-resolved to its PALETTE color right here via recolorMapleAsset()
 *  instead of being resolved later at apply-time to the library's default color. Because assetUrl
 *  is set directly (with `content: null`), resolveTemplateAssets()'s existing
 *  `if (o.type !== "image" || !o.content) return o` guard already skips these objects unchanged —
 *  no change to resolveTemplateAssets, and zero effect on the original collection's graphics
 *  (which still go through the old content-based lazy-resolve path exactly as before). */
function cbuild(spec: CreativeSpec): DesignTemplate {
  const objects: TemplateObjectSeed[] = [];

  for (const s of spec.shapes ?? []) {
    objects.push(
      shapeSeed({
        shapeKind: s.shapeKind ?? "rectangle",
        normalizedX: s.x,
        normalizedY: s.y,
        normalizedWidth: s.w,
        normalizedHeight: s.h,
        fill: s.fill,
        strokeColor: s.strokeColor ?? null,
        strokeWidth: s.strokeWidth ?? null,
        rotation: s.rotation ?? 0,
        opacity: s.opacity ?? 1,
      }),
    );
  }

  for (const g of spec.graphics ?? []) {
    const seed = graphicSeed(`maple-${g.assetId}`, {
      normalizedX: g.x,
      normalizedY: g.y,
      normalizedWidth: g.w,
      normalizedHeight: g.h,
      fill: g.fill,
      rotation: g.rotation ?? 0,
      opacity: g.opacity ?? 1,
    });
    objects.push({
      ...seed,
      // Pre-colored at definition time (see this function's own doc comment above) — bypasses the
      // lazy content->assetUrl resolution the original collection still uses.
      assetUrl: recolorMapleAsset(g.assetId, g.fill),
      content: null,
    });
  }

  for (const line of spec.lines) {
    objects.push(
      textSeed({
        content: line.text,
        fontSize: line.size,
        fontFamily: line.font ?? BODY_FONT,
        normalizedX: line.x ?? 0.1,
        normalizedY: line.y,
        normalizedWidth: line.width ?? 0.8,
        rotation: line.rotation ?? 0,
        bold: line.bold ?? false,
        italic: line.italic ?? false,
        letterSpacing: line.ls ?? 0,
        fill: line.fill ?? "#171412",
        curve: line.curve ?? null,
        align: line.align ?? "center",
      }),
    );
  }

  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    thumbnailUrl: "",
    productFamilies: spec.productFamilies ?? TEE_HOODIE,
    compatiblePrintAreas: spec.compatiblePrintAreas ?? ["front", "back", "left-chest"],
    tags: [...spec.tags, "creative"],
    linkedAssetIds: (spec.graphics ?? []).map((g) => `maple-${g.assetId}`),
    featured: spec.featured ?? false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects,
    collection: "creative",
  };
}

const CREATIVE_SPECS: CreativeSpec[] = [
  // ---------------------------------------------------------------- BUSINESS / STAFF (9)
  {
    id: "creative-business-heritage-co",
    name: "Heritage & Co.",
    category: "business",
    tags: ["business", "company", "staff", "professional", "logo", "monogram", "badge"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.navyOrange.a }],
    graphics: [{ assetId: "briefcase", x: 0.37, y: 0.15, w: 0.26, h: 0.26, fill: PALETTES.navyOrange.b }],
    lines: [
      { text: "HERITAGE & CO.", y: 0.46, size: 20, bold: true, font: DISPLAY_FONT, fill: PALETTES.navyOrange.c, x: 0.06, width: 0.88 },
      { text: "ESTABLISHED SERVICES", y: 0.571, size: 10, ls: 2, fill: PALETTES.navyOrange.b, x: 0.06, width: 0.88 },
    ],
    featured: true,
  },
  {
    id: "creative-business-corner-shop",
    name: "The Corner Shop",
    category: "business",
    tags: ["business", "local", "shop", "logo", "badge", "professional"],
    graphics: [
      { assetId: "shield", x: 0.24, y: 0.06, w: 0.52, h: 0.5, fill: PALETTES.burgundyGold.a },
      { assetId: "star-burst", x: 0.42, y: 0.1, w: 0.16, h: 0.16, fill: PALETTES.burgundyGold.b },
    ],
    lines: [
      { text: "THE CORNER", y: 0.32, size: 17, bold: true, font: DISPLAY_FONT, fill: PALETTES.burgundyGold.b, x: 0.06, width: 0.88 },
      { text: "SHOP", y: 0.417, size: 22, bold: true, font: DISPLAY_FONT, fill: PALETTES.burgundyGold.c, x: 0.06, width: 0.88 },
      { text: "LOCALLY OWNED", y: 0.538, size: 10, ls: 2, fill: PALETTES.burgundyGold.c, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-business-premium-staff",
    name: "Premium Staff",
    category: "business",
    tags: ["business", "staff", "uniform", "premium", "creative", "logo"],
    shapes: [{ x: 0.05, y: 0.32, w: 0.9, h: 0.15, fill: PALETTES.blackGold.b, rotation: -4 }],
    graphics: [{ assetId: "monogram-frame", x: 0.36, y: 0.08, w: 0.28, h: 0.28, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "PREMIUM STAFF", y: 0.355, size: 18, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.a, ls: 1 },
      { text: "SINCE 2015", y: 0.52, size: 11, ls: 2, fill: PALETTES.blackGold.b },
    ],
  },
  {
    id: "creative-business-family-owned",
    name: "Family Owned Co.",
    category: "business",
    tags: ["business", "family", "local", "logo", "badge", "staff"],
    shapes: [{ x: 0.22, y: 0.07, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.terracottaCream.a }],
    graphics: [{ assetId: "family-group", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.terracottaCream.b }],
    lines: [
      { text: "FAMILY OWNED", y: 0.44, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, curve: 30, x: 0.06, width: 0.88 },
      { text: "CO. · EST. 2012", y: 0.611, size: 10, ls: 1, fill: PALETTES.terracottaCream.b, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-business-established-co",
    name: "Established Company",
    category: "business",
    tags: ["business", "established", "logo", "professional", "badge"],
    graphics: [
      { assetId: "shield", x: 0.26, y: 0.06, w: 0.48, h: 0.46, fill: PALETTES.tealNavy.a },
      { assetId: "star-burst", x: 0.6, y: 0.06, w: 0.14, h: 0.14, fill: PALETTES.tealNavy.b, rotation: 12 },
    ],
    shapes: [{ x: 0.28, y: 0.5, w: 0.44, h: 0.012, fill: PALETTES.tealNavy.a }],
    lines: [
      { text: "ESTABLISHED", y: 0.34, size: 15, bold: true, fill: PALETTES.tealNavy.c, x: 0.06, width: 0.88 },
      { text: "COMPANY", y: 0.428, size: 21, bold: true, font: DISPLAY_FONT, fill: PALETTES.tealNavy.a, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-business-monogram",
    name: "Professional Monogram",
    category: "business",
    tags: ["business", "monogram", "minimal", "elegant", "professional"],
    shapes: [{ x: 0.3, y: 0.14, w: 0.4, h: 0.4, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.royalBlue.a, strokeWidth: 3 }],
    lines: [
      { text: "M", y: 0.24, size: 48, bold: true, font: DISPLAY_FONT, fill: PALETTES.royalBlue.a, x: 0.3, width: 0.4 },
      { text: "PROFESSIONAL SERVICES", y: 0.58, size: 10, ls: 2, fill: PALETTES.royalBlue.a, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-business-service-co",
    name: "Service Company",
    category: "business",
    tags: ["business", "service", "logo", "staff", "professional"],
    shapes: [{ x: 0.02, y: 0.3, w: 0.55, h: 0.13, fill: PALETTES.yellowCharcoal.b, rotation: -3 }],
    graphics: [{ assetId: "wrench-gear", x: 0.06, y: 0.1, w: 0.2, h: 0.2, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "SERVICE CO.", y: 0.32, size: 17, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a, align: "left", x: 0.06, width: 0.6 },
      { text: "QUALITY YOU CAN TRUST", y: 0.46, size: 10, ls: 1, fill: PALETTES.yellowCharcoal.b, align: "left", x: 0.06, width: 0.7 },
    ],
  },
  {
    id: "creative-business-corporate-crew",
    name: "Modern Corporate Crew",
    category: "business",
    tags: ["business", "corporate", "staff", "bold", "creative"],
    shapes: [{ x: -0.05, y: 0.3, w: 1.1, h: 0.16, fill: PALETTES.cyanNavy.b, rotation: -8 }],
    lines: [
      { text: "CORPORATE", y: 0.24, size: 30, bold: true, font: DISPLAY_FONT, fill: PALETTES.cyanNavy.b, ls: -1 , x: 0.055, width: 0.89 },
      { text: "CREW", y: 0.44, size: 24, bold: true, font: DISPLAY_FONT, fill: PALETTES.cyanNavy.a, ls: 2 },
    ],
  },
  {
    id: "creative-business-modern-agency",
    name: "Modern Agency",
    category: "business",
    tags: ["business", "agency", "minimal", "clean", "modern", "logo"],
    shapes: [{ x: 0.06, y: 0.36, w: 0.16, h: 0.16, fill: PALETTES.navyOrange.b }],
    lines: [
      { text: "STUDIO", y: 0.28, size: 24, bold: true, font: DISPLAY_FONT, fill: PALETTES.navyOrange.a, align: "left", x: 0.28, width: 0.66 },
      { text: "CREATIVE AGENCY", y: 0.41, size: 10, ls: 3, fill: PALETTES.navyOrange.a, align: "left", x: 0.28, width: 0.66 },
    ],
  },

  // ---------------------------------------------------------------- TRADES (8)
  {
    id: "creative-trades-northridge-plumbing",
    name: "Northridge Plumbing",
    category: "trades",
    tags: ["plumber", "plumbing", "trades", "business", "service", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.24, y: 0.06, w: 0.52, h: 0.5, fill: PALETTES.navyOrange.a },
      { assetId: "wrench-gear", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.navyOrange.b },
    ],
    lines: [
      { text: "NORTHRIDGE", y: 0.4, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.navyOrange.c, curve: -28, x: 0.06, width: 0.88 },
      { text: "PLUMBING & HEATING", y: 0.581, size: 10, ls: 1, fill: PALETTES.navyOrange.c, x: 0.06, width: 0.88 },
      { text: "EST. 2008", y: 0.651, size: 8, ls: 2, fill: PALETTES.navyOrange.b, x: 0.06, width: 0.88 },
    ],
    featured: true,
  },
  {
    id: "creative-trades-volt-electric",
    name: "Volt Electric",
    category: "trades",
    tags: ["electrician", "electrical", "trades", "power", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.06, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.yellowCharcoal.b }],
    graphics: [{ assetId: "lightning", x: 0.4, y: 0.14, w: 0.2, h: 0.3, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "VOLT ELECTRIC", y: 0.46, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a, x: 0.06, width: 0.88 },
      { text: "LICENSED & INSURED", y: 0.56, size: 9, ls: 1, fill: PALETTES.yellowCharcoal.c },
    ],
  },
  {
    id: "creative-trades-ironwork-construction",
    name: "Ironwork Construction",
    category: "trades",
    tags: ["construction", "trades", "builder", "crew", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.blackGold.a },
      { assetId: "hammer", x: 0.39, y: 0.14, w: 0.22, h: 0.22, fill: PALETTES.blackGold.b },
    ],
    shapes: [{ x: 0.3, y: 0.53, w: 0.4, h: 0.012, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "IRONWORK", y: 0.38, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.b, x: 0.06, width: 0.88 },
      { text: "CONSTRUCTION", y: 0.468, size: 12, bold: true, fill: PALETTES.blackGold.c, x: 0.06, width: 0.88 },
      { text: "BUILT TO LAST", y: 0.568, size: 9, ls: 2, fill: PALETTES.blackGold.b, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-trades-evergreen-landscaping",
    name: "Evergreen Landscaping",
    category: "trades",
    tags: ["landscaping", "trades", "lawn", "garden", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.06, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.forestCream.a }],
    graphics: [{ assetId: "pine-tree", x: 0.4, y: 0.13, w: 0.2, h: 0.28, fill: PALETTES.forestCream.b }],
    lines: [
      { text: "EVERGREEN", y: 0.46, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.forestCream.b, curve: 26, x: 0.06, width: 0.88 },
      { text: "LANDSCAPING CO.", y: 0.631, size: 9, ls: 1, fill: PALETTES.forestCream.c },
    ],
  },
  {
    id: "creative-trades-comfort-zone-hvac",
    name: "Comfort Zone HVAC",
    category: "trades",
    tags: ["hvac", "trades", "heating", "cooling", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.26, y: 0.06, w: 0.48, h: 0.46, fill: PALETTES.tealNavy.a },
      { assetId: "fan-hvac", x: 0.39, y: 0.15, w: 0.22, h: 0.22, fill: PALETTES.tealNavy.c },
    ],
    lines: [
      { text: "COMFORT ZONE", y: 0.36, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.tealNavy.c, x: 0.06, width: 0.88 },
      { text: "HEATING · COOLING", y: 0.46, size: 9, ls: 1, fill: PALETTES.tealNavy.c, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-trades-summit-roofing",
    name: "Summit Roofing Crew",
    category: "trades",
    tags: ["roofing", "trades", "roof", "construction", "crew", "logo", "creative"],
    shapes: [{ x: 0.02, y: 0.32, w: 0.6, h: 0.13, fill: PALETTES.terracottaCream.a, rotation: -5 }],
    graphics: [{ assetId: "roof-house", x: 0.06, y: 0.11, w: 0.22, h: 0.2, fill: PALETTES.terracottaCream.a }],
    lines: [
      { text: "SUMMIT ROOFING", y: 0.34, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, align: "left", x: 0.34, width: 0.6 },
      { text: "CREW", y: 0.44, size: 10, ls: 2, fill: PALETTES.terracottaCream.c, align: "left", x: 0.34, width: 0.6 },
    ],
  },
  {
    id: "creative-trades-bluecollar-contracting",
    name: "Bluecollar General Contracting",
    category: "trades",
    tags: ["construction", "contracting", "trades", "logo", "creative", "business"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.royalBlue.a }],
    graphics: [{ assetId: "crossed-tools", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.royalBlue.b }],
    lines: [
      { text: "BLUECOLLAR", y: 0.46, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.royalBlue.b, x: 0.06, width: 0.88 },
      { text: "GENERAL CONTRACTING", y: 0.56, size: 8, ls: 1, fill: PALETTES.royalBlue.c },
    ],
  },
  {
    id: "creative-trades-workshop-handyman",
    name: "The Workshop Handyman",
    category: "trades",
    tags: ["handyman", "trades", "workshop", "repair", "logo", "creative"],
    graphics: [{ assetId: "gear", x: 0.4, y: 0.07, w: 0.2, h: 0.2, fill: PALETTES.purpleGold.b }],
    shapes: [{ x: 0.32, y: 0.44, w: 0.36, h: 0.01, fill: PALETTES.purpleGold.b }],
    lines: [
      { text: "THE WORKSHOP", y: 0.3, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.purpleGold.a },
      { text: "HANDYMAN SERVICES", y: 0.47, size: 9, ls: 2, fill: PALETTES.purpleGold.a },
    ],
  },

  // ---------------------------------------------------------------- CAFÉ / RESTAURANT (7)
  {
    id: "creative-cafe-maple-cafe",
    name: "Maple Café",
    category: "food-cafe",
    tags: ["coffee", "cafe", "café", "restaurant", "food", "staff", "business", "local", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.05, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.forestCream.a }],
    graphics: [{ assetId: "coffee-cup", x: 0.38, y: 0.15, w: 0.24, h: 0.24, fill: PALETTES.forestCream.b }],
    lines: [
      { text: "MAPLE", y: 0.42, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.forestCream.b, x: 0.06, width: 0.88 },
      { text: "CAFÉ", y: 0.512, size: 20, bold: true, font: DISPLAY_FONT, fill: PALETTES.forestCream.c, x: 0.06, width: 0.88 },
      { text: "OTTAWA · ONTARIO", y: 0.623, size: 8, ls: 1, fill: PALETTES.forestCream.b },
    ],
    featured: true,
  },
  {
    id: "creative-cafe-old-town-coffee-house",
    name: "Old Town Coffee House",
    category: "food-cafe",
    tags: ["coffee", "cafe", "vintage", "roastery", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.retroSunset.a }],
    graphics: [
      { assetId: "coffee-bean", x: 0.4, y: 0.15, w: 0.2, h: 0.24, fill: PALETTES.retroSunset.b },
      { assetId: "star-burst", x: 0.24, y: 0.44, w: 0.1, h: 0.1, fill: PALETTES.retroSunset.b, rotation: -10 },
      { assetId: "star-burst", x: 0.66, y: 0.44, w: 0.1, h: 0.1, fill: PALETTES.retroSunset.b, rotation: 10 },
    ],
    lines: [
      { text: "OLD TOWN", y: 0.42, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.retroSunset.b, curve: 24, x: 0.06, width: 0.88 },
      { text: "COFFEE HOUSE", y: 0.57, size: 10, ls: 1, fill: PALETTES.retroSunset.b },
    ],
  },
  {
    id: "creative-cafe-local-bakery",
    name: "The Local Bakery",
    category: "food-cafe",
    tags: ["bakery", "pastries", "food", "cafe", "wheat", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.05, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.terracottaCream.a }],
    graphics: [{ assetId: "wheat", x: 0.4, y: 0.13, w: 0.2, h: 0.3, fill: PALETTES.terracottaCream.b }],
    lines: [
      { text: "THE LOCAL", y: 0.42, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, x: 0.06, width: 0.88 },
      { text: "BAKERY", y: 0.498, size: 18, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, x: 0.06, width: 0.88 },
      { text: "FRESH · DAILY", y: 0.6, size: 8, ls: 2, fill: PALETTES.terracottaCream.c },
    ],
  },
  {
    id: "creative-cafe-tonys-pizza-co",
    name: "Tony's Pizza Co.",
    category: "food-cafe",
    tags: ["pizza", "restaurant", "food", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.06, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.redCream.a }],
    graphics: [{ assetId: "pizza-slice", x: 0.4, y: 0.14, w: 0.2, h: 0.22, fill: PALETTES.redCream.b }],
    lines: [
      { text: "TONY'S", y: 0.4, size: 16, bold: true, italic: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, x: 0.06, width: 0.88 },
      { text: "PIZZA CO.", y: 0.492, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-cafe-roadside-food-truck",
    name: "Roadside Food Truck",
    category: "food-cafe",
    tags: ["food truck", "restaurant", "food", "street food", "logo", "creative"],
    shapes: [{ x: 0.02, y: 0.32, w: 0.58, h: 0.17, fill: PALETTES.yellowCharcoal.b, rotation: 4 }],
    graphics: [{ assetId: "food-truck", x: 0.06, y: 0.09, w: 0.26, h: 0.2, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "ROADSIDE", y: 0.34, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a, align: "left", x: 0.34, width: 0.6 },
      { text: "FOOD TRUCK", y: 0.43, size: 9, ls: 1, fill: PALETTES.yellowCharcoal.c, align: "left", x: 0.34, width: 0.6 },
    ],
  },
  {
    id: "creative-cafe-harvest-table",
    name: "Harvest Table Restaurant",
    category: "food-cafe",
    tags: ["restaurant", "staff", "kitchen", "crew", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.mintForest.b }],
    graphics: [{ assetId: "chef-hat", x: 0.38, y: 0.15, w: 0.24, h: 0.24, fill: PALETTES.mintForest.a }],
    lines: [
      { text: "HARVEST TABLE", y: 0.46, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.mintForest.a, x: 0.06, width: 0.88 },
      { text: "RESTAURANT STAFF", y: 0.55, size: 9, ls: 1, fill: PALETTES.mintForest.c },
    ],
  },
  {
    id: "creative-cafe-burger-barn",
    name: "Burger Barn",
    category: "food-cafe",
    tags: ["burger", "food", "restaurant", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.burgundyGold.a },
      { assetId: "burger", x: 0.39, y: 0.14, w: 0.22, h: 0.2, fill: PALETTES.burgundyGold.b },
    ],
    lines: [
      { text: "BURGER BARN", y: 0.38, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.burgundyGold.b, x: 0.06, width: 0.88 },
      { text: "SINCE 1998", y: 0.48, size: 9, ls: 2, fill: PALETTES.burgundyGold.c },
    ],
  },
  {
    id: "creative-cafe-fresh-grounds-roastery",
    name: "Fresh Grounds Roastery",
    category: "food-cafe",
    tags: ["coffee", "cafe", "roastery", "logo", "creative", "minimal"],
    graphics: [{ assetId: "coffee-cup", x: 0.06, y: 0.32, w: 0.18, h: 0.18, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "FRESH GROUNDS", y: 0.28, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.a, align: "left", x: 0.28, width: 0.66 },
      { text: "ROASTERY", y: 0.37, size: 10, ls: 2, fill: PALETTES.blackGold.b, align: "left", x: 0.28, width: 0.66 },
    ],
  },

  // ---------------------------------------------------------------- SPORTS (8)
  {
    id: "creative-sports-tigers-basketball",
    name: "Tigers Basketball",
    category: "sports",
    tags: ["basketball", "sports", "team", "league", "logo", "creative", "varsity"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.navyOrange.a },
      { assetId: "basketball", x: 0.39, y: 0.13, w: 0.22, h: 0.22, fill: PALETTES.navyOrange.b },
      { assetId: "star-burst", x: 0.24, y: 0.1, w: 0.09, h: 0.09, fill: PALETTES.navyOrange.b },
      { assetId: "star-burst", x: 0.67, y: 0.1, w: 0.09, h: 0.09, fill: PALETTES.navyOrange.b },
    ],
    lines: [
      { text: "TIGERS", y: 0.36, size: 20, bold: true, font: DISPLAY_FONT, fill: PALETTES.navyOrange.c, curve: -22, x: 0.06, width: 0.88 },
      { text: "BASKETBALL", y: 0.582, size: 12, ls: 2, fill: PALETTES.navyOrange.b, x: 0.06, width: 0.88 },
      { text: "EST. 2019", y: 0.662, size: 8, ls: 2, fill: PALETTES.navyOrange.c },
    ],
    featured: true,
  },
  {
    id: "creative-sports-united-fc-academy",
    name: "United FC Soccer Academy",
    category: "sports",
    tags: ["soccer", "football", "sports", "team", "league", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.tealNavy.b }],
    graphics: [{ assetId: "soccer-ball", x: 0.38, y: 0.15, w: 0.24, h: 0.24, fill: PALETTES.tealNavy.c }],
    lines: [
      { text: "UNITED FC", y: 0.46, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.tealNavy.c, x: 0.06, width: 0.88 },
      { text: "SOCCER ACADEMY", y: 0.56, size: 9, ls: 1, fill: PALETTES.tealNavy.a },
    ],
  },
  {
    id: "creative-sports-ice-wolves-hockey",
    name: "Ice Wolves Hockey",
    category: "sports",
    tags: ["hockey", "sports", "team", "league", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.cyanNavy.b },
      { assetId: "hockey-stick", x: 0.39, y: 0.13, w: 0.22, h: 0.22, fill: PALETTES.cyanNavy.a },
      { assetId: "puck", x: 0.44, y: 0.28, w: 0.12, h: 0.06, fill: PALETTES.cyanNavy.b },
    ],
    lines: [
      { text: "ICE WOLVES", y: 0.38, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.cyanNavy.a, x: 0.06, width: 0.88 },
      { text: "HOCKEY CLUB", y: 0.47, size: 10, ls: 2, fill: PALETTES.cyanNavy.b },
    ],
  },
  {
    id: "creative-sports-river-cats-baseball",
    name: "River Cats Baseball",
    category: "sports",
    tags: ["baseball", "sports", "team", "league", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.redCream.a }],
    graphics: [{ assetId: "baseball", x: 0.4, y: 0.15, w: 0.2, h: 0.2, fill: PALETTES.redCream.b }],
    lines: [
      { text: "RIVER CATS", y: 0.44, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, x: 0.06, width: 0.88 },
      { text: "BASEBALL", y: 0.54, size: 10, ls: 2, fill: PALETTES.redCream.b },
    ],
  },
  {
    id: "creative-sports-spike-squad-volleyball",
    name: "Spike Squad Volleyball",
    category: "sports",
    tags: ["volleyball", "sports", "team", "league", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.07, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.pinkRed.a }],
    graphics: [{ assetId: "volleyball", x: 0.4, y: 0.16, w: 0.2, h: 0.2, fill: PALETTES.pinkRed.b }],
    lines: [
      { text: "SPIKE SQUAD", y: 0.44, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.pinkRed.b, x: 0.06, width: 0.88 },
      { text: "VOLLEYBALL", y: 0.53, size: 10, ls: 2, fill: PALETTES.pinkRed.c, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-sports-championship-elite",
    name: "Championship Elite",
    category: "sports",
    tags: ["championship", "sports", "team", "trophy", "bold", "creative", "logo"],
    graphics: [
      { assetId: "trophy", x: 0.38, y: 0.05, w: 0.24, h: 0.24, fill: PALETTES.blackGold.b },
      { assetId: "star-burst", x: 0.16, y: 0.32, w: 0.1, h: 0.1, fill: PALETTES.blackGold.b },
      { assetId: "star-burst", x: 0.74, y: 0.32, w: 0.1, h: 0.1, fill: PALETTES.blackGold.b },
    ],
    lines: [
      { text: "CHAMPIONSHIP", y: 0.34, size: 20, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.b, ls: -1 },
      { text: "ELITE ATHLETICS", y: 0.45, size: 10, ls: 2, fill: PALETTES.blackGold.a },
    ],
  },
  {
    id: "creative-sports-varsity-athletics",
    name: "Varsity Athletics Club",
    category: "sports",
    tags: ["varsity", "sports", "team", "athletics", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.purpleGold.a },
      { assetId: "wings", x: 0.36, y: 0.16, w: 0.28, h: 0.18, fill: PALETTES.purpleGold.b },
    ],
    lines: [
      { text: "VARSITY", y: 0.36, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.purpleGold.b, curve: -24, x: 0.06, width: 0.88 },
      { text: "ATHLETICS", y: 0.541, size: 11, ls: 2, fill: PALETTES.purpleGold.b },
    ],
  },
  {
    id: "creative-sports-coach-staff-crew",
    name: "Coach Staff Crew",
    category: "sports",
    tags: ["coach", "sports", "team", "staff", "logo", "creative"],
    shapes: [{ x: 0.24, y: 0.07, w: 0.52, h: 0.52, shapeKind: "circle", fill: PALETTES.yellowCharcoal.b }],
    graphics: [{ assetId: "whistle", x: 0.38, y: 0.17, w: 0.24, h: 0.2, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "COACH", y: 0.44, size: 18, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a, ls: 3 },
      { text: "TEAM STAFF", y: 0.55, size: 9, ls: 1, fill: PALETTES.yellowCharcoal.c },
    ],
  },

  // ---------------------------------------------------------------- SCHOOLS (6)
  {
    id: "creative-schools-lincoln-spirit",
    name: "Lincoln School Spirit",
    category: "schools",
    tags: ["school", "spirit", "club", "student", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.06, w: 0.5, h: 0.48, fill: PALETTES.navyOrange.a },
      { assetId: "book-open", x: 0.39, y: 0.16, w: 0.22, h: 0.2, fill: PALETTES.navyOrange.b },
    ],
    lines: [
      { text: "LINCOLN", y: 0.38, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.navyOrange.c },
      { text: "SCHOOL SPIRIT", y: 0.48, size: 9, ls: 2, fill: PALETTES.navyOrange.b },
    ],
  },
  {
    id: "creative-schools-class-of-2026",
    name: "Class of 2026",
    category: "graduation",
    tags: ["graduation", "grad", "class of", "school", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.blackGold.a }],
    graphics: [{ assetId: "graduation-hat-2", x: 0.38, y: 0.16, w: 0.24, h: 0.2, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "CLASS OF", y: 0.44, size: 12, ls: 2, fill: PALETTES.blackGold.c, x: 0.06, width: 0.88 },
      { text: "2026", y: 0.514, size: 22, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.b, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-schools-graduation-honors",
    name: "Graduation Honors",
    category: "graduation",
    tags: ["graduation", "grad", "honors", "school", "logo", "creative"],
    graphics: [
      { assetId: "laurel", x: 0.22, y: 0.05, w: 0.56, h: 0.44, fill: PALETTES.burgundyGold.a },
      { assetId: "torch", x: 0.4, y: 0.12, w: 0.2, h: 0.24, fill: PALETTES.burgundyGold.b },
    ],
    lines: [
      { text: "GRADUATION", y: 0.42, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.burgundyGold.b, curve: 22, x: 0.06, width: 0.88 },
      { text: "HONORS · 2026", y: 0.57, size: 9, ls: 1, fill: PALETTES.burgundyGold.c },
    ],
  },
  {
    id: "creative-schools-campus-club",
    name: "Campus Club Society",
    category: "schools",
    tags: ["school", "club", "society", "campus", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.royalBlue.a }],
    graphics: [{ assetId: "book-open", x: 0.38, y: 0.16, w: 0.24, h: 0.22, fill: PALETTES.royalBlue.b }],
    lines: [
      { text: "CAMPUS CLUB", y: 0.46, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.royalBlue.b, x: 0.06, width: 0.88 },
      { text: "SOCIETY", y: 0.55, size: 10, ls: 3, fill: PALETTES.royalBlue.c },
    ],
  },
  {
    id: "creative-schools-varsity-letterman",
    name: "Varsity Letterman",
    category: "schools",
    tags: ["school", "varsity", "letterman", "sports", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.24, y: 0.05, w: 0.52, h: 0.5, fill: PALETTES.redCream.a },
      { assetId: "star-burst", x: 0.4, y: 0.14, w: 0.2, h: 0.2, fill: PALETTES.redCream.b },
    ],
    lines: [
      { text: "VARSITY", y: 0.36, size: 24, bold: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, ls: 1 },
      { text: "LETTERMAN", y: 0.49, size: 9, ls: 3, fill: PALETTES.redCream.c },
    ],
  },
  {
    id: "creative-schools-student-society-crest",
    name: "Student Society Crest",
    category: "schools",
    tags: ["school", "student", "society", "crest", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.tealNavy.a },
      { assetId: "torch", x: 0.4, y: 0.14, w: 0.2, h: 0.22, fill: PALETTES.tealNavy.c },
    ],
    lines: [
      { text: "STUDENT", y: 0.38, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.tealNavy.c },
      { text: "SOCIETY · EST. 1990", y: 0.48, size: 9, ls: 1, fill: PALETTES.tealNavy.c },
    ],
  },

  // ---------------------------------------------------------------- EVENTS / FAMILY (6)
  {
    id: "creative-events-birthday-crew-deluxe",
    name: "Birthday Crew Deluxe",
    category: "birthday",
    tags: ["birthday", "party", "crew", "celebration", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.pinkRed.b }],
    graphics: [
      { assetId: "balloon", x: 0.38, y: 0.14, w: 0.24, h: 0.24, fill: PALETTES.pinkRed.c },
      { assetId: "confetti", x: 0.62, y: 0.1, w: 0.14, h: 0.14, fill: PALETTES.pinkRed.c, rotation: 12 },
    ],
    lines: [
      { text: "BIRTHDAY", y: 0.42, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.pinkRed.c, curve: -20, x: 0.06, width: 0.88 },
      { text: "CREW", y: 0.581, size: 20, bold: true, font: DISPLAY_FONT, fill: PALETTES.pinkRed.c, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-events-sunset-family-reunion",
    name: "Sunset Family Reunion",
    category: "family",
    tags: ["family", "reunion", "group", "crew", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.retroSunset.a }],
    graphics: [{ assetId: "family-group", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.retroSunset.b }],
    lines: [
      { text: "THE FAMILY", y: 0.46, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.retroSunset.b, x: 0.06, width: 0.88 },
      { text: "REUNION · 2026", y: 0.56, size: 9, ls: 1, fill: PALETTES.retroSunset.b },
    ],
  },
  {
    id: "creative-events-wedding-crew-elegant",
    name: "Wedding Crew Elegant",
    category: "events",
    tags: ["wedding", "event", "crew", "elegant", "logo", "creative"],
    graphics: [{ assetId: "rings", x: 0.4, y: 0.1, w: 0.2, h: 0.14, fill: PALETTES.burgundyGold.b }],
    shapes: [{ x: 0.28, y: 0.4, w: 0.44, h: 0.008, fill: PALETTES.burgundyGold.b }],
    lines: [{ text: "WEDDING CREW", y: 0.28, size: 16, fill: PALETTES.burgundyGold.a, ls: 4 }],
  },
  {
    id: "creative-events-volunteer-force",
    name: "Volunteer Force Team",
    category: "fundraisers",
    tags: ["volunteer", "event", "team", "community", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.forestCream.a }],
    graphics: [{ assetId: "fundraiser-heart-hands", x: 0.38, y: 0.16, w: 0.24, h: 0.22, fill: PALETTES.forestCream.b }],
    lines: [
      { text: "VOLUNTEER", y: 0.46, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.forestCream.b, x: 0.06, width: 0.88 },
      { text: "FORCE TEAM", y: 0.55, size: 10, ls: 2, fill: PALETTES.forestCream.c },
    ],
  },
  {
    id: "creative-events-festival-staff-bold",
    name: "Festival Staff Bold",
    category: "events",
    tags: ["festival", "event", "staff", "crew", "bold", "creative"],
    shapes: [{ x: -0.02, y: 0.32, w: 1.04, h: 0.15, fill: PALETTES.yellowCharcoal.b, rotation: 3 }],
    graphics: [{ assetId: "confetti", x: 0.08, y: 0.09, w: 0.16, h: 0.16, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "FESTIVAL", y: 0.34, size: 22, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a, ls: -1 },
      { text: "STAFF", y: 0.52, size: 16, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.c },
    ],
  },
  {
    id: "creative-events-celebration-crew-crest",
    name: "Celebration Crew Crest",
    category: "events",
    tags: ["celebration", "event", "crew", "crest", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.mintForest.b },
      { assetId: "crown", x: 0.4, y: 0.13, w: 0.2, h: 0.18, fill: PALETTES.mintForest.a },
    ],
    lines: [
      { text: "CELEBRATION", y: 0.38, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.mintForest.a, curve: 18, x: 0.06, width: 0.88 },
      { text: "CREW", y: 0.53, size: 11, ls: 2, fill: PALETTES.mintForest.c },
    ],
  },

  // ---------------------------------------------------------------- AUTOMOTIVE (6)
  {
    id: "creative-automotive-nightshift-motor-club",
    name: "Nightshift Motor Club",
    category: "automotive",
    tags: ["automotive", "car", "cars", "motor", "motor club", "garage", "racing", "crew", "club", "streetwear", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.24, y: 0.05, w: 0.52, h: 0.5, fill: PALETTES.blackGold.a },
      { assetId: "car-silhouette", x: 0.36, y: 0.16, w: 0.28, h: 0.16, fill: PALETTES.blackGold.b },
      { assetId: "speed-lines", x: 0.3, y: 0.32, w: 0.4, h: 0.06, fill: PALETTES.blackGold.b },
    ],
    lines: [
      { text: "NIGHTSHIFT", y: 0.4, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.b },
      { text: "MOTOR CLUB", y: 0.5, size: 11, ls: 2, fill: PALETTES.blackGold.c },
      { text: "OTTAWA", y: 0.58, size: 8, ls: 3, fill: PALETTES.blackGold.b },
    ],
    featured: true,
  },
  {
    id: "creative-automotive-redline-performance",
    name: "Redline Performance Garage",
    category: "automotive",
    tags: ["automotive", "garage", "performance", "cars", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.redCream.a }],
    graphics: [{ assetId: "wheel", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.redCream.b }],
    lines: [
      { text: "REDLINE", y: 0.46, size: 15, bold: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, x: 0.06, width: 0.88 },
      { text: "PERFORMANCE GARAGE", y: 0.56, size: 8, ls: 1, fill: PALETTES.redCream.c },
    ],
  },
  {
    id: "creative-automotive-shine-detailing",
    name: "Shine Auto Detailing",
    category: "automotive",
    tags: ["automotive", "detailing", "cars", "car wash", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.cyanNavy.b }],
    graphics: [
      { assetId: "car-silhouette", x: 0.32, y: 0.18, w: 0.36, h: 0.18, fill: PALETTES.cyanNavy.a },
      { assetId: "star-burst", x: 0.62, y: 0.13, w: 0.1, h: 0.1, fill: PALETTES.cyanNavy.a },
    ],
    lines: [
      { text: "SHINE", y: 0.44, size: 18, bold: true, font: DISPLAY_FONT, fill: PALETTES.cyanNavy.a },
      { text: "AUTO DETAILING", y: 0.55, size: 9, ls: 1, fill: PALETTES.cyanNavy.c },
    ],
  },
  {
    id: "creative-automotive-apex-racing-team",
    name: "Apex Racing Team",
    category: "automotive",
    tags: ["automotive", "racing", "motorsport", "cars", "bold", "creative", "logo"],
    shapes: [{ x: -0.02, y: 0.3, w: 1.04, h: 0.16, fill: PALETTES.yellowCharcoal.b, rotation: -6 }],
    graphics: [{ assetId: "checkered-flag", x: 0.06, y: 0.08, w: 0.18, h: 0.2, fill: PALETTES.yellowCharcoal.a }],
    lines: [
      { text: "APEX", y: 0.32, size: 26, bold: true, italic: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.a },
      { text: "RACING TEAM", y: 0.52, size: 11, ls: 2, fill: PALETTES.yellowCharcoal.c },
    ],
  },
  {
    id: "creative-automotive-classic-car-club",
    name: "Classic Car Club",
    category: "automotive",
    tags: ["automotive", "car club", "cars", "enthusiast", "vintage", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.terracottaCream.a }],
    graphics: [{ assetId: "wheel", x: 0.38, y: 0.16, w: 0.24, h: 0.24, fill: PALETTES.terracottaCream.b }],
    lines: [
      { text: "CLASSIC", y: 0.44, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, curve: 22, x: 0.06, width: 0.88 },
      { text: "CAR CLUB", y: 0.601, size: 10, ls: 2, fill: PALETTES.terracottaCream.c },
    ],
  },
  {
    id: "creative-automotive-garage-crew-motorworks",
    name: "Garage Crew Motorworks",
    category: "automotive",
    tags: ["automotive", "garage", "motorworks", "cars", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.royalBlue.a },
      { assetId: "wrench-gear", x: 0.39, y: 0.15, w: 0.22, h: 0.22, fill: PALETTES.royalBlue.b },
    ],
    lines: [
      { text: "GARAGE CREW", y: 0.38, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.royalBlue.b },
      { text: "MOTORWORKS", y: 0.48, size: 9, ls: 2, fill: PALETTES.royalBlue.c },
    ],
  },

  // ---------------------------------------------------------------- STREETWEAR (7)
  {
    id: "creative-streetwear-gothic-crest-society",
    name: "Gothic Crest Society",
    category: "streetwear",
    tags: ["streetwear", "gothic", "urban", "bold", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.blackGold.a },
      { assetId: "flame", x: 0.4, y: 0.14, w: 0.2, h: 0.24, fill: PALETTES.blackGold.b },
      { assetId: "monogram-frame", x: 0.22, y: 0.03, w: 0.56, h: 0.52, fill: PALETTES.blackGold.b, opacity: 0.5 },
    ],
    lines: [
      { text: "GOTHIC", y: 0.38, size: 17, bold: true, italic: true, font: DISPLAY_FONT, fill: PALETTES.blackGold.b, ls: 1 },
      { text: "CREST", y: 0.48, size: 11, ls: 4, fill: PALETTES.blackGold.c },
    ],
  },
  {
    id: "creative-streetwear-urban-flame-collective",
    name: "Urban Flame Collective",
    category: "streetwear",
    tags: ["streetwear", "urban", "flame", "bold", "logo", "creative"],
    graphics: [{ assetId: "flame", x: 0.36, y: 0.04, w: 0.28, h: 0.34, fill: PALETTES.retroSunset.a, rotation: -3 }],
    lines: [
      { text: "URBAN FLAME", y: 0.4, size: 19, bold: true, font: DISPLAY_FONT, fill: PALETTES.retroSunset.c, rotation: -3 },
      { text: "COLLECTIVE", y: 0.51, size: 10, ls: 3, fill: PALETTES.retroSunset.b },
    ],
  },
  {
    id: "creative-streetwear-vintage-racing-co",
    name: "Vintage Racing Co.",
    category: "streetwear",
    tags: ["streetwear", "vintage", "racing", "retro", "logo", "creative"],
    // Cream (terracottaCream.b) is only legible against a dark/medium backdrop — this composition
    // has no shirt-colored "safe zone" assumption, so it needs its own badge rather than relying on
    // the garment underneath (a light garment would make cream-on-cream disappear entirely).
    shapes: [{ x: 0.22, y: 0.05, w: 0.56, h: 0.52, shapeKind: "circle", fill: PALETTES.terracottaCream.a }],
    graphics: [
      { assetId: "wheel", x: 0.4, y: 0.13, w: 0.2, h: 0.2, fill: PALETTES.terracottaCream.b },
      { assetId: "checkered-flag", x: 0.62, y: 0.06, w: 0.12, h: 0.16, fill: PALETTES.terracottaCream.c, rotation: 10 },
    ],
    lines: [
      { text: "VINTAGE RACING", y: 0.4, size: 12, bold: true, font: DISPLAY_FONT, fill: PALETTES.terracottaCream.b, curve: 18, x: 0.06, width: 0.88 },
      { text: "CO.", y: 0.54, size: 11, ls: 4, fill: PALETTES.terracottaCream.b, x: 0.06, width: 0.88 },
    ],
  },
  {
    id: "creative-streetwear-star-society",
    name: "Star Society",
    category: "streetwear",
    tags: ["streetwear", "star", "society", "bold", "logo", "creative"],
    graphics: [
      { assetId: "star-burst", x: 0.36, y: 0.05, w: 0.28, h: 0.28, fill: PALETTES.purpleGold.b },
      { assetId: "abstract-diamond", x: 0.05, y: 0.36, w: 0.14, h: 0.14, fill: PALETTES.purpleGold.a, rotation: 10 },
    ],
    lines: [
      { text: "STAR", y: 0.36, size: 26, bold: true, font: DISPLAY_FONT, fill: PALETTES.purpleGold.a },
      { text: "SOCIETY", y: 0.5, size: 12, ls: 4, fill: PALETTES.purpleGold.b },
    ],
  },
  {
    id: "creative-streetwear-oversized-type-co",
    name: "Oversized Type Co.",
    category: "streetwear",
    tags: ["streetwear", "oversized", "typography", "minimal", "bold", "creative"],
    shapes: [{ x: 0.04, y: 0.28, w: 0.92, h: 0.2, fill: PALETTES.yellowCharcoal.a }],
    lines: [{ text: "BOLD.", y: 0.3, size: 40, bold: true, font: DISPLAY_FONT, fill: PALETTES.yellowCharcoal.b }],
  },
  {
    id: "creative-streetwear-lightning-club",
    name: "Lightning Club",
    category: "streetwear",
    tags: ["streetwear", "lightning", "club", "bold", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.cyanNavy.b }],
    graphics: [{ assetId: "lightning", x: 0.4, y: 0.14, w: 0.2, h: 0.3, fill: PALETTES.cyanNavy.a }],
    lines: [
      { text: "LIGHTNING", y: 0.48, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.cyanNavy.a },
      { text: "CLUB", y: 0.58, size: 10, ls: 4, fill: PALETTES.cyanNavy.c },
    ],
  },
  {
    id: "creative-streetwear-abstract-street-co",
    name: "Abstract Street Co.",
    category: "streetwear",
    tags: ["streetwear", "abstract", "geometric", "urban", "logo", "creative"],
    graphics: [{ assetId: "abstract-diamond", x: 0.34, y: 0.06, w: 0.32, h: 0.32, fill: PALETTES.mintForest.b, rotation: 18 }],
    lines: [
      { text: "ABSTRACT", y: 0.4, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.mintForest.b },
      { text: "STREET CO.", y: 0.5, size: 10, ls: 2, fill: PALETTES.mintForest.a },
    ],
  },

  // ---------------------------------------------------------------- CANADIAN / LOCAL / OUTDOORS (4)
  {
    id: "creative-canadian-ottawa-local-pride",
    name: "Ottawa Local Pride",
    category: "canadian",
    tags: ["canada", "ottawa", "local", "pride", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.redCream.a }],
    graphics: [{ assetId: "maple-leaf", x: 0.4, y: 0.16, w: 0.2, h: 0.2, fill: PALETTES.redCream.b }],
    lines: [
      { text: "OTTAWA", y: 0.44, size: 17, bold: true, font: DISPLAY_FONT, fill: PALETTES.redCream.b, curve: 24, x: 0.06, width: 0.88 },
      { text: "LOCAL PRIDE", y: 0.631, size: 9, ls: 2, fill: PALETTES.redCream.c },
    ],
    featured: true,
  },
  {
    id: "creative-canadian-outdoors-co",
    name: "Canadian Outdoors Co.",
    category: "canadian",
    tags: ["canada", "outdoors", "nature", "canadian", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.forestCream.a },
      { assetId: "pine-tree", x: 0.4, y: 0.14, w: 0.2, h: 0.26, fill: PALETTES.forestCream.b },
      { assetId: "sun", x: 0.62, y: 0.08, w: 0.12, h: 0.12, fill: PALETTES.forestCream.c },
    ],
    lines: [
      { text: "CANADIAN", y: 0.4, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.forestCream.c },
      { text: "OUTDOORS CO.", y: 0.49, size: 9, ls: 1, fill: PALETTES.forestCream.b },
    ],
  },
  {
    id: "creative-canadian-northern-club-crest",
    name: "Northern Club Crest",
    category: "canadian",
    tags: ["canada", "northern", "club", "crest", "logo", "creative"],
    graphics: [
      { assetId: "shield", x: 0.25, y: 0.05, w: 0.5, h: 0.48, fill: PALETTES.tealNavy.a },
      { assetId: "maple-leaf", x: 0.4, y: 0.14, w: 0.2, h: 0.2, fill: PALETTES.tealNavy.c },
      { assetId: "star-burst", x: 0.24, y: 0.11, w: 0.08, h: 0.08, fill: PALETTES.tealNavy.c },
      { assetId: "star-burst", x: 0.68, y: 0.11, w: 0.08, h: 0.08, fill: PALETTES.tealNavy.c },
    ],
    lines: [
      { text: "NORTHERN", y: 0.38, size: 13, bold: true, font: DISPLAY_FONT, fill: PALETTES.tealNavy.c },
      { text: "CLUB", y: 0.47, size: 10, ls: 3, fill: PALETTES.tealNavy.c },
    ],
  },
  {
    id: "creative-canadian-maple-and-mountains",
    name: "Maple & Mountains",
    category: "canadian",
    tags: ["canada", "maple", "mountains", "outdoors", "logo", "creative"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.56, shapeKind: "circle", fill: PALETTES.mintForest.b }],
    graphics: [
      { assetId: "mountain", x: 0.32, y: 0.24, w: 0.36, h: 0.2, fill: PALETTES.mintForest.a },
      { assetId: "maple-leaf", x: 0.42, y: 0.12, w: 0.16, h: 0.16, fill: PALETTES.mintForest.a },
    ],
    lines: [
      { text: "MAPLE &", y: 0.46, size: 12, bold: true, font: DISPLAY_FONT, fill: PALETTES.mintForest.c, x: 0.06, width: 0.88 },
      { text: "MOUNTAINS", y: 0.54, size: 14, bold: true, font: DISPLAY_FONT, fill: PALETTES.mintForest.c, x: 0.06, width: 0.88 },
    ],
  },
];

// ===========================================================================================
// FLAT-PRINT COLLECTION (STUDIO V4 brief) — business card/flyer/poster demo templates, authored
// directly as full DesignTemplate literals (via the same textSeed/shapeSeed/graphicSeed helpers
// every other collection uses) rather than through a spec+builder pair, since there are only 25 of
// them and their layouts (landscape cards vs. portrait flyers/posters) don't share a common
// compact shorthand the way the apparel collections' front-and-center compositions do.
// ===========================================================================================
const FLAT_PRINT_TEMPLATES: DesignTemplate[] = [
  // ============================================================
  // BUSINESS CARDS — Section "BUSINESS CARD TEMPLATE CATEGORIES". Landscape 3.5x2in box (see
  // printAreas.ts's card-front geometry) — compact left-aligned compositions, never the vertically
  // stacked centered layout apparel templates use, since that reads as cramped at this aspect ratio.
  // ============================================================
  {
    id: "tpl-card-corporate",
    name: "Corporate Clean",
    category: "corporate",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["corporate", "clean", "professional"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "Jordan Blake", fontSize: 20, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.08, normalizedY: 0.16, normalizedWidth: 0.6, normalizedHeight: 0.14 }),
      textSeed({ content: "Operations Director", fontSize: 11, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.34, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
      shapeSeed({ shapeKind: "line", normalizedX: 0.08, normalizedY: 0.52, normalizedWidth: 0.3, normalizedHeight: 0.01, fill: "#171412" }),
      textSeed({ content: "jordan@company.com · (555) 010-2200", fontSize: 9, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.62, normalizedWidth: 0.84, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-luxury",
    name: "Luxury Minimal",
    category: "luxury",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["luxury", "elegant", "minimal"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "AURELIA", fontSize: 22, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "center", letterSpacing: 4, normalizedX: 0.1, normalizedY: 0.3, normalizedWidth: 0.8, normalizedHeight: 0.16 }),
      shapeSeed({ shapeKind: "line", normalizedX: 0.4, normalizedY: 0.58, normalizedWidth: 0.2, normalizedHeight: 0.01, fill: "#5b5348" }),
      textSeed({ content: "EST. 2018", fontSize: 9, align: "center", letterSpacing: 3, fill: "#5b5348", normalizedX: 0.1, normalizedY: 0.64, normalizedWidth: 0.8, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-creative",
    name: "Creative Bold",
    category: "creative",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["creative", "bold", "colourful"],
    linkedAssetIds: [],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      shapeSeed({ shapeKind: "circle", fill: "#D41414", normalizedX: 0.72, normalizedY: 0.14, normalizedWidth: 0.22, normalizedHeight: 0.4 }),
      textSeed({ content: "Nova Studio", fontSize: 19, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.08, normalizedY: 0.2, normalizedWidth: 0.55, normalizedHeight: 0.14 }),
      textSeed({ content: "Design & Branding", fontSize: 10, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.38, normalizedWidth: 0.55, normalizedHeight: 0.1 }),
      textSeed({ content: "hello@novastudio.co", fontSize: 9, align: "left", normalizedX: 0.08, normalizedY: 0.68, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-contractor",
    name: "Contractor",
    category: "contractor",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["contractor", "trades", "construction"],
    linkedAssetIds: ["bootstrap-icons-wrench-adjustable"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("bootstrap-icons-wrench-adjustable", { normalizedX: 0.08, normalizedY: 0.18, normalizedWidth: 0.16, normalizedHeight: 0.28, fill: "#171412" }),
      textSeed({ content: "Reliable Builders Co.", fontSize: 16, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.32, normalizedY: 0.2, normalizedWidth: 0.6, normalizedHeight: 0.14 }),
      textSeed({ content: "Renovations · Repairs · New Builds", fontSize: 9, align: "left", fill: "#5b5348", normalizedX: 0.32, normalizedY: 0.38, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
      textSeed({ content: "(555) 010-4477", fontSize: 10, align: "left", normalizedX: 0.08, normalizedY: 0.7, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-real-estate",
    name: "Real Estate",
    category: "real-estate",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["real-estate", "agent", "property"],
    linkedAssetIds: ["heroicons-building-office"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-building-office", { normalizedX: 0.08, normalizedY: 0.16, normalizedWidth: 0.16, normalizedHeight: 0.28, fill: "#171412" }),
      textSeed({ content: "Morgan Reyes", fontSize: 17, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.32, normalizedY: 0.18, normalizedWidth: 0.6, normalizedHeight: 0.14 }),
      textSeed({ content: "Realtor · Harbourview Realty", fontSize: 9, align: "left", fill: "#5b5348", normalizedX: 0.32, normalizedY: 0.36, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
      textSeed({ content: "morgan@harbourview.ca · (555) 010-9021", fontSize: 8.5, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.68, normalizedWidth: 0.84, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-restaurant",
    name: "Restaurant",
    category: "restaurant",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["restaurant", "food", "dining"],
    linkedAssetIds: ["maple-coffee-cup"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("maple-coffee-cup", { normalizedX: 0.4, normalizedY: 0.1, normalizedWidth: 0.2, normalizedHeight: 0.32 }),
      textSeed({ content: "The Maple Table", fontSize: 16, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "center", normalizedX: 0.1, normalizedY: 0.5, normalizedWidth: 0.8, normalizedHeight: 0.12 }),
      textSeed({ content: "RESERVATIONS · 555 010 3345", fontSize: 8.5, align: "center", letterSpacing: 1, fill: "#5b5348", normalizedX: 0.1, normalizedY: 0.66, normalizedWidth: 0.8, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-beauty",
    name: "Beauty Studio",
    category: "beauty",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["beauty", "salon", "spa"],
    linkedAssetIds: ["maple-heart"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("maple-heart", { normalizedX: 0.08, normalizedY: 0.24, normalizedWidth: 0.16, normalizedHeight: 0.28, fill: "#D41414" }),
      textSeed({ content: "Bloom Beauty Bar", fontSize: 16, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.32, normalizedY: 0.22, normalizedWidth: 0.6, normalizedHeight: 0.14 }),
      textSeed({ content: "Hair · Skin · Nails", fontSize: 9, align: "left", fill: "#5b5348", normalizedX: 0.32, normalizedY: 0.4, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
      textSeed({ content: "@bloombeautybar", fontSize: 9, align: "left", normalizedX: 0.32, normalizedY: 0.66, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-photography",
    name: "Photography",
    category: "photography",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["photography", "creative", "studio"],
    linkedAssetIds: ["tabler-camera"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("tabler-camera", { normalizedX: 0.08, normalizedY: 0.32, normalizedWidth: 0.16, normalizedHeight: 0.24, fill: "#171412" }),
      textSeed({ content: "RILEY SHAW", fontSize: 16, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", letterSpacing: 1.5, normalizedX: 0.32, normalizedY: 0.2, normalizedWidth: 0.6, normalizedHeight: 0.14 }),
      textSeed({ content: "PHOTOGRAPHY", fontSize: 9, align: "left", letterSpacing: 2, fill: "#5b5348", normalizedX: 0.32, normalizedY: 0.38, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
      textSeed({ content: "rileyshaw.com", fontSize: 9, align: "left", normalizedX: 0.32, normalizedY: 0.66, normalizedWidth: 0.6, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-technology",
    name: "Technology",
    category: "technology",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["technology", "startup", "modern"],
    linkedAssetIds: ["heroicons-bolt"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-bolt", { normalizedX: 0.08, normalizedY: 0.18, normalizedWidth: 0.14, normalizedHeight: 0.24, fill: "#171412" }),
      textSeed({ content: "Nimbus Labs", fontSize: 18, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.28, normalizedY: 0.2, normalizedWidth: 0.64, normalizedHeight: 0.14 }),
      textSeed({ content: "Sam Rivera · Founder", fontSize: 10, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.5, normalizedWidth: 0.7, normalizedHeight: 0.1 }),
      textSeed({ content: "sam@nimbuslabs.io", fontSize: 9, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.68, normalizedWidth: 0.7, normalizedHeight: 0.1 }),
    ],
  },
  {
    id: "tpl-card-qr-contact",
    name: "QR Digital Contact",
    category: "qr-contact",
    thumbnailUrl: "",
    productFamilies: ["business-card"],
    compatiblePrintAreas: ["card-front"],
    orientation: "landscape",
    tags: ["qr", "digital", "contact"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    // The QR itself is intentionally NOT baked into the template as a live-generated code — a
    // template is applied before the customer has a real destination to encode, so a "working" QR
    // here would just point at a placeholder URL. This marks where one goes; the customer creates
    // the real one with the QR tool afterward (Section "QR PANEL").
    objects: [
      textSeed({ content: "Alex Chen", fontSize: 17, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, align: "left", normalizedX: 0.08, normalizedY: 0.18, normalizedWidth: 0.5, normalizedHeight: 0.14 }),
      textSeed({ content: "Account Manager", fontSize: 10, align: "left", fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.36, normalizedWidth: 0.5, normalizedHeight: 0.1 }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.68, normalizedY: 0.16, normalizedWidth: 0.24, normalizedHeight: 0.62 }),
      textSeed({ content: "ADD QR", fontSize: 8, align: "center", fill: "#9C9284", normalizedX: 0.68, normalizedY: 0.42, normalizedWidth: 0.24, normalizedHeight: 0.1 }),
      textSeed({ content: "SCAN TO SAVE CONTACT", fontSize: 8, align: "left", letterSpacing: 1, fill: "#5b5348", normalizedX: 0.08, normalizedY: 0.7, normalizedWidth: 0.55, normalizedHeight: 0.1 }),
    ],
  },

  // ============================================================
  // FLYERS — Section "FLYER TEMPLATE CATEGORIES". Portrait 8.5x11in box, proportioned close enough
  // to apparel front that the same vertically-stacked composition style reads well here too.
  // ============================================================
  {
    id: "tpl-flyer-grand-opening",
    name: "Grand Opening",
    category: "grand-opening",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["grand-opening", "launch", "event"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "GRAND OPENING", fontSize: 34, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.14, normalizedHeight: 0.16 }),
      shapeSeed({ shapeKind: "line", normalizedX: 0.3, normalizedY: 0.32, normalizedWidth: 0.4, normalizedHeight: 0.008, fill: "#D41414" }),
      textSeed({ content: "Saturday, June 14 · 10AM–6PM", fontSize: 16, normalizedY: 0.38, fill: "#5b5348" }),
      textSeed({ content: "123 Main Street", fontSize: 14, normalizedY: 0.46, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-sale",
    name: "Big Sale",
    category: "sale",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["sale", "discount", "promotion"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "SALE", fontSize: 64, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.14, normalizedHeight: 0.2, fill: "#D41414" }),
      textSeed({ content: "UP TO 40% OFF", fontSize: 22, bold: true, normalizedY: 0.36, letterSpacing: 1 }),
      textSeed({ content: "This weekend only", fontSize: 14, normalizedY: 0.45, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-real-estate",
    name: "For Sale",
    category: "real-estate",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["real-estate", "property", "for-sale"],
    linkedAssetIds: ["heroicons-building-office"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-building-office", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#171412" }),
      textSeed({ content: "FOR SALE", fontSize: 30, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.28, letterSpacing: 2 }),
      textSeed({ content: "$649,000 · 3 bed · 2 bath", fontSize: 15, normalizedY: 0.4, fill: "#5b5348" }),
      textSeed({ content: "Morgan Reyes · (555) 010-9021", fontSize: 13, normalizedY: 0.48, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-restaurant",
    name: "New Menu",
    category: "restaurant",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["restaurant", "menu", "food"],
    linkedAssetIds: ["maple-coffee-cup"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("maple-coffee-cup", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.16 }),
      textSeed({ content: "NEW MENU", fontSize: 28, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.28 }),
      textSeed({ content: "Now serving weekday brunch", fontSize: 14, normalizedY: 0.38, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-nightlife",
    name: "Tonight",
    category: "nightlife",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["nightlife", "party", "music"],
    linkedAssetIds: ["heroicons-musical-note"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-musical-note", { normalizedX: 0.4, normalizedY: 0.1, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#D41414" }),
      textSeed({ content: "TONIGHT", fontSize: 32, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.3, letterSpacing: 2 }),
      textSeed({ content: "DJ Set · 9PM · The Rooftop", fontSize: 15, normalizedY: 0.42, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-community",
    name: "Community Event",
    category: "church-community",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["community", "church", "event"],
    linkedAssetIds: ["heroicons-calendar"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-calendar", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#171412" }),
      textSeed({ content: "COMMUNITY EVENT", fontSize: 22, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.28 }),
      textSeed({ content: "Sunday, 11AM · Community Hall", fontSize: 14, normalizedY: 0.38, fill: "#5b5348" }),
      textSeed({ content: "Everyone welcome", fontSize: 13, normalizedY: 0.45, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-service",
    name: "Service Business",
    category: "service-business",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["service", "trades", "local"],
    linkedAssetIds: ["heroicons-wrench-screwdriver"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-wrench-screwdriver", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#171412" }),
      textSeed({ content: "WE FIX IT", fontSize: 28, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.28 }),
      textSeed({ content: "Same-day local service", fontSize: 14, normalizedY: 0.38, fill: "#5b5348" }),
      textSeed({ content: "(555) 010-4477", fontSize: 15, bold: true, normalizedY: 0.46 }),
    ],
  },
  {
    id: "tpl-flyer-qr-registration",
    name: "QR Registration",
    category: "qr-registration",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["qr", "registration", "event"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "REGISTER NOW", fontSize: 28, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.14, letterSpacing: 1 }),
      textSeed({ content: "Spots are limited — sign up today", fontSize: 13, normalizedY: 0.24, fill: "#5b5348" }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.32, normalizedY: 0.36, normalizedWidth: 0.36, normalizedHeight: 0.24 }),
      textSeed({ content: "ADD QR", fontSize: 11, align: "center", fill: "#9C9284", normalizedX: 0.32, normalizedY: 0.46, normalizedWidth: 0.36, normalizedHeight: 0.06 }),
      textSeed({ content: "SCAN TO REGISTER", fontSize: 11, letterSpacing: 1.5, normalizedY: 0.64, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-flyer-qr-ticket",
    name: "QR Tickets",
    category: "qr-ticket",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["qr", "tickets", "event"],
    linkedAssetIds: ["heroicons-ticket"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-ticket", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#D41414" }),
      textSeed({ content: "GET YOUR TICKETS", fontSize: 22, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.28 }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.32, normalizedY: 0.4, normalizedWidth: 0.36, normalizedHeight: 0.22 }),
      textSeed({ content: "ADD QR", fontSize: 11, align: "center", fill: "#9C9284", normalizedX: 0.32, normalizedY: 0.49, normalizedWidth: 0.36, normalizedHeight: 0.06 }),
    ],
  },
  {
    id: "tpl-flyer-social",
    name: "Follow Us",
    category: "social-media",
    thumbnailUrl: "",
    productFamilies: ["flyer"],
    compatiblePrintAreas: ["flyer-front"],
    orientation: "portrait",
    tags: ["social", "follow", "qr"],
    linkedAssetIds: ["heroicons-share"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      graphicSeed("heroicons-share", { normalizedX: 0.4, normalizedY: 0.1, normalizedWidth: 0.2, normalizedHeight: 0.16, fill: "#171412" }),
      textSeed({ content: "FOLLOW US", fontSize: 26, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.3, letterSpacing: 1 }),
      textSeed({ content: "@yourbusiness", fontSize: 14, normalizedY: 0.4, fill: "#5b5348" }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.36, normalizedY: 0.5, normalizedWidth: 0.28, normalizedHeight: 0.2 }),
    ],
  },

  // ============================================================
  // POSTERS — Section "POSTER TEMPLATE CATEGORIES". Portrait 18x24in box.
  // ============================================================
  {
    id: "tpl-poster-concert",
    name: "Live Concert",
    category: "concert",
    thumbnailUrl: "",
    productFamilies: ["poster"],
    compatiblePrintAreas: ["poster-front"],
    orientation: "portrait",
    tags: ["concert", "music", "live"],
    linkedAssetIds: ["heroicons-musical-note"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "LIVE", fontSize: 70, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.12, normalizedHeight: 0.16 }),
      graphicSeed("heroicons-musical-note", { normalizedX: 0.4, normalizedY: 0.32, normalizedWidth: 0.2, normalizedHeight: 0.14, fill: "#D41414" }),
      textSeed({ content: "THE MIDNIGHT SESSIONS", fontSize: 20, bold: true, normalizedY: 0.5, letterSpacing: 1.5 }),
      textSeed({ content: "Friday · 8PM · The Venue", fontSize: 14, normalizedY: 0.58, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-poster-sale",
    name: "Big Promotion",
    category: "sale",
    thumbnailUrl: "",
    productFamilies: ["poster"],
    compatiblePrintAreas: ["poster-front"],
    orientation: "portrait",
    tags: ["sale", "promotion", "poster"],
    linkedAssetIds: [],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "40% OFF", fontSize: 56, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.16, fill: "#D41414" }),
      textSeed({ content: "EVERYTHING IN STORE", fontSize: 20, bold: true, normalizedY: 0.34, letterSpacing: 1 }),
      textSeed({ content: "This week only", fontSize: 14, normalizedY: 0.42, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-poster-art",
    name: "Art Exhibition",
    category: "art",
    thumbnailUrl: "",
    productFamilies: ["poster"],
    compatiblePrintAreas: ["poster-front"],
    orientation: "portrait",
    tags: ["art", "exhibition", "gallery"],
    linkedAssetIds: [],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      shapeSeed({ shapeKind: "rectangle", fill: "transparent", strokeColor: "#171412", strokeWidth: 2, normalizedX: 0.14, normalizedY: 0.1, normalizedWidth: 0.72, normalizedHeight: 0.5 }),
      textSeed({ content: "EXHIBITION", fontSize: 26, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.66, letterSpacing: 3 }),
      textSeed({ content: "Works by River Osei · Opens March 3", fontSize: 13, normalizedY: 0.74, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-poster-announcement",
    name: "Announcement",
    category: "announcement",
    thumbnailUrl: "",
    productFamilies: ["poster"],
    compatiblePrintAreas: ["poster-front"],
    orientation: "portrait",
    tags: ["announcement", "news", "general"],
    linkedAssetIds: [],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "ANNOUNCEMENT", fontSize: 30, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.16, letterSpacing: 1 }),
      shapeSeed({ shapeKind: "line", normalizedX: 0.3, normalizedY: 0.32, normalizedWidth: 0.4, normalizedHeight: 0.008, fill: "#171412" }),
      textSeed({ content: "Your headline goes here", fontSize: 16, normalizedY: 0.4, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-poster-qr-cta",
    name: "Scan to Learn More",
    category: "qr-cta",
    thumbnailUrl: "",
    productFamilies: ["poster"],
    compatiblePrintAreas: ["poster-front"],
    orientation: "portrait",
    tags: ["qr", "call-to-action", "poster"],
    linkedAssetIds: [],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects: [
      textSeed({ content: "SCAN TO LEARN MORE", fontSize: 24, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.14, letterSpacing: 1 }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.3, normalizedY: 0.3, normalizedWidth: 0.4, normalizedHeight: 0.3 }),
      textSeed({ content: "ADD QR", fontSize: 12, align: "center", fill: "#9C9284", normalizedX: 0.3, normalizedY: 0.43, normalizedWidth: 0.4, normalizedHeight: 0.06 }),
      textSeed({ content: "yourbusiness.com", fontSize: 13, normalizedY: 0.66, fill: "#5b5348" }),
    ],
  },
];

// ===========================================================================================
// PRO COLLECTION — additive expansion, built by a THIRD, separate builder (pbuild, below) so
// neither the original collection (build()/SPECS) nor the Creative collection (cbuild()/
// CREATIVE_SPECS) above are touched or re-used in a way that could change their output. Same
// underlying TemplateObjectSeed shape via the same textSeed/shapeSeed/graphicSeed helpers — this
// is a richer AUTHORING format (art-directed, typography-first, deliberately varied compositions),
// not a second rendering/editor system. See this file's own top-of-file brief for the full spec
// this collection was built against.
// ===========================================================================================

interface ProSpec {
  id: string;
  name: string;
  category: TemplateCategory;
  style: NonNullable<DesignTemplate["style"]>;
  tags: string[];
  productFamilies?: ProductFamily[];
  compatiblePrintAreas?: DesignSideType[];
  shapes?: CreativeShape[];
  graphics?: CreativeGraphic[];
  lines: TemplateLine[];
  featured?: boolean;
}

/** Builder for the Pro collection. Structurally identical to cbuild() (same shapes/graphics/lines
 *  stacking order, same pre-colored-graphic technique) plus: a required `style` tag on the output,
 *  `collection: "pro"` instead of "creative", and honoring `line.textTransform`/`line.effectType`
 *  (both purely additive TemplateLine fields — see their own doc comments above; build()/cbuild()
 *  never read them, so this changes nothing about the older two collections). */
function pbuild(spec: ProSpec): DesignTemplate {
  const objects: TemplateObjectSeed[] = [];

  for (const s of spec.shapes ?? []) {
    objects.push(
      shapeSeed({
        shapeKind: s.shapeKind ?? "rectangle",
        normalizedX: s.x,
        normalizedY: s.y,
        normalizedWidth: s.w,
        normalizedHeight: s.h,
        fill: s.fill,
        strokeColor: s.strokeColor ?? null,
        strokeWidth: s.strokeWidth ?? null,
        rotation: s.rotation ?? 0,
        opacity: s.opacity ?? 1,
      }),
    );
  }

  for (const g of spec.graphics ?? []) {
    const seed = graphicSeed(`maple-${g.assetId}`, {
      normalizedX: g.x,
      normalizedY: g.y,
      normalizedWidth: g.w,
      normalizedHeight: g.h,
      fill: g.fill,
      rotation: g.rotation ?? 0,
      opacity: g.opacity ?? 1,
    });
    objects.push({
      ...seed,
      assetUrl: recolorMapleAsset(g.assetId, g.fill),
      content: null,
    });
  }

  for (const line of spec.lines) {
    objects.push(
      textSeed({
        content: line.text,
        fontSize: line.size,
        fontFamily: line.font ?? BODY_FONT,
        normalizedX: line.x ?? 0.1,
        normalizedY: line.y,
        normalizedWidth: line.width ?? 0.8,
        rotation: line.rotation ?? 0,
        bold: line.bold ?? false,
        italic: line.italic ?? false,
        letterSpacing: line.ls ?? 0,
        fill: line.fill ?? "#171412",
        curve: line.curve ?? null,
        align: line.align ?? "center",
        textTransform: line.textTransform,
        effectType: line.effectType,
        strokeColor: line.strokeColor ?? null,
        strokeWidth: line.strokeWidth ?? null,
      }),
    );
  }

  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    thumbnailUrl: "",
    productFamilies: spec.productFamilies ?? TEE_HOODIE,
    compatiblePrintAreas: spec.compatiblePrintAreas ?? ["front", "back", "left-chest"],
    tags: [...spec.tags, "pro"],
    linkedAssetIds: (spec.graphics ?? []).map((g) => `maple-${g.assetId}`),
    featured: spec.featured ?? false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: NOW,
    updatedAt: NOW,
    objects,
    collection: "pro",
    style: spec.style,
  };
}

const PRO_SPECS: ProSpec[] = [
  // ============================================================== BUSINESS / MODERN BRANDING (24)
  {
    id: "pro-biz-atelier",
    name: "Atelier Wordmark",
    category: "business",
    style: "modern",
    tags: ["business", "branding", "typography-led", "modern", "agency"],
    lines: [
      { text: "ATELIER", y: 0.36, size: 46, bold: true, font: "Archivo Black, sans-serif", fill: PALETTES.charcoalIce.a, align: "left", x: 0.07, width: 0.86, ls: -0.5 },
      { text: "CREATIVE STUDIO NO. 04", y: 0.53, size: 10, ls: 3, fill: PALETTES.charcoalIce.c, font: "Work Sans, sans-serif", align: "left", x: 0.08, width: 0.84 },
    ],
  },
  {
    id: "pro-biz-forge-ring",
    name: "Forge Ring Badge",
    category: "business",
    style: "corporate",
    tags: ["business", "branding", "badge", "emblem", "professional"],
    shapes: [{ x: 0.16, y: 0.05, w: 0.68, h: 0.58, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.navyOrange.a, strokeWidth: 3 }],
    graphics: [{ assetId: "gear", x: 0.4, y: 0.16, w: 0.2, h: 0.2, fill: PALETTES.navyOrange.a }],
    lines: [
      { text: "THE FORGE CO.", y: 0.4, size: 13, bold: true, font: "Oswald, sans-serif", fill: PALETTES.navyOrange.a, curve: 32, x: 0.16, width: 0.68 },
      { text: "MANUFACTURING", y: 0.54, size: 9, ls: 2, fill: PALETTES.navyOrange.b, x: 0.16, width: 0.68 },
    ],
  },
  {
    id: "pro-biz-northline",
    name: "Northline Minimal",
    category: "business",
    style: "minimal",
    tags: ["business", "minimal", "premium", "negative-space", "branding"],
    lines: [{ text: "NORTHLINE", y: 0.44, size: 30, bold: false, font: "Outfit, sans-serif", fill: PALETTES.blackGold.a, ls: 6, x: 0.05, width: 0.9 }],
  },
  {
    id: "pro-biz-monogram-crest",
    name: "Monogram Crest",
    category: "business",
    style: "luxury",
    tags: ["business", "monogram", "luxury", "initials", "elegant"],
    shapes: [{ x: 0.31, y: 0.07, w: 0.38, h: 0.38, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.blackGold.b, strokeWidth: 2 }],
    lines: [
      { text: "MH", y: 0.16, size: 34, bold: false, font: "Cinzel, sans-serif", fill: PALETTES.blackGold.b, x: 0.31, width: 0.38 },
      { text: "EST. MMXV", y: 0.5, size: 10, ls: 3, fill: PALETTES.blackGold.a, font: "Cormorant Garamond, serif" },
    ],
  },
  {
    id: "pro-biz-groundwork",
    name: "Groundwork Stack",
    category: "business",
    style: "bold",
    tags: ["business", "typography-led", "bold", "stacked", "branding"],
    lines: [
      { text: "GROUND", y: 0.26, size: 30, bold: true, font: "League Spartan, sans-serif", fill: PALETTES.terracottaCream.b, align: "left", x: 0.06, width: 0.9, ls: -0.5 },
      { text: "WORK", y: 0.41, size: 46, bold: true, font: "League Spartan, sans-serif", fill: PALETTES.terracottaCream.a, align: "left", x: 0.06, width: 0.9, ls: -0.5 },
      { text: "OPERATIONS CO.", y: 0.62, size: 10, ls: 2, fill: PALETTES.terracottaCream.b, align: "left", x: 0.06, width: 0.9 },
    ],
  },
  {
    id: "pro-biz-corner-mark",
    name: "Corner Mark",
    category: "business",
    style: "corporate",
    tags: ["business", "minimal", "corner-mark", "branding", "professional"],
    shapes: [{ x: 0.08, y: 0.1, w: 0.14, h: 0.14, fill: PALETTES.denimWhite.a }],
    lines: [
      { text: "VESTRA", y: 0.32, size: 26, bold: true, font: "Barlow, sans-serif", fill: PALETTES.denimWhite.a, align: "right", x: 0.1, width: 0.84 },
      { text: "PARTNERS", y: 0.44, size: 12, ls: 4, fill: PALETTES.denimWhite.b, align: "right", x: 0.1, width: 0.84 },
    ],
  },
  {
    id: "pro-biz-ledger",
    name: "Ledger Rule",
    category: "business",
    style: "corporate",
    tags: ["business", "typography-led", "underline", "professional", "clean"],
    shapes: [{ x: 0.12, y: 0.44, w: 0.76, h: 0.012, fill: PALETTES.slateSteel.a }],
    lines: [
      { text: "LEDGER & CO.", y: 0.34, size: 24, bold: true, font: "DM Sans, sans-serif", fill: PALETTES.slateSteel.a, ls: 1 },
      { text: "ACCOUNTING · ADVISORY", y: 0.47, size: 9, ls: 2, fill: PALETTES.slateSteel.a },
    ],
  },
  {
    id: "pro-biz-parlor",
    name: "The Parlor",
    category: "business",
    style: "elegant",
    tags: ["business", "illustrative", "elegant", "boutique"],
    graphics: [{ assetId: "monogram-frame", x: 0.62, y: 0.08, w: 0.28, h: 0.28, fill: PALETTES.oxbloodCream.a, rotation: 6 }],
    lines: [
      { text: "The Parlor", y: 0.2, size: 24, italic: true, font: "DM Serif Display, serif", fill: PALETTES.oxbloodCream.a, align: "left", x: 0.08, width: 0.5 },
      { text: "HAIR · SKIN · STYLE", y: 0.34, size: 9, ls: 2, fill: PALETTES.oxbloodCream.a, align: "left", x: 0.08, width: 0.5 },
    ],
  },
  {
    id: "pro-biz-modern-mark",
    name: "Modern Square Mark",
    category: "business",
    style: "modern",
    tags: ["business", "minimal", "geometric", "logo", "modern"],
    shapes: [{ x: 0.08, y: 0.32, w: 0.18, h: 0.18, fill: PALETTES.navyOrange.b }],
    lines: [
      { text: "AXIOM", y: 0.28, size: 26, bold: true, font: "Rubik, sans-serif", fill: PALETTES.navyOrange.a, align: "left", x: 0.32, width: 0.62 },
      { text: "DIGITAL AGENCY", y: 0.4, size: 9, ls: 3, fill: PALETTES.navyOrange.a, align: "left", x: 0.32, width: 0.62 },
    ],
  },
  {
    id: "pro-biz-vantage",
    name: "Vantage Diagonal",
    category: "business",
    style: "bold",
    tags: ["business", "typography-led", "diagonal", "bold", "branding"],
    shapes: [{ x: -0.06, y: 0.36, w: 1.12, h: 0.14, fill: PALETTES.cyanNavy.b, rotation: -6 }],
    lines: [
      { text: "VANTAGE", y: 0.24, size: 32, bold: true, font: "Anton, sans-serif", fill: PALETTES.cyanNavy.b, ls: 1 },
      { text: "GROUP", y: 0.56, size: 20, bold: true, font: "Anton, sans-serif", fill: PALETTES.cyanNavy.a, ls: 4 },
    ],
  },
  {
    id: "pro-biz-heritage-seal",
    name: "Heritage Seal",
    category: "business",
    style: "vintage",
    tags: ["business", "badge", "vintage", "heritage", "seal"],
    graphics: [{ assetId: "laurel", x: 0.24, y: 0.06, w: 0.52, h: 0.5, fill: PALETTES.espressoCream.a }],
    lines: [
      { text: "1994", y: 0.24, size: 18, bold: true, fill: PALETTES.espressoCream.a },
      { text: "HERITAGE TRADING CO.", y: 0.505, size: 9, ls: 1, fill: PALETTES.espressoCream.a, x: 0.08, width: 0.84 },
    ],
  },
  {
    id: "pro-biz-craft-supply",
    name: "Craft Supply Co.",
    category: "business",
    style: "corporate",
    tags: ["business", "illustrative", "corner-mark", "supply", "professional"],
    graphics: [{ assetId: "gear", x: 0.68, y: 0.36, w: 0.22, h: 0.22, fill: PALETTES.oliveTan.b, rotation: -10 }],
    lines: [
      { text: "CRAFT", y: 0.26, size: 30, bold: true, font: "Barlow Condensed, sans-serif", fill: PALETTES.oliveTan.a, align: "left", x: 0.07, width: 0.7 },
      { text: "SUPPLY CO.", y: 0.4, size: 16, bold: true, font: "Barlow Condensed, sans-serif", fill: PALETTES.oliveTan.b, align: "left", x: 0.07, width: 0.7, ls: 2 },
    ],
  },
  {
    id: "pro-biz-signature",
    name: "Signature Initial",
    category: "business",
    style: "luxury",
    tags: ["business", "monogram", "luxury", "signature", "script"],
    lines: [
      { text: "R", y: 0.18, size: 52, font: "Cormorant Garamond, serif", fill: PALETTES.blackGold.b, x: 0.35, width: 0.3 },
      { text: "Reyes & Wolfe", y: 0.5, size: 16, italic: true, font: "Cormorant Garamond, serif", fill: PALETTES.blackGold.a },
      { text: "LEGAL COUNSEL", y: 0.62, size: 9, ls: 3, fill: PALETTES.blackGold.b },
    ],
  },
  {
    id: "pro-biz-southbank",
    name: "Southbank Duotone",
    category: "business",
    style: "modern",
    tags: ["business", "duotone", "typography-led", "modern", "block"],
    shapes: [{ x: 0, y: 0, w: 1, h: 0.5, fill: PALETTES.denimWhite.a }],
    lines: [
      { text: "SOUTHBANK", y: 0.14, size: 22, bold: true, font: "Plus Jakarta Sans, sans-serif", fill: PALETTES.denimWhite.b, ls: 1 },
      { text: "CONSULTING", y: 0.58, size: 16, bold: true, font: "Plus Jakarta Sans, sans-serif", fill: PALETTES.denimWhite.a, ls: 4 },
    ],
  },
  {
    id: "pro-biz-founders-ribbon",
    name: "Founders Ribbon",
    category: "business",
    style: "corporate",
    tags: ["business", "ribbon", "banner", "established", "professional"],
    shapes: [{ x: 0.1, y: 0.42, w: 0.8, h: 0.16, fill: PALETTES.burgundyGold.a }],
    lines: [
      { text: "FOUNDERS' CIRCLE", y: 0.455, size: 15, bold: true, font: "Oswald, sans-serif", fill: PALETTES.burgundyGold.c, ls: 1 },
      { text: "MEMBER SINCE 2011", y: 0.3, size: 10, ls: 2, fill: PALETTES.burgundyGold.a },
    ],
  },
  {
    id: "pro-biz-quiet-luxury",
    name: "Quiet Luxury",
    category: "business",
    style: "luxury",
    tags: ["business", "minimal", "luxury", "premium", "understated"],
    lines: [
      { text: "M A I S O N", y: 0.42, size: 18, font: "EB Garamond, serif", fill: PALETTES.blackGold.a, ls: 6 },
      { text: "no. 7", y: 0.54, size: 11, italic: true, font: "Cormorant Garamond, serif", fill: PALETTES.blackGold.b },
    ],
  },
  {
    id: "pro-biz-blueprint",
    name: "Blueprint Grid",
    category: "business",
    style: "corporate",
    tags: ["business", "grid", "typography-led", "professional", "engineering"],
    shapes: [
      { x: 0.1, y: 0.32, w: 0.8, h: 0.002, fill: PALETTES.cobaltChalk.a },
      { x: 0.1, y: 0.5, w: 0.8, h: 0.002, fill: PALETTES.cobaltChalk.a },
    ],
    lines: [
      { text: "BLUEPRINT", y: 0.34, size: 20, bold: true, font: "IBM Plex Mono, monospace", fill: PALETTES.cobaltChalk.a, ls: 1 },
      { text: "ENGINEERING GROUP", y: 0.44, size: 9, ls: 2, fill: PALETTES.cobaltChalk.a },
    ],
  },
  {
    id: "pro-biz-emblem-oval",
    name: "Emblem Oval",
    category: "business",
    style: "corporate",
    tags: ["business", "badge", "emblem", "oval", "professional"],
    shapes: [{ x: 0.15, y: 0.08, w: 0.7, h: 0.46, shapeKind: "circle", fill: PALETTES.forestCream.a }],
    graphics: [{ assetId: "briefcase", x: 0.4, y: 0.14, w: 0.2, h: 0.2, fill: PALETTES.forestCream.b }],
    lines: [
      { text: "CONSULATE GROUP", y: 0.37, size: 12, bold: true, fill: PALETTES.forestCream.b, curve: -24, x: 0.15, width: 0.7 },
      { text: "STRATEGY · GROWTH", y: 0.56, size: 9, ls: 1, fill: PALETTES.forestCream.a },
    ],
  },
  {
    id: "pro-biz-open-type",
    name: "Open Type Statement",
    category: "business",
    style: "modern",
    tags: ["business", "typography-led", "full-bleed", "statement", "modern"],
    lines: [
      { text: "BUILT ON", y: 0.28, size: 24, font: "Raleway, sans-serif", fill: PALETTES.charcoalIce.c, align: "left", x: 0.07, width: 0.86 },
      { text: "TRUST.", y: 0.4, size: 44, bold: true, font: "Raleway, sans-serif", fill: PALETTES.charcoalIce.a, align: "left", x: 0.07, width: 0.86, ls: -1 },
    ],
  },
  {
    id: "pro-biz-side-tab",
    name: "Side Tab Block",
    category: "business",
    style: "modern",
    tags: ["business", "asymmetric", "side-aligned", "typography-led", "modern"],
    shapes: [{ x: 0, y: 0.1, w: 0.05, h: 0.55, fill: PALETTES.mossGold.b }],
    lines: [
      { text: "PINE &", y: 0.24, size: 24, bold: true, font: "Cabin, sans-serif", fill: PALETTES.mossGold.a, align: "left", x: 0.12, width: 0.8 },
      { text: "HOLLOW CO.", y: 0.37, size: 24, bold: true, font: "Cabin, sans-serif", fill: PALETTES.mossGold.a, align: "left", x: 0.12, width: 0.8 },
      { text: "SUSTAINABLE GOODS", y: 0.53, size: 9, ls: 2, fill: PALETTES.mossGold.b, align: "left", x: 0.12, width: 0.8 },
    ],
  },
  {
    id: "pro-biz-shield-line",
    name: "Shield Line Mark",
    category: "business",
    style: "corporate",
    tags: ["business", "badge", "shield", "professional", "trust"],
    graphics: [{ assetId: "shield", x: 0.4, y: 0.06, w: 0.2, h: 0.22, fill: PALETTES.crimsonInk.a }],
    shapes: [{ x: 0.2, y: 0.36, w: 0.6, h: 0.006, fill: PALETTES.crimsonInk.a }],
    lines: [
      { text: "SENTRY GROUP", y: 0.4, size: 15, bold: true, font: "Archivo, sans-serif", fill: PALETTES.crimsonInk.a, ls: 1 },
      { text: "RISK & COMPLIANCE", y: 0.51, size: 9, ls: 2, fill: PALETTES.crimsonInk.b },
    ],
  },
  {
    id: "pro-biz-editorial",
    name: "Editorial Serif",
    category: "business",
    style: "elegant",
    tags: ["business", "typography-led", "editorial", "serif", "elegant"],
    lines: [
      { text: "The Standard", y: 0.32, size: 30, italic: true, font: "Playfair Display, serif", fill: PALETTES.oxbloodCream.a },
      { text: "OF EXCELLENCE", y: 0.48, size: 11, ls: 4, fill: PALETTES.oxbloodCream.a },
    ],
  },
  {
    id: "pro-biz-tilt-tag",
    name: "Tilted Tag",
    category: "business",
    style: "bold",
    tags: ["business", "rotation", "overlap", "typography-led", "bold"],
    shapes: [{ x: 0.14, y: 0.12, w: 0.72, h: 0.5, fill: PALETTES.inkSaffron.a, rotation: -4 }],
    lines: [
      { text: "THE STUDIO", y: 0.28, size: 22, bold: true, font: "Righteous, sans-serif", fill: PALETTES.inkSaffron.b, rotation: -4 },
      { text: "CREATIVE WORKS", y: 0.42, size: 10, ls: 3, fill: PALETTES.inkSaffron.c, rotation: -4 },
    ],
  },
  {
    id: "pro-biz-arch-frame",
    name: "Arch Frame Mark",
    category: "business",
    style: "elegant",
    tags: ["business", "illustrative", "frame", "elegant", "boutique"],
    graphics: [{ assetId: "monogram-frame", x: 0.34, y: 0.05, w: 0.32, h: 0.32, fill: PALETTES.plumBlush.a }],
    lines: [
      { text: "V", y: 0.13, size: 26, font: "Bodoni Moda, serif", fill: PALETTES.plumBlush.a, x: 0.34, width: 0.32 },
      { text: "VESSEL & CO.", y: 0.44, size: 13, ls: 3, fill: PALETTES.plumBlush.a },
    ],
  },

  // ============================================================== MINIMAL / PREMIUM (11)
  {
    id: "pro-min-single-word",
    name: "Single Word Statement",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "typography-led", "negative-space"],
    lines: [{ text: "quiet.", y: 0.42, size: 34, font: "Newsreader, serif", italic: true, fill: "#171412" }],
  },
  {
    id: "pro-min-two-tone-block",
    name: "Two Tone Block",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "duotone", "block"],
    shapes: [{ x: 0.3, y: 0.14, w: 0.4, h: 0.4, fill: PALETTES.charcoalIce.a }],
    lines: [{ text: "FORM", y: 0.28, size: 20, bold: true, font: "Karla, sans-serif", fill: PALETTES.charcoalIce.b, ls: 4 }],
  },
  {
    id: "pro-min-thin-rule",
    name: "Thin Rule Mark",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "underline", "rule-accent"],
    shapes: [{ x: 0.32, y: 0.5, w: 0.36, h: 0.006, fill: "#171412" }],
    lines: [{ text: "LESS", y: 0.38, size: 26, font: "Quicksand, sans-serif", ls: 8 }],
  },
  {
    id: "pro-min-corner-dot",
    name: "Corner Dot",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "corner-mark", "geometric"],
    shapes: [{ x: 0.66, y: 0.2, w: 0.06, h: 0.06, shapeKind: "circle", fill: PALETTES.navyOrange.b }],
    lines: [{ text: "SILO", y: 0.36, size: 30, bold: true, font: "Work Sans, sans-serif", align: "left", x: 0.1, width: 0.5, ls: 1 }],
  },
  {
    id: "pro-min-monogram-thin",
    name: "Thin Monogram",
    category: "minimal",
    style: "luxury",
    tags: ["minimal", "monogram", "luxury", "premium"],
    lines: [{ text: "A · V", y: 0.42, size: 28, font: "Cormorant Garamond, serif", ls: 4, fill: PALETTES.blackGold.a }],
  },
  {
    id: "pro-min-vertical-word",
    name: "Vertical Word Block",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "asymmetric", "side-aligned"],
    shapes: [{ x: 0.1, y: 0.14, w: 0.012, h: 0.5, fill: "#171412" }],
    lines: [
      { text: "PURE", y: 0.24, size: 22, bold: true, font: "Montserrat, sans-serif", align: "left", x: 0.16, width: 0.7, ls: 2 },
      { text: "FORM STUDIO", y: 0.5, size: 9, ls: 3, fill: "#5b5348", align: "left", x: 0.16, width: 0.7 },
    ],
  },
  {
    id: "pro-min-offset-square",
    name: "Offset Square",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "asymmetric", "geometric"],
    shapes: [{ x: 0.62, y: 0.42, w: 0.22, h: 0.22, fill: PALETTES.forestCream.a }],
    lines: [{ text: "NOWA", y: 0.28, size: 28, bold: true, font: "Urbanist, sans-serif", align: "left", x: 0.08, width: 0.5, ls: 1 }],
  },
  {
    id: "pro-min-serif-italic",
    name: "Serif Italic Mark",
    category: "minimal",
    style: "elegant",
    tags: ["minimal", "elegant", "premium", "typography-led"],
    lines: [{ text: "Almost.", y: 0.42, size: 32, italic: true, font: "Lora, serif", fill: PALETTES.espressoCream.a }],
  },
  {
    id: "pro-min-bracket-mark",
    name: "Bracket Mark",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "bracket", "geometric"],
    lines: [
      { text: "[ EVEN ]", y: 0.4, size: 24, font: "Space Mono, monospace", fill: "#171412", ls: 1 },
    ],
  },
  {
    id: "pro-min-tag-line",
    name: "Tagline Duo",
    category: "minimal",
    style: "minimal",
    tags: ["minimal", "premium", "typography-led", "two-line"],
    lines: [
      { text: "small studio.", y: 0.4, size: 20, italic: true, font: "Spectral, serif", fill: "#171412" },
      { text: "BIG IDEAS", y: 0.52, size: 10, ls: 4, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-min-hollow-outline",
    name: "Hollow Outline Word",
    category: "minimal",
    style: "modern",
    tags: ["minimal", "premium", "outline", "modern"],
    lines: [{ text: "OPEN", y: 0.36, size: 46, bold: true, font: "Poppins, sans-serif", fill: "#F7F4EE", effectType: "hollow" }],
  },

  // ============================================================== CAFE / RESTAURANT / FOOD (10)
  {
    id: "pro-cafe-daily-press",
    name: "Daily Press",
    category: "food-cafe",
    style: "corporate",
    tags: ["cafe", "coffee", "typography-led", "masthead"],
    shapes: [{ x: 0.1, y: 0.3, w: 0.8, h: 0.004, fill: PALETTES.espressoCream.a }, { x: 0.1, y: 0.5, w: 0.8, h: 0.004, fill: PALETTES.espressoCream.a }],
    lines: [
      { text: "THE DAILY PRESS", y: 0.32, size: 20, bold: true, font: "Abril Fatface, serif", fill: PALETTES.espressoCream.a },
      { text: "COFFEE ROASTERS · EST. 2016", y: 0.44, size: 9, ls: 1, fill: PALETTES.espressoCream.b },
    ],
  },
  {
    id: "pro-cafe-corner-bean",
    name: "Corner Bean Mark",
    category: "food-cafe",
    style: "retro",
    tags: ["cafe", "coffee", "illustrative", "corner-mark"],
    graphics: [{ assetId: "coffee-bean", x: 0.66, y: 0.1, w: 0.2, h: 0.22, fill: PALETTES.espressoCream.a, rotation: -8 }],
    lines: [
      { text: "GRIST MILL", y: 0.3, size: 22, bold: true, font: "Bitter, serif", fill: PALETTES.espressoCream.a, align: "left", x: 0.07, width: 0.6 },
      { text: "COFFEE & CO.", y: 0.42, size: 11, ls: 2, fill: PALETTES.espressoCream.b, align: "left", x: 0.07, width: 0.6 },
    ],
  },
  {
    id: "pro-cafe-badge-roast",
    name: "Roast Badge",
    category: "food-cafe",
    style: "vintage",
    tags: ["cafe", "coffee", "badge", "emblem", "vintage"],
    shapes: [{ x: 0.2, y: 0.06, w: 0.6, h: 0.54, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.duneRust.b, strokeWidth: 3 }],
    graphics: [{ assetId: "coffee-cup", x: 0.4, y: 0.14, w: 0.2, h: 0.2, fill: PALETTES.duneRust.b }],
    lines: [
      { text: "SMALL BATCH ROAST", y: 0.38, size: 11, bold: true, fill: PALETTES.duneRust.b, curve: 28, x: 0.2, width: 0.6 },
      { text: "OTTAWA, ON", y: 0.52, size: 9, ls: 2, fill: PALETTES.duneRust.c },
    ],
  },
  {
    id: "pro-cafe-bakery-script",
    name: "Bakery Script",
    category: "food-cafe",
    style: "elegant",
    tags: ["bakery", "food", "typography-led", "script", "elegant"],
    lines: [
      { text: "Nettle & Rye", y: 0.36, size: 26, italic: true, font: "Playfair Display, serif", fill: PALETTES.terracottaCream.b },
      { text: "BAKED FRESH DAILY", y: 0.5, size: 10, ls: 2, fill: PALETTES.terracottaCream.a },
    ],
  },
  {
    id: "pro-cafe-wheat-mark",
    name: "Wheat Mark",
    category: "food-cafe",
    style: "retro",
    tags: ["bakery", "food", "illustrative", "wheat"],
    graphics: [{ assetId: "wheat", x: 0.38, y: 0.07, w: 0.24, h: 0.3, fill: PALETTES.mossGold.b }],
    lines: [{ text: "HARVEST BAKERY", y: 0.44, size: 16, bold: true, font: "Merriweather, serif", fill: PALETTES.mossGold.a }],
  },
  {
    id: "pro-cafe-diner-block",
    name: "Diner Block",
    category: "food-cafe",
    style: "bold",
    tags: ["restaurant", "food", "bold", "block", "diner"],
    shapes: [{ x: 0.06, y: 0.28, w: 0.88, h: 0.24, fill: PALETTES.crimsonInk.a }],
    lines: [
      { text: "ROUTE 9", y: 0.32, size: 26, bold: true, font: "Alfa Slab One, sans-serif", fill: PALETTES.crimsonInk.c },
      { text: "DINER", y: 0.44, size: 14, ls: 6, fill: PALETTES.crimsonInk.c },
    ],
  },
  {
    id: "pro-cafe-kitchen-crew-min",
    name: "Kitchen Crew Minimal",
    category: "food-cafe",
    style: "minimal",
    tags: ["restaurant", "staff", "minimal", "typography-led"],
    lines: [
      { text: "KITCHEN", y: 0.4, size: 26, font: "Work Sans, sans-serif", ls: 6, align: "left", x: 0.1, width: 0.8 },
      { text: "CREW", y: 0.5, size: 26, bold: true, font: "Work Sans, sans-serif", ls: 6, align: "left", x: 0.1, width: 0.8 },
    ],
  },
  {
    id: "pro-cafe-chef-crest",
    name: "Chef Crest",
    category: "food-cafe",
    style: "corporate",
    tags: ["restaurant", "kitchen", "badge", "illustrative", "chef"],
    graphics: [{ assetId: "chef-hat", x: 0.36, y: 0.06, w: 0.28, h: 0.26, fill: PALETTES.oxbloodCream.a }],
    lines: [
      { text: "MAISON", y: 0.38, size: 14, bold: true, font: "Bodoni Moda, serif", fill: PALETTES.oxbloodCream.a },
      { text: "CULINAIRE", y: 0.49, size: 10, ls: 3, fill: PALETTES.oxbloodCream.a },
    ],
  },
  {
    id: "pro-cafe-street-food",
    name: "Street Food Stack",
    category: "food-cafe",
    style: "streetwear",
    tags: ["food truck", "street food", "expressive", "bold", "stacked"],
    shapes: [{ x: 0.04, y: 0.34, w: 0.9, h: 0.1, fill: PALETTES.inkSaffron.b, rotation: 3 }],
    lines: [
      { text: "STREET", y: 0.22, size: 26, bold: true, font: "Bungee, sans-serif", fill: PALETTES.inkSaffron.a },
      { text: "EATS CO.", y: 0.36, size: 16, bold: true, font: "Bungee, sans-serif", fill: PALETTES.inkSaffron.a, rotation: 3 },
    ],
  },
  {
    id: "pro-cafe-pasta-house",
    name: "Pasta House",
    category: "food-cafe",
    style: "elegant",
    tags: ["restaurant", "italian", "typography-led", "elegant"],
    lines: [
      { text: "TAVOLA", y: 0.36, size: 30, italic: true, font: "Cormorant Garamond, serif", fill: PALETTES.oxbloodCream.a },
      { text: "RISTORANTE ITALIANO", y: 0.52, size: 10, ls: 2, fill: PALETTES.oxbloodCream.a },
    ],
  },

  // ============================================================== STREETWEAR / FASHION (12)
  {
    id: "pro-street-graffiti-drip",
    name: "Graffiti Drip",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "urban", "bold", "gritty"],
    lines: [{ text: "RIOT", y: 0.32, size: 60, bold: true, font: "Bungee Shade, sans-serif", fill: "#171412", rotation: -4 }],
  },
  {
    id: "pro-street-overlap-stack",
    name: "Overlap Stack",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "overlap", "scale-contrast"],
    lines: [
      { text: "NO", y: 0.2, size: 60, bold: true, font: "Archivo Black, sans-serif", fill: PALETTES.graphiteLime.b, rotation: -6 },
      { text: "RULES", y: 0.42, size: 34, bold: true, font: "Archivo Black, sans-serif", fill: PALETTES.graphiteLime.a, rotation: -6 },
    ],
  },
  {
    id: "pro-street-hollow-tag",
    name: "Hollow Tag",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "outline", "urban"],
    lines: [{ text: "GRIT", y: 0.32, size: 58, bold: true, font: "Anton, sans-serif", fill: "#171412", effectType: "hollow", strokeColor: "#171412", strokeWidth: 2 }],
  },
  {
    id: "pro-street-patchwork",
    name: "Patchwork Block",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "block", "duotone", "bold"],
    shapes: [
      { x: 0, y: 0, w: 0.5, h: 1, fill: PALETTES.graphiteLime.a },
      { x: 0.5, y: 0, w: 0.5, h: 1, fill: "#171412" },
    ],
    lines: [{ text: "REBEL", y: 0.42, size: 26, bold: true, font: "Black Ops One, sans-serif", fill: PALETTES.graphiteLime.b, ls: 1 }],
  },
  {
    id: "pro-street-corner-tag",
    name: "Corner Tag",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "corner-mark", "expressive", "urban"],
    shapes: [{ x: 0.62, y: 0.08, w: 0.24, h: 0.08, fill: PALETTES.crimsonInk.a, rotation: -8 }],
    lines: [
      { text: "AFTER", y: 0.28, size: 20, ls: 8, fill: "#171412" },
      { text: "HOURS", y: 0.4, size: 44, bold: true, font: "Anton, sans-serif", fill: "#171412", ls: -1 },
    ],
  },
  {
    id: "pro-street-varsity-drop",
    name: "Varsity Drop Shadow",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "bold", "collegiate", "urban"],
    lines: [{ text: "STATIC", y: 0.34, size: 48, bold: true, font: "League Spartan, sans-serif", fill: "#171412", effectType: "lift" }],
  },
  {
    id: "pro-street-rotated-badge",
    name: "Rotated Diamond Badge",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "badge", "expressive", "geometric"],
    graphics: [{ assetId: "abstract-diamond", x: 0.32, y: 0.06, w: 0.36, h: 0.36, fill: "#171412", rotation: 8 }],
    lines: [{ text: "ROGUE", y: 0.5, size: 20, bold: true, font: "Righteous, sans-serif", fill: "#171412", ls: 4 }],
  },
  {
    id: "pro-street-tape-label",
    name: "Tape Label",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "label", "urban", "grunge"],
    shapes: [{ x: -0.05, y: 0.32, w: 1.1, h: 0.18, fill: PALETTES.graphiteLime.b, rotation: -3 }],
    lines: [{ text: "CAUTION: FRESH", y: 0.375, size: 15, bold: true, font: "Teko, sans-serif", fill: "#171412", ls: 3, rotation: -3 }],
  },
  {
    id: "pro-street-fire-icon",
    name: "Fire Icon Stack",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "illustrative", "expressive", "flame"],
    graphics: [{ assetId: "flame", x: 0.4, y: 0.06, w: 0.2, h: 0.26, fill: PALETTES.crimsonInk.a }],
    lines: [{ text: "TOO HOT", y: 0.42, size: 30, bold: true, font: "Bebas Neue, sans-serif", fill: "#171412", ls: 2 }],
  },
  {
    id: "pro-street-minimal-tag",
    name: "Minimal Street Tag",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "minimal", "typography-led", "clean"],
    lines: [{ text: "STILL HERE", y: 0.42, size: 26, font: "Space Mono, monospace", ls: 1, fill: "#171412" }],
  },
  {
    id: "pro-street-crown-drip",
    name: "Crown Drip",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "illustrative", "crown", "expressive"],
    graphics: [{ assetId: "crown", x: 0.36, y: 0.08, w: 0.28, h: 0.24, fill: PALETTES.mossGold.b, rotation: -6 }],
    lines: [{ text: "REIGN", y: 0.42, size: 34, bold: true, italic: true, font: "Archivo Black, sans-serif", fill: "#171412", ls: 1, rotation: -6 }],
  },
  {
    id: "pro-street-slash-type",
    name: "Slash Type",
    category: "streetwear",
    style: "streetwear",
    tags: ["streetwear", "expressive", "diagonal", "bold"],
    shapes: [{ x: 0.46, y: 0.05, w: 0.03, h: 0.6, fill: "#171412", rotation: 20 }],
    lines: [
      { text: "DAY", y: 0.28, size: 34, bold: true, font: "Barlow Condensed, sans-serif", fill: "#171412", align: "left", x: 0.06, width: 0.42 },
      { text: "NIGHT", y: 0.42, size: 34, bold: true, font: "Barlow Condensed, sans-serif", fill: "#171412", align: "right", x: 0.52, width: 0.42 },
    ],
  },

  // ============================================================== SPORTS / VARSITY (10)
  {
    id: "pro-sport-shield-crest",
    name: "Shield Crest",
    category: "sports",
    style: "sport",
    tags: ["sports", "badge", "emblem", "varsity", "team"],
    graphics: [{ assetId: "shield", x: 0.28, y: 0.05, w: 0.44, h: 0.42, fill: PALETTES.navyOrange.a }],
    lines: [
      { text: "HAWKS", y: 0.15, size: 15, bold: true, fill: PALETTES.navyOrange.b, curve: 40, x: 0.28, width: 0.44 },
      { text: "ATHLETIC CLUB", y: 0.5, size: 10, ls: 2, fill: PALETTES.navyOrange.a },
    ],
    featured: true,
  },
  {
    id: "pro-sport-varsity-arch",
    name: "Varsity Arch",
    category: "sports",
    style: "sport",
    tags: ["sports", "typography-led", "collegiate", "curve"],
    lines: [
      { text: "CHAMPIONS", y: 0.2, size: 16, bold: true, fill: PALETTES.purpleGold.a, curve: 46, ls: 1 },
      { text: "24", y: 0.5, size: 40, bold: true, font: "Anton, sans-serif", fill: PALETTES.purpleGold.a },
    ],
  },
  {
    id: "pro-sport-number-block",
    name: "Number Block",
    category: "sports",
    style: "bold",
    tags: ["sports", "expressive", "bold", "number", "team"],
    shapes: [{ x: 0.14, y: 0.1, w: 0.72, h: 0.5, fill: PALETTES.royalBlue.a }],
    lines: [
      { text: "07", y: 0.16, size: 48, bold: true, font: "Anton, sans-serif", fill: PALETTES.royalBlue.b },
      { text: "RIVERSIDE", y: 0.44, size: 12, ls: 4, fill: PALETTES.royalBlue.b },
    ],
  },
  {
    id: "pro-sport-trophy-mark",
    name: "Trophy Mark",
    category: "sports",
    style: "sport",
    tags: ["sports", "illustrative", "trophy", "champion"],
    graphics: [{ assetId: "trophy", x: 0.38, y: 0.06, w: 0.24, h: 0.28, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "LEAGUE CHAMPS", y: 0.4, size: 14, bold: true, font: "Oswald, sans-serif", fill: PALETTES.blackGold.a },
      { text: "SEASON 2026", y: 0.51, size: 9, ls: 2, fill: PALETTES.blackGold.b },
    ],
  },
  {
    id: "pro-sport-diagonal-team",
    name: "Diagonal Team Bar",
    category: "sports",
    style: "bold",
    tags: ["sports", "expressive", "diagonal", "team", "bold"],
    shapes: [{ x: -0.06, y: 0.36, w: 1.12, h: 0.16, fill: PALETTES.redCream.a, rotation: -5 }],
    lines: [{ text: "WOLVES", y: 0.4, size: 24, bold: true, font: "Teko, sans-serif", fill: PALETTES.redCream.b, ls: 2, rotation: -5 }],
  },
  {
    id: "pro-sport-ring-mono",
    name: "Ring Monogram Team",
    category: "sports",
    style: "corporate",
    tags: ["sports", "minimal", "monogram", "ring", "team"],
    shapes: [{ x: 0.28, y: 0.08, w: 0.44, h: 0.44, shapeKind: "circle", fill: "transparent", strokeColor: "#171412", strokeWidth: 3 }],
    lines: [{ text: "FC", y: 0.2, size: 32, bold: true, font: "League Spartan, sans-serif", x: 0.28, width: 0.44 }],
  },
  {
    id: "pro-sport-condensed-stack",
    name: "Condensed Stack",
    category: "sports",
    style: "sport",
    tags: ["sports", "typography-led", "condensed", "team", "bold"],
    lines: [
      { text: "IRON", y: 0.24, size: 34, bold: true, font: "Saira Condensed, sans-serif", ls: 2 },
      { text: "PEAK ATHLETICS", y: 0.4, size: 12, ls: 3, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-sport-coach-tag",
    name: "Coach Tag",
    category: "sports",
    style: "minimal",
    tags: ["sports", "coach", "minimal", "staff"],
    lines: [
      { text: "COACHING STAFF", y: 0.42, size: 16, ls: 4, font: "Rajdhani, sans-serif", bold: true, align: "left", x: 0.1, width: 0.8 },
    ],
    shapes: [{ x: 0.1, y: 0.5, w: 0.3, h: 0.008, fill: "#171412" }],
  },
  {
    id: "pro-sport-puck-badge",
    name: "Puck Badge",
    category: "sports",
    style: "sport",
    tags: ["hockey", "sports", "illustrative", "badge"],
    graphics: [{ assetId: "puck", x: 0.35, y: 0.1, w: 0.3, h: 0.16, fill: "#171412" }],
    lines: [
      { text: "ICE DIVISION", y: 0.36, size: 15, bold: true, font: "Oswald, sans-serif" },
      { text: "HOCKEY CLUB", y: 0.46, size: 10, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-sport-est-line",
    name: "Established Line",
    category: "sports",
    style: "vintage",
    tags: ["sports", "vintage", "typography-led", "team", "established"],
    shapes: [{ x: 0.28, y: 0.5, w: 0.44, h: 0.006, fill: PALETTES.forestCream.a }],
    lines: [
      { text: "RIVER CITY", y: 0.32, size: 22, bold: true, font: "Fjalla One, sans-serif", fill: PALETTES.forestCream.a },
      { text: "EST. 1978", y: 0.53, size: 10, ls: 3, fill: PALETTES.forestCream.b },
    ],
  },

  // ============================================================== AUTOMOTIVE / MOTORSPORT (10)
  {
    id: "pro-auto-speed-lines-type",
    name: "Speed Lines Type",
    category: "automotive",
    style: "sport",
    tags: ["automotive", "motorsport", "illustrative", "speed"],
    graphics: [{ assetId: "speed-lines", x: 0.06, y: 0.36, w: 0.4, h: 0.14, fill: PALETTES.crimsonInk.a }],
    lines: [{ text: "APEX RACING", y: 0.42, size: 20, bold: true, italic: true, font: "Rajdhani, sans-serif", fill: "#171412", align: "right", x: 0.1, width: 0.84 }],
  },
  {
    id: "pro-auto-wheel-badge",
    name: "Wheel Badge",
    category: "automotive",
    style: "sport",
    tags: ["automotive", "badge", "illustrative", "wheel", "motorsport"],
    graphics: [{ assetId: "wheel", x: 0.34, y: 0.06, w: 0.32, h: 0.32, fill: "#171412" }],
    lines: [
      { text: "DRIVEN", y: 0.42, size: 16, bold: true, font: "Teko, sans-serif", ls: 3 },
      { text: "PERFORMANCE GARAGE", y: 0.53, size: 9, ls: 1, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-auto-checkered-corner",
    name: "Checkered Corner",
    category: "automotive",
    style: "streetwear",
    tags: ["automotive", "motorsport", "expressive", "checkered"],
    graphics: [{ assetId: "checkered-flag", x: 0.66, y: 0.06, w: 0.24, h: 0.28, fill: "#171412", rotation: 12 }],
    lines: [{ text: "RACE DAY", y: 0.4, size: 30, bold: true, font: "Anton, sans-serif", fill: "#171412", align: "left", x: 0.07, width: 0.5 }],
  },
  {
    id: "pro-auto-garage-stencil",
    name: "Garage Stencil",
    category: "automotive",
    style: "bold",
    tags: ["automotive", "garage", "typography-led", "stencil", "bold"],
    shapes: [{ x: 0.08, y: 0.3, w: 0.84, h: 0.22, fill: "transparent", strokeColor: "#171412", strokeWidth: 3 }],
    lines: [
      { text: "GRIT & GEAR", y: 0.35, size: 20, bold: true, font: "Black Ops One, sans-serif", fill: "#171412", ls: 1 },
      { text: "GARAGE NO. 12", y: 0.46, size: 9, ls: 2, fill: "#171412" },
    ],
  },
  {
    id: "pro-auto-vintage-crest",
    name: "Vintage Motor Crest",
    category: "automotive",
    style: "vintage",
    tags: ["automotive", "vintage", "badge", "crest", "motor club"],
    graphics: [{ assetId: "compass", x: 0.36, y: 0.06, w: 0.28, h: 0.28, fill: PALETTES.oliveTan.a }],
    lines: [
      { text: "MOTOR CLUB", y: 0.42, size: 14, bold: true, font: "Bitter, serif", fill: PALETTES.oliveTan.a, curve: -22, x: 0.14, width: 0.72 },
      { text: "SINCE 1962", y: 0.56, size: 9, ls: 2, fill: PALETTES.oliveTan.b },
    ],
  },
  {
    id: "pro-auto-detail-min",
    name: "Detailing Minimal",
    category: "automotive",
    style: "minimal",
    tags: ["automotive", "detailing", "minimal", "premium"],
    lines: [
      { text: "SHINE", y: 0.4, size: 30, font: "Outfit, sans-serif", ls: 6 },
      { text: "MOBILE DETAIL STUDIO", y: 0.52, size: 9, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-auto-tire-track",
    name: "Tire Track Bar",
    category: "automotive",
    style: "bold",
    tags: ["automotive", "expressive", "diagonal", "bold"],
    shapes: [{ x: -0.06, y: 0.4, w: 1.12, h: 0.1, fill: "#171412", rotation: -4 }],
    lines: [{ text: "REDLINE", y: 0.2, size: 34, bold: true, font: "Anton, sans-serif", fill: PALETTES.crimsonInk.a }],
  },
  {
    id: "pro-auto-car-club-side",
    name: "Car Club Side Tag",
    category: "automotive",
    style: "corporate",
    tags: ["automotive", "car club", "typography-led", "side-aligned"],
    shapes: [{ x: 0, y: 0.12, w: 0.04, h: 0.5, fill: PALETTES.slateSteel.a }],
    lines: [
      { text: "MIDNIGHT", y: 0.24, size: 22, bold: true, font: "Barlow Condensed, sans-serif", align: "left", x: 0.12, width: 0.8, fill: PALETTES.slateSteel.a },
      { text: "GARAGE COLLECTIVE", y: 0.37, size: 9, ls: 2, align: "left", x: 0.12, width: 0.8, fill: PALETTES.slateSteel.a },
    ],
  },
  {
    id: "pro-auto-gear-mono",
    name: "Gear Monogram",
    category: "automotive",
    style: "corporate",
    tags: ["automotive", "monogram", "illustrative", "gear"],
    graphics: [{ assetId: "gear", x: 0.34, y: 0.08, w: 0.32, h: 0.32, fill: PALETTES.denimWhite.a }],
    lines: [{ text: "MK", y: 0.19, size: 22, bold: true, font: "Barlow, sans-serif", fill: PALETTES.denimWhite.b, x: 0.34, width: 0.32 }],
  },
  {
    id: "pro-auto-flag-stripe",
    name: "Flag Stripe",
    category: "automotive",
    style: "sport",
    tags: ["automotive", "motorsport", "expressive", "racing stripe"],
    shapes: [
      { x: 0, y: 0.34, w: 1, h: 0.05, fill: "#171412" },
      { x: 0, y: 0.4, w: 1, h: 0.05, fill: PALETTES.crimsonInk.a },
    ],
    lines: [{ text: "TEAM APEX", y: 0.2, size: 24, bold: true, italic: true, font: "Rajdhani, sans-serif" }],
  },

  // ============================================================== TRADES / CONSTRUCTION (8)
  {
    id: "pro-trade-blueprint-mark",
    name: "Blueprint Mark",
    category: "trades",
    style: "corporate",
    tags: ["trades", "construction", "typography-led", "blueprint"],
    shapes: [{ x: 0.1, y: 0.3, w: 0.8, h: 0.28, fill: "transparent", strokeColor: PALETTES.cobaltChalk.a, strokeWidth: 2 }],
    lines: [
      { text: "STERLING BUILD CO.", y: 0.36, size: 15, bold: true, font: "Barlow Condensed, sans-serif", fill: PALETTES.cobaltChalk.a, ls: 1 },
      { text: "GENERAL CONTRACTING", y: 0.47, size: 9, ls: 1, fill: PALETTES.cobaltChalk.a },
    ],
  },
  {
    id: "pro-trade-crossed-tools-badge",
    name: "Crossed Tools Badge",
    category: "trades",
    style: "corporate",
    tags: ["trades", "badge", "illustrative", "tools"],
    shapes: [{ x: 0.2, y: 0.05, w: 0.6, h: 0.54, shapeKind: "circle", fill: PALETTES.oliveTan.a }],
    graphics: [{ assetId: "crossed-tools", x: 0.36, y: 0.15, w: 0.28, h: 0.28, fill: PALETTES.oliveTan.b }],
    lines: [{ text: "HANDCRAFT & CO.", y: 0.475, size: 10, bold: true, fill: PALETTES.oliveTan.c, curve: 26, x: 0.2, width: 0.6 }],
  },
  {
    id: "pro-trade-electric-bolt",
    name: "Electric Bolt Mark",
    category: "trades",
    style: "bold",
    tags: ["electrician", "trades", "expressive", "bolt"],
    graphics: [{ assetId: "lightning", x: 0.06, y: 0.14, w: 0.2, h: 0.28, fill: PALETTES.inkSaffron.b }],
    lines: [
      { text: "VOLTAGE", y: 0.22, size: 26, bold: true, font: "Anton, sans-serif", align: "right", x: 0.3, width: 0.64, fill: PALETTES.inkSaffron.a },
      { text: "ELECTRICAL SERVICES", y: 0.36, size: 9, ls: 2, align: "right", x: 0.3, width: 0.64, fill: PALETTES.inkSaffron.b },
    ],
  },
  {
    id: "pro-trade-roof-line",
    name: "Roofline Minimal",
    category: "trades",
    style: "minimal",
    tags: ["roofing", "trades", "minimal", "typography-led"],
    shapes: [{ x: 0.32, y: 0.32, w: 0.36, h: 0.004, fill: "#171412" }],
    lines: [
      { text: "SUMMIT", y: 0.22, size: 26, bold: true, font: "Barlow, sans-serif", ls: 1 },
      { text: "ROOFING & EXTERIORS", y: 0.4, size: 9, ls: 2, fill: "#5b5348" },
    ],
  },
  {
    id: "pro-trade-gear-corner",
    name: "Gear Corner Mark",
    category: "trades",
    style: "corporate",
    tags: ["trades", "illustrative", "corner-mark", "industrial"],
    graphics: [{ assetId: "gear", x: 0.68, y: 0.08, w: 0.2, h: 0.2, fill: PALETTES.slateSteel.a }],
    lines: [
      { text: "IRONCLAD", y: 0.36, size: 24, bold: true, font: "Oswald, sans-serif", align: "left", x: 0.08, width: 0.6, fill: PALETTES.slateSteel.a },
      { text: "MECHANICAL SERVICES", y: 0.48, size: 9, ls: 1, align: "left", x: 0.08, width: 0.6, fill: PALETTES.slateSteel.a },
    ],
  },
  {
    id: "pro-trade-hammer-stack",
    name: "Hammer Stack",
    category: "trades",
    style: "bold",
    tags: ["construction", "trades", "typography-led", "stacked", "bold"],
    lines: [
      { text: "BUILD", y: 0.24, size: 30, bold: true, font: "League Spartan, sans-serif", align: "left", x: 0.07, width: 0.86 },
      { text: "STRONG", y: 0.39, size: 30, bold: true, font: "League Spartan, sans-serif", fill: PALETTES.duneRust.b, align: "left", x: 0.07, width: 0.86 },
    ],
  },
  {
    id: "pro-trade-paint-diagonal",
    name: "Paint Diagonal",
    category: "trades",
    style: "modern",
    tags: ["painting", "trades", "illustrative", "diagonal"],
    graphics: [{ assetId: "paint-roller", x: 0.06, y: 0.36, w: 0.22, h: 0.22, fill: PALETTES.sagestoneClay.b, rotation: -12 }],
    lines: [{ text: "FRESH COAT PAINTING", y: 0.42, size: 15, bold: true, font: "Karla, sans-serif", align: "right", x: 0.3, width: 0.64, fill: PALETTES.sagestoneClay.a }],
  },
  {
    id: "pro-trade-established-ring",
    name: "Established Ring",
    category: "trades",
    style: "vintage",
    tags: ["trades", "badge", "vintage", "established"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.52, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.espressoCream.a, strokeWidth: 3 }],
    lines: [
      { text: "TRUSTED TRADES", y: 0.16, size: 11, bold: true, fill: PALETTES.espressoCream.a, curve: 40, x: 0.22, width: 0.56 },
      { text: "EST. 1999", y: 0.42, size: 16, bold: true, fill: PALETTES.espressoCream.b },
    ],
  },

  // ============================================================== EVENTS / SOCIAL (8)
  {
    id: "pro-event-editorial-invite",
    name: "Editorial Invite",
    category: "events",
    style: "elegant",
    tags: ["event", "typography-led", "elegant", "editorial"],
    lines: [
      { text: "SAVE THE DATE", y: 0.32, size: 12, ls: 4, fill: PALETTES.plumBlush.a },
      { text: "Amelia & Cole", y: 0.42, size: 26, italic: true, font: "Cormorant Garamond, serif", fill: PALETTES.plumBlush.a },
    ],
  },
  {
    id: "pro-event-minimal-tag",
    name: "Minimal Event Tag",
    category: "events",
    style: "minimal",
    tags: ["event", "minimal", "premium", "typography-led"],
    lines: [{ text: "GATHERED", y: 0.42, size: 26, font: "Cabin, sans-serif", ls: 6 }],
  },
  {
    id: "pro-event-ring-badge",
    name: "Ring Badge Event",
    category: "events",
    style: "elegant",
    tags: ["wedding", "event", "badge", "illustrative", "rings"],
    graphics: [{ assetId: "rings", x: 0.36, y: 0.1, w: 0.28, h: 0.18, fill: PALETTES.blackGold.b }],
    lines: [
      { text: "TOGETHER FOREVER", y: 0.36, size: 13, bold: true, font: "Playfair Display, serif", fill: PALETTES.blackGold.a },
      { text: "06.20.2026", y: 0.47, size: 10, ls: 2, fill: PALETTES.blackGold.b },
    ],
  },
  {
    id: "pro-event-confetti-corner",
    name: "Confetti Corner",
    category: "events",
    style: "bold",
    tags: ["party", "event", "illustrative", "corner-mark", "celebration"],
    graphics: [{ assetId: "confetti", x: 0.66, y: 0.08, w: 0.22, h: 0.22, fill: PALETTES.pinkRed.b }],
    lines: [{ text: "THE CREW", y: 0.4, size: 30, bold: true, font: "Righteous, sans-serif", align: "left", x: 0.07, width: 0.5, fill: PALETTES.pinkRed.b }],
  },
  {
    id: "pro-event-block-banner",
    name: "Block Banner",
    category: "events",
    style: "bold",
    tags: ["event", "banner", "bold", "block"],
    shapes: [{ x: 0.06, y: 0.36, w: 0.88, h: 0.16, fill: PALETTES.tealNavy.a }],
    lines: [{ text: "FESTIVAL STAFF '26", y: 0.4, size: 16, bold: true, font: "Fjalla One, sans-serif", fill: PALETTES.tealNavy.c, ls: 1 }],
  },
  {
    id: "pro-event-heart-mono",
    name: "Heart Monogram",
    category: "events",
    style: "elegant",
    tags: ["wedding", "event", "monogram", "luxury"],
    shapes: [{ x: 0.3, y: 0.1, w: 0.4, h: 0.4, shapeKind: "circle", fill: "transparent", strokeColor: PALETTES.oxbloodCream.a, strokeWidth: 2 }],
    lines: [{ text: "S & J", y: 0.26, size: 24, font: "Cormorant Garamond, serif", fill: PALETTES.oxbloodCream.a, x: 0.3, width: 0.4 }],
  },
  {
    id: "pro-event-volunteer-min",
    name: "Volunteer Minimal",
    category: "events",
    style: "minimal",
    tags: ["volunteer", "event", "community", "minimal"],
    lines: [
      { text: "GIVE BACK", y: 0.4, size: 22, bold: true, font: "Nunito Sans, sans-serif", ls: 2, align: "left", x: 0.1, width: 0.8 },
      { text: "VOLUNTEER TEAM 2026", y: 0.5, size: 9, ls: 1, fill: "#5b5348", align: "left", x: 0.1, width: 0.8 },
    ],
  },
  {
    id: "pro-event-snowflake-badge",
    name: "Winter Social Badge",
    category: "events",
    style: "corporate",
    tags: ["event", "seasonal", "illustrative", "badge", "winter"],
    graphics: [{ assetId: "snowflake", x: 0.38, y: 0.06, w: 0.24, h: 0.24, fill: PALETTES.glacierGraphite.a }],
    lines: [{ text: "WINTER SOCIAL", y: 0.42, size: 15, bold: true, font: "Barlow, sans-serif", fill: PALETTES.glacierGraphite.a, ls: 1 }],
  },

  // ============================================================== CANADIAN / LOCAL / OUTDOOR (7)
  {
    id: "pro-can-pine-mark",
    name: "Pine Mark",
    category: "canadian",
    style: "retro",
    tags: ["canada", "outdoor", "illustrative", "nature"],
    graphics: [{ assetId: "pine-tree", x: 0.38, y: 0.07, w: 0.24, h: 0.3, fill: PALETTES.deepJuniper.a }],
    lines: [{ text: "NORTH SHORE", y: 0.46, size: 15, bold: true, font: "Barlow Condensed, sans-serif", fill: PALETTES.deepJuniper.a, ls: 2 }],
  },
  {
    id: "pro-can-sun-outline",
    name: "Sun Outline",
    category: "canadian",
    style: "retro",
    tags: ["canada", "outdoor", "illustrative", "sun", "summer"],
    graphics: [{ assetId: "sun", x: 0.36, y: 0.08, w: 0.28, h: 0.28, fill: PALETTES.duneRust.b }],
    lines: [{ text: "GREAT OUTDOORS", y: 0.44, size: 12, ls: 2, fill: PALETTES.duneRust.a }],
  },
  {
    id: "pro-can-maple-mono",
    name: "Maple Monoline",
    category: "canadian",
    style: "minimal",
    tags: ["canada", "maple", "minimal", "typography-led"],
    graphics: [{ assetId: "maple-leaf", x: 0.42, y: 0.1, w: 0.16, h: 0.16, fill: "#171412" }],
    lines: [{ text: "TRUE NORTH", y: 0.36, size: 20, ls: 4, align: "left", x: 0.1, width: 0.8 }],
  },
  {
    id: "pro-can-wave-line",
    name: "Wave Line Mark",
    category: "canadian",
    style: "modern",
    tags: ["canada", "outdoor", "illustrative", "water"],
    graphics: [{ assetId: "wave", x: 0.3, y: 0.44, w: 0.4, h: 0.1, fill: PALETTES.glacierGraphite.a }],
    lines: [{ text: "LAKESIDE CO.", y: 0.3, size: 22, bold: true, font: "Cabin, sans-serif", fill: PALETTES.glacierGraphite.a }],
  },
  {
    id: "pro-can-badge-crest",
    name: "Canadiana Crest",
    category: "canadian",
    style: "vintage",
    tags: ["canada", "badge", "vintage", "local"],
    shapes: [{ x: 0.22, y: 0.06, w: 0.56, h: 0.52, shapeKind: "circle", fill: PALETTES.deepJuniper.a }],
    graphics: [{ assetId: "maple-leaf", x: 0.4, y: 0.16, w: 0.2, h: 0.2, fill: PALETTES.deepJuniper.b }],
    lines: [{ text: "PROUDLY CANADIAN", y: 0.365, size: 10, bold: true, fill: PALETTES.deepJuniper.b, curve: 30, x: 0.22, width: 0.56 }],
  },
  {
    id: "pro-can-mountain-typo",
    name: "Mountain Typography",
    category: "canadian",
    style: "bold",
    tags: ["canada", "outdoor", "illustrative", "mountain", "bold"],
    graphics: [{ assetId: "mountain", x: 0.16, y: 0.3, w: 0.68, h: 0.2, fill: PALETTES.glacierGraphite.a }],
    lines: [{ text: "ELEVATION", y: 0.16, size: 26, bold: true, font: "Anton, sans-serif" }],
  },
  {
    id: "pro-can-local-underline",
    name: "Local Underline",
    category: "canadian",
    style: "minimal",
    tags: ["canada", "local", "minimal", "underline"],
    shapes: [{ x: 0.3, y: 0.48, w: 0.4, h: 0.006, fill: PALETTES.deepJuniper.a }],
    lines: [
      { text: "SUPPORT LOCAL", y: 0.38, size: 18, bold: true, font: "Mulish, sans-serif", ls: 1, fill: PALETTES.deepJuniper.a },
      { text: "OTTAWA · ONTARIO", y: 0.53, size: 9, ls: 2, fill: PALETTES.deepJuniper.b },
    ],
  },
];

export const MAPLE_TEMPLATES: DesignTemplate[] = [...SPECS.map(build), ...CREATIVE_SPECS.map(cbuild), ...PRO_SPECS.map(pbuild), ...FLAT_PRINT_TEMPLATES];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "trades", label: "Trades" },
  { id: "food-cafe", label: "Restaurants & Cafés" },
  { id: "sports", label: "Sports" },
  { id: "schools", label: "Schools" },
  { id: "events", label: "Events" },
  { id: "birthday", label: "Birthdays" },
  { id: "family", label: "Family" },
  { id: "clubs", label: "Clubs" },
  { id: "fundraisers", label: "Fundraisers" },
  { id: "canadian", label: "Canadian" },
  { id: "automotive", label: "Automotive" },
  { id: "streetwear", label: "Streetwear" },
  { id: "vintage", label: "Vintage" },
  { id: "minimal", label: "Minimal" },
  { id: "memorial", label: "Memorial" },
  { id: "graduation", label: "Graduation" },
  { id: "sports-teams", label: "Sports & Teams" },
  { id: "corporate", label: "Corporate" },
  { id: "luxury", label: "Luxury" },
  { id: "creative", label: "Creative" },
  { id: "contractor", label: "Contractor" },
  { id: "real-estate", label: "Real Estate" },
  { id: "restaurant", label: "Restaurant" },
  { id: "beauty", label: "Beauty" },
  { id: "photography", label: "Photography" },
  { id: "technology", label: "Technology" },
  { id: "qr-contact", label: "QR Contact" },
  { id: "social-media", label: "Social Media" },
  { id: "appointment-card", label: "Appointment Card" },
  { id: "grand-opening", label: "Grand Opening" },
  { id: "sale", label: "Sale" },
  { id: "nightlife", label: "Nightlife" },
  { id: "church-community", label: "Church / Community" },
  { id: "service-business", label: "Service Business" },
  { id: "qr-registration", label: "QR Registration" },
  { id: "qr-ticket", label: "QR Ticket" },
  { id: "concert", label: "Concert" },
  { id: "art", label: "Art" },
  { id: "announcement", label: "Announcement" },
  { id: "qr-cta", label: "QR Call-to-Action" },
];

/** Per-family priority order (Section 10) — used only to SORT the "Recommended" view, never to
 *  hide categories outright (a customer designing a hoodie can still search/browse anything). */
const RECOMMENDED_CATEGORY_ORDER: Record<ProductFamily, TemplateCategory[]> = {
  tee: ["events", "birthday", "business", "streetwear", "family", "fundraisers", "schools"],
  hoodie: ["streetwear", "schools", "sports", "clubs", "events"],
  joggers: ["streetwear", "sports", "minimal"],
  headwear: ["sports", "streetwear", "minimal", "trades"],
  accessory: ["business", "minimal", "canadian", "trades"],
  // STUDIO V4 brief's flat-print families — Record<ProductFamily, ...> requires every family to
  // have an entry (TypeScript would otherwise error on the missing keys the moment
  // productDecorationProfile.ts's ProductFamily type grew these four values).
  "business-card": ["corporate", "luxury", "creative", "qr-contact", "real-estate", "contractor", "restaurant", "beauty", "photography", "technology", "social-media", "appointment-card"],
  flyer: ["grand-opening", "sale", "real-estate", "restaurant", "nightlife", "church-community", "service-business", "qr-registration", "qr-ticket", "social-media"],
  poster: ["concert", "sale", "art", "announcement", "qr-cta"],
  mug: ["birthday", "family", "business", "minimal"],
};

/** Templates store a Maple asset id in `content` on image seeds (module-load time has no async
 *  asset lookup) — this resolves those to real data-URL asset sources right before the objects are
 *  copied into a DesignProject, and clears `content` back to null (image objects don't use it). */
export async function resolveTemplateAssets(objects: TemplateObjectSeed[]): Promise<TemplateObjectSeed[]> {
  return Promise.all(
    objects.map(async (o) => {
      if (o.type !== "image" || !o.content) return o;
      const asset = await MapleAssetProvider.getAsset(o.content);
      return { ...o, assetUrl: asset?.productionSource ?? null, content: null };
    }),
  );
}

export function templatesFor(family: ProductFamily, productSubtype?: string): DesignTemplate[] {
  return MAPLE_TEMPLATES.filter((t) => {
    if (!t.productFamilies.includes(family) || t.status !== "published") return false;
    if (productSubtype && t.productSubtypes && t.productSubtypes.length > 0) return t.productSubtypes.includes(productSubtype);
    return true;
  });
}

/** QA pass root cause (F): every template is authored/tuned against the "front" print area's own
 *  pixel box (~208x234 in the fixed 520x650 canvas space — see printAreas.ts). normalizedX/Y/Width/
 *  Height already scale correctly to ANY box, because they're fractions of it — but `fontSize`,
 *  `letterSpacing` and `strokeWidth` are stored as absolute canvas-pixel values, with no such
 *  built-in scaling. Applying a template to a much smaller box (left-chest, inside-neck, a sleeve)
 *  without scaling these left text rendered at its full "front" size relative to a box a third
 *  that size — badly overflowing and colliding with neighbouring lines, even though the template's
 *  own data was internally consistent. This scales the absolute-unit fields by the ratio between
 *  the active box and the reference box the template was designed against, exactly once, at apply
 *  time — StudioClient.applyTemplate calls this before inserting the resolved objects. `curve` is
 *  deliberately left unscaled (it's a unitless arc-intensity knob, not a pixel value); the visual
 *  effect is a very slightly flatter arc on much smaller placements, an acceptable cosmetic
 *  trade-off against the alternative of colliding/overflowing text. */
export function scaleTemplateObjects<T extends TemplateObjectSeed>(objects: T[], scale: number): T[] {
  if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return objects;
  return objects.map((o) => ({
    ...o,
    fontSize: o.fontSize == null ? o.fontSize : o.fontSize * scale,
    letterSpacing: o.letterSpacing == null ? o.letterSpacing : o.letterSpacing * scale,
    strokeWidth: o.strokeWidth == null ? o.strokeWidth : o.strokeWidth * scale,
  }));
}

/** Section 9/10/15: one filter pass covering search + category, shared by the panel so the
 *  behaviour (and its empty-state trigger) lives in exactly one place. */
export function filterTemplates(templates: DesignTemplate[], opts: { query?: string; category?: string }): DesignTemplate[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return templates.filter((t) => {
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.category.includes(q) || t.tags.some((tag) => tag.includes(q));
    const matchesCategory = !opts.category || opts.category === "all" || t.category === opts.category;
    return matchesQuery && matchesCategory;
  });
}

/** "Recommended" ordering (Section 10) — every template for this family, with the product's most
 *  relevant categories surfaced first (featured templates within a category bucket first, too).
 *  Never drops anything, only reorders, so it degrades gracefully for families with no explicit
 *  priority list. */
export function getRecommendedTemplates(family: ProductFamily, templates: DesignTemplate[]): DesignTemplate[] {
  const order = RECOMMENDED_CATEGORY_ORDER[family] ?? [];
  const rank = (t: DesignTemplate) => {
    const idx = order.indexOf(t.category);
    return idx === -1 ? order.length : idx;
  };
  // Reorganization pass: the newer, more art-directed collections should stop being buried behind
  // the ~129 original-collection templates once the Pro collection exists — Pro first, then
  // Creative, then the original collection — before falling back to the existing per-family
  // category order/featured tiebreakers below. Nothing is ever hidden, only reordered.
  const collectionRank = (t: DesignTemplate) => (t.collection === "pro" ? 0 : t.collection === "creative" ? 1 : 2);
  return [...templates].sort((a, b) => {
    const c = collectionRank(a) - collectionRank(b);
    if (c !== 0) return c;
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return 0;
  });
}
