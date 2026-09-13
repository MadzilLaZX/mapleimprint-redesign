// Product-family-aware print-location model (STUDIO V2 brief, "print location architecture must
// stop assuming APPAREL = T-SHIRT"). Every product maps to one ProductFamily, and every family has
// its own list of locations, each carrying a SupportStatus:
//
//   STANDARD        — real product photography exists for this location and Maple has already
//                      confirmed it's orderable. Fully automatic, exactly like today's front/back/
//                      left-chest.
//   REVIEW_REQUIRED — physically plausible and worth letting the customer design, but there is no
//                      real per-location photo for this exact garment and/or Maple hasn't confirmed
//                      production support. Shown with a generic "Placement Preview" illustration
//                      (never presented as real product photography) and a disclaimer that the
//                      Maple team confirms it before production.
//   UNAVAILABLE     — not shown at all.
//
// This intentionally does NOT invent supplier photography or claim confirmed production capability
// that hasn't been verified — see printAreas.ts's PLACEMENT_PREVIEW_GEOMETRY comment.

import type { DesignSideType } from "./types";

export type SupportStatus = "STANDARD" | "REVIEW_REQUIRED" | "UNAVAILABLE";

export type ProductFamily = "tee" | "hoodie" | "joggers" | "headwear" | "accessory";

export interface DecorationLocation {
  id: DesignSideType;
  label: string;
  group: "core" | "sleeves" | "special";
  status: SupportStatus;
  /** True when this location has no real per-location product photo and must render with the
   *  generic placement illustration rather than actual supplier photography. */
  usesPlacementPreview: boolean;
  requiresManualReview: boolean;
  productionNotes?: string;
}

export interface ProductDecorationProfile {
  family: ProductFamily;
  locations: DecorationLocation[];
}

/** categorySlug/subcategorySlug -> family, from the real slug set in the product catalogue
 *  (src/lib/generated/products.json). Anything not explicitly a hoodie/jogger/headwear/accessory
 *  falls back to "tee" — a torso garment with a conventional front/back/chest layout, which is
 *  true for every remaining subcategory (polos, button-ups, sweaters, workwear shirts, etc). */
export function familyFor(categorySlug: string, subcategorySlug: string): ProductFamily {
  if (subcategorySlug === "hoodies-sweatshirts" || subcategorySlug === "jackets-outerwear") return "hoodie";
  if (subcategorySlug === "joggers-bottoms") return "joggers";
  if (subcategorySlug === "caps" || subcategorySlug === "beanies-toques") return "headwear";
  if (categorySlug === "hats-accessories") return "accessory"; // aprons, bags, general accessories
  return "tee";
}

const TEE_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-chest", label: "Left Chest", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "right-chest", label: "Right Chest", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "left-sleeve", label: "Left Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-sleeve", label: "Right Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "upper-back", label: "Upper Back / Nape", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "inside-neck", label: "Inside Neck Label", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Small tag-style print; confirm label stock with Maple." },
  { id: "outside-neck", label: "Outside Neck Label", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
];

const HOODIE_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-chest", label: "Left Chest", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "right-chest", label: "Right Chest", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "left-sleeve", label: "Left Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-sleeve", label: "Right Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "hood", label: "Hood", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Curved/folded surface — placement and print method confirmed per order." },
  { id: "upper-back", label: "Upper Back", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "pocket", label: "Pocket", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Only on styles with a kangaroo pocket; confirmed per garment." },
  { id: "inside-neck", label: "Inside Neck Label", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "outside-neck", label: "Outside Neck Label", group: "special", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
];

// Joggers deliberately do NOT reuse the tee's chest-centered "front" box — see printAreas.ts's
// JOGGERS_FRONT_BOX. Independent left/right leg prints stay REVIEW_REQUIRED until Maple confirms
// dual-leg registration; "front" alone (single centered placement, real garment photo) is the only
// STANDARD location, matching what the site's actual product photography supports.
const JOGGERS_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false, productionNotes: "Single centered placement on the front leg area." },
  { id: "left-leg", label: "Left Leg", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-leg", label: "Right Leg", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
];

const HEADWEAR_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-side", label: "Left Side", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-side", label: "Right Side", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Only on structured/flat-brim styles with a back panel; confirmed per style." },
];

const ACCESSORY_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", usesPlacementPreview: true, requiresManualReview: true },
];

const PROFILES: Record<ProductFamily, DecorationLocation[]> = {
  tee: TEE_LOCATIONS,
  hoodie: HOODIE_LOCATIONS,
  joggers: JOGGERS_LOCATIONS,
  headwear: HEADWEAR_LOCATIONS,
  accessory: ACCESSORY_LOCATIONS,
};

/** hasBackPhoto lets a specific product drop "back" from STANDARD even where the family default
 *  allows it (matches the pre-existing ProductCustomizer.tsx behaviour: some colourways/products
 *  only have a front photo). A dropped STANDARD "back" does not reappear as REVIEW_REQUIRED — if
 *  there's genuinely no back photo at all, offering a preview of it would still be a placement
 *  nobody can see mocked up. */
export function decorationProfileFor(categorySlug: string, subcategorySlug: string, hasBackPhoto: boolean): ProductDecorationProfile {
  const family = familyFor(categorySlug, subcategorySlug);
  const base = PROFILES[family];
  const locations = hasBackPhoto
    ? base
    : base.filter((loc) => loc.id !== "back" || loc.status !== "STANDARD");
  return { family, locations };
}

export function standardLocationsFor(categorySlug: string, subcategorySlug: string, hasBackPhoto: boolean): DesignSideType[] {
  return decorationProfileFor(categorySlug, subcategorySlug, hasBackPhoto)
    .locations.filter((l) => l.status === "STANDARD")
    .map((l) => l.id);
}
