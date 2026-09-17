// Maple Template system (Section 9/10 of an earlier brief; product-family scoping added by the
// STUDIO V4 brief). A GRAPHIC is one asset; a TEMPLATE is a whole editable composition (text +
// graphics + layout) built from the same normalized DesignObject model as a DesignProject.
// Applying a template deep-copies its objects (fresh ids) into the customer's active side — Studio
// never keeps a live reference back to the template, so editing a customer's design can never
// mutate (or be mutated by) the shared library.
//
// Every template is a Maple-owned internal demo (shapes, typography, and the hand-built/curated
// marks in assetProviders.ts) — proof of the UX, not a final/complete library. No third-party or
// purchased content is used anywhere here.

import type { DesignObjectRecord, DesignSideType } from "./types";
import type { ProductFamily } from "./productDecorationProfile";
import { MapleAssetProvider } from "./assetProviders";

export type TemplateCategory =
  | "business"
  | "sports-teams"
  | "birthday"
  | "events"
  | "schools"
  | "canadian"
  | "streetwear"
  | "vintage"
  | "minimal"
  | "trades"
  | "automotive"
  | "food-cafe"
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

const now = "2026-09-13T00:00:00.000Z";

export const MAPLE_TEMPLATES: DesignTemplate[] = [
  {
    id: "tpl-business-staff",
    name: "Business Staff",
    category: "business",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front"],
    tags: ["business", "uniform", "clean"],
    linkedAssetIds: ["maple-banner-ribbon"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-banner-ribbon", { normalizedX: 0.32, normalizedY: 0.12, normalizedWidth: 0.36, normalizedHeight: 0.14, fill: "#171412" }),
      textSeed({ content: "YOUR COMPANY", fontSize: 26, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.34, bold: true, letterSpacing: 1 }),
      textSeed({ content: "EST. 2024", fontSize: 14, normalizedY: 0.44, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-birthday-crew",
    name: "Birthday Crew",
    category: "birthday",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front"],
    tags: ["birthday", "party", "fun"],
    linkedAssetIds: ["maple-heart"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-heart", { normalizedX: 0.4, normalizedY: 0.1, normalizedWidth: 0.2, normalizedHeight: 0.2, fill: "#D41414" }),
      textSeed({ content: "BIRTHDAY CREW", fontSize: 28, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.36, bold: true, curve: 45 }),
      textSeed({ content: "Est. today", fontSize: 14, normalizedY: 0.5, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-team-classic",
    name: "Team Classic",
    category: "sports-teams",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["team", "sports", "number"],
    linkedAssetIds: ["maple-shield"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-shield", { normalizedX: 0.38, normalizedY: 0.08, normalizedWidth: 0.24, normalizedHeight: 0.24, fill: "#171412" }),
      textSeed({ content: "TEAM NAME", fontSize: 24, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.36, bold: true, letterSpacing: 2 }),
      textSeed({ content: "00", fontSize: 64, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.46, bold: true }),
    ],
  },
  {
    id: "tpl-vintage-club",
    name: "Vintage Club",
    category: "vintage",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front"],
    tags: ["vintage", "retro", "badge"],
    linkedAssetIds: ["maple-laurel"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-laurel", { normalizedX: 0.25, normalizedY: 0.08, normalizedWidth: 0.5, normalizedHeight: 0.4, fill: "#5b5348" }),
      textSeed({ content: "EST. 1998", fontSize: 20, normalizedY: 0.26, bold: true }),
      textSeed({ content: "SINCE THE START", fontSize: 11, normalizedY: 0.34, letterSpacing: 2, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-event-staff",
    name: "Event Staff",
    category: "events",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["event", "staff", "crew"],
    linkedAssetIds: [],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      textSeed({ content: "EVENT STAFF", fontSize: 30, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.36, bold: true, letterSpacing: 3 }),
      shapeSeed({ normalizedX: 0.3, normalizedY: 0.46, normalizedWidth: 0.4, normalizedHeight: 0.012, fill: "#D41414" }),
      textSeed({ content: "2026", fontSize: 14, normalizedY: 0.5, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-garage-automotive",
    name: "Garage / Automotive",
    category: "automotive",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["automotive", "garage", "trades"],
    linkedAssetIds: ["maple-wrench-gear"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-wrench-gear", { normalizedX: 0.36, normalizedY: 0.08, normalizedWidth: 0.28, normalizedHeight: 0.28, fill: "#171412" }),
      textSeed({ content: "GARAGE CO.", fontSize: 26, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.4, bold: true, letterSpacing: 1 }),
      textSeed({ content: "PARTS · SERVICE · REPAIR", fontSize: 11, normalizedY: 0.49, letterSpacing: 1, fill: "#5b5348" }),
    ],
  },
  {
    id: "tpl-minimal-logo",
    name: "Minimal Logo",
    category: "minimal",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["minimal", "simple", "logo"],
    linkedAssetIds: ["maple-star-burst"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [graphicSeed("maple-star-burst", { normalizedX: 0.42, normalizedY: 0.32, normalizedWidth: 0.16, normalizedHeight: 0.16, fill: "#171412" })],
  },
  {
    id: "tpl-canada-maple",
    name: "Canada / Maple",
    category: "canadian",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front"],
    tags: ["canada", "maple", "canadian"],
    linkedAssetIds: ["maple-maple-leaf"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-maple-leaf", { normalizedX: 0.36, normalizedY: 0.1, normalizedWidth: 0.28, normalizedHeight: 0.28, fill: "#D41414" }),
      textSeed({ content: "CANADA", fontSize: 24, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.42, bold: true, letterSpacing: 3 }),
    ],
  },
  {
    id: "tpl-streetwear-crown",
    name: "Streetwear Crown",
    category: "streetwear",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["streetwear", "urban", "bold"],
    linkedAssetIds: ["maple-crown"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-crown", { normalizedX: 0.38, normalizedY: 0.1, normalizedWidth: 0.24, normalizedHeight: 0.24, fill: "#171412" }),
      textSeed({ content: "ROYALTY", fontSize: 32, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.4, bold: true, italic: true, letterSpacing: 2 }),
    ],
  },
  {
    id: "tpl-school-spirit",
    name: "School Spirit",
    category: "schools",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front", "back"],
    tags: ["school", "spirit", "grad"],
    linkedAssetIds: ["maple-graduation-cap"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-graduation-cap", { normalizedX: 0.36, normalizedY: 0.09, normalizedWidth: 0.28, normalizedHeight: 0.2 }),
      textSeed({ content: "CLASS OF 2026", fontSize: 22, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.36, bold: true }),
    ],
  },
  {
    id: "tpl-cafe-daily",
    name: "Café Daily",
    category: "food-cafe",
    thumbnailUrl: "",
    productFamilies: ["tee", "hoodie"],
    compatiblePrintAreas: ["front"],
    tags: ["cafe", "coffee", "food"],
    linkedAssetIds: ["maple-coffee-cup"],
    featured: false,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-coffee-cup", { normalizedX: 0.4, normalizedY: 0.08, normalizedWidth: 0.2, normalizedHeight: 0.2 }),
      textSeed({ content: "DAILY GRIND", fontSize: 22, fontFamily: "Bricolage Grotesque, sans-serif", normalizedY: 0.34, bold: true }),
      textSeed({ content: "CAFÉ CO.", fontSize: 12, normalizedY: 0.42, letterSpacing: 2, fill: "#5b5348" }),
    ],
  },

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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
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
    createdAt: now,
    updatedAt: now,
    objects: [
      textSeed({ content: "SCAN TO LEARN MORE", fontSize: 24, fontFamily: "Bricolage Grotesque, sans-serif", bold: true, normalizedY: 0.14, letterSpacing: 1 }),
      shapeSeed({ shapeKind: "rounded-rectangle", fill: "#F6F1E9", strokeColor: "#D8CFC0", strokeWidth: 1, normalizedX: 0.3, normalizedY: 0.3, normalizedWidth: 0.4, normalizedHeight: 0.3 }),
      textSeed({ content: "ADD QR", fontSize: 12, align: "center", fill: "#9C9284", normalizedX: 0.3, normalizedY: 0.43, normalizedWidth: 0.4, normalizedHeight: 0.06 }),
      textSeed({ content: "yourbusiness.com", fontSize: 13, normalizedY: 0.66, fill: "#5b5348" }),
    ],
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "sports-teams", label: "Sports & Teams" },
  { id: "birthday", label: "Birthday" },
  { id: "events", label: "Events" },
  { id: "schools", label: "Schools" },
  { id: "canadian", label: "Canadian" },
  { id: "streetwear", label: "Streetwear" },
  { id: "vintage", label: "Vintage" },
  { id: "minimal", label: "Minimal" },
  { id: "trades", label: "Trades" },
  { id: "automotive", label: "Automotive" },
  { id: "food-cafe", label: "Food & Café" },
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
