// Maple Template system (Section 9/10). A GRAPHIC is one asset; a TEMPLATE is a whole editable
// composition (text + graphics + layout) built from the same normalized DesignObject model as a
// DesignProject. Applying a template deep-copies its objects (fresh ids) into the customer's
// active side — Studio never keeps a live reference back to the template, so editing a customer's
// design can never mutate (or be mutated by) the shared library.
//
// The ~10 templates below are Maple-owned internal demos only (shapes, typography, and the
// hand-built marks in assetProviders.ts) — proof of the UX, explicitly not a real/final template
// library. No third-party or purchased content is used anywhere here (brief: "Do NOT purchase or
// scrape external content yet").

import type { DesignObjectRecord } from "./types";
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
  | "food-cafe";

export type TemplateObjectSeed = Omit<DesignObjectRecord, "id">;

export interface DesignTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  thumbnailUrl: string;
  productFamilies: ProductFamily[];
  compatiblePrintAreas: ("front" | "back")[];
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

function textSeed(overrides: Partial<TemplateObjectSeed>): TemplateObjectSeed {
  return {
    ...IMAGE_DEFAULTS,
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
    linkedAssetIds: ["maple-leaf"],
    featured: true,
    licenseMetadata: "Maple Imprint internal demo template.",
    status: "published",
    createdAt: now,
    updatedAt: now,
    objects: [
      graphicSeed("maple-leaf", { normalizedX: 0.36, normalizedY: 0.1, normalizedWidth: 0.28, normalizedHeight: 0.28, fill: "#D41414" }),
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

export function templatesFor(family: ProductFamily): DesignTemplate[] {
  return MAPLE_TEMPLATES.filter((t) => t.productFamilies.includes(family) && t.status === "published");
}
