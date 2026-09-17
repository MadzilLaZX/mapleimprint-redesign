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

export type ProductFamily = "tee" | "hoodie" | "joggers" | "headwear" | "accessory" | "business-card" | "flyer" | "poster" | "mug";

// Section 20: how a location's editing view is constructed, independent of its SupportStatus.
// Status answers "can the customer design this, and is it confirmed for production"; viewType
// answers "what does the workspace actually look like" — a location can be STANDARD and still use
// a *_PLACEMENT viewType (left-chest is a small box on the front photo), and REVIEW_REQUIRED
// locations aren't all the same shape (a sleeve needs a rotated box, inner neck needs a dedicated
// schematic, not just "the placement preview version of front"). Keeping these as two separate
// fields is what let the sleeve/inner-neck work in this pass slot in without touching every
// existing STANDARD location's rendering path.
export type LocationViewType =
  | "PRODUCT_FRONT"
  | "PRODUCT_BACK"
  | "PRODUCT_FRONT_PLACEMENT"
  | "PRODUCT_BACK_PLACEMENT"
  | "SLEEVE_LEFT_PLACEMENT"
  | "SLEEVE_RIGHT_PLACEMENT"
  | "INNER_NECK_SCHEMATIC"
  | "OUTER_NECK_PLACEMENT"
  | "HOOD_PLACEMENT"
  | "PANTS_LEG_PLACEMENT"
  | "CARD_FRONT_FLAT"
  | "CARD_BACK_FLAT"
  | "FLYER_FRONT_FLAT"
  | "FLYER_BACK_FLAT"
  | "POSTER_FLAT"
  | "MUG_WRAP_FLAT";

export interface DecorationLocation {
  id: DesignSideType;
  label: string;
  group: "core" | "sleeves" | "special";
  status: SupportStatus;
  viewType: LocationViewType;
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
  // STUDIO V4 brief's forward-looking flat-print/mug families — real marketing subcategories
  // already exist for these (business-printing/business cards, brochures & flyers, postcards,
  // posters; drinkware/mugs) but the live catalogue currently has zero actual products in them
  // (S&S Activewear, the only connected supplier, doesn't carry business printing or drinkware —
  // confirmed by checking generated/products.json directly). Mapped now so the moment real
  // products land in these subcategories, family/template/print-area resolution already works —
  // see PROJECT_NOTES.md for this being an explicit, honest "architecture ready, no live product
  // to test end-to-end yet" gap rather than a claim these are orderable today.
  if (subcategorySlug === "business-cards") return "business-card";
  if (subcategorySlug === "brochures-flyers" || subcategorySlug === "postcards") return "flyer";
  if (subcategorySlug === "posters") return "poster";
  if (subcategorySlug === "mugs") return "mug";
  if (categorySlug === "hats-accessories") return "accessory"; // aprons, bags, general accessories
  return "tee";
}

const TEE_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "STANDARD", viewType: "PRODUCT_BACK", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-chest", label: "Left Chest", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "right-chest", label: "Right Chest", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "left-sleeve", label: "Left Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", viewType: "SLEEVE_LEFT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-sleeve", label: "Right Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", viewType: "SLEEVE_RIGHT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "upper-back", label: "Upper Back / Nape", group: "special", status: "REVIEW_REQUIRED", viewType: "PRODUCT_BACK_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  {
    id: "inside-neck",
    label: "Inside Neck Label",
    group: "special",
    status: "REVIEW_REQUIRED",
    viewType: "INNER_NECK_SCHEMATIC",
    usesPlacementPreview: true,
    requiresManualReview: true,
    // Known gap, disclosed rather than guessed around: real eligibility (tear-away label stock,
    // decoration method, Maple's actual capability per garment) isn't in the supplier data this
    // site has, so this can't yet be conditioned per-product the way Section 18 describes — every
    // tee gets REVIEW_REQUIRED rather than a fabricated UNAVAILABLE/STANDARD split. REVIEW_REQUIRED
    // is the honest middle ground: Maple confirms feasibility per order before anything prints.
    productionNotes: "Small tag-style print; confirm label stock and eligibility with Maple.",
  },
  { id: "outside-neck", label: "Outside Neck Label", group: "special", status: "REVIEW_REQUIRED", viewType: "OUTER_NECK_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
];

const HOODIE_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "STANDARD", viewType: "PRODUCT_BACK", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-chest", label: "Left Chest", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "right-chest", label: "Right Chest", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "left-sleeve", label: "Left Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", viewType: "SLEEVE_LEFT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-sleeve", label: "Right Sleeve", group: "sleeves", status: "REVIEW_REQUIRED", viewType: "SLEEVE_RIGHT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "hood", label: "Hood", group: "special", status: "REVIEW_REQUIRED", viewType: "HOOD_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Curved/folded surface — placement and print method confirmed per order." },
  { id: "upper-back", label: "Upper Back", group: "special", status: "REVIEW_REQUIRED", viewType: "PRODUCT_BACK_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "pocket", label: "Pocket", group: "special", status: "REVIEW_REQUIRED", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Only on styles with a kangaroo pocket; confirmed per garment." },
  { id: "inside-neck", label: "Inside Neck Label", group: "special", status: "REVIEW_REQUIRED", viewType: "INNER_NECK_SCHEMATIC", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Small tag-style print; confirm label stock and eligibility with Maple." },
  { id: "outside-neck", label: "Outside Neck Label", group: "special", status: "REVIEW_REQUIRED", viewType: "OUTER_NECK_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
];

// Joggers deliberately do NOT reuse the tee's chest-centered "front" box — see printAreas.ts's
// JOGGERS_FRONT_BOX. Independent left/right leg prints stay REVIEW_REQUIRED until Maple confirms
// dual-leg registration; "front" alone (single centered placement, real garment photo) is the only
// STANDARD location, matching what the site's actual product photography supports.
const JOGGERS_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: false, requiresManualReview: false, productionNotes: "Single centered placement on the front leg area." },
  { id: "left-leg", label: "Left Leg", group: "core", status: "REVIEW_REQUIRED", viewType: "PANTS_LEG_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-leg", label: "Right Leg", group: "core", status: "REVIEW_REQUIRED", viewType: "PANTS_LEG_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_BACK", usesPlacementPreview: true, requiresManualReview: true },
];

const HEADWEAR_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "left-side", label: "Left Side", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "right-side", label: "Right Side", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_FRONT_PLACEMENT", usesPlacementPreview: true, requiresManualReview: true },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_BACK", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Only on structured/flat-brim styles with a back panel; confirmed per style." },
];

const ACCESSORY_LOCATIONS: DecorationLocation[] = [
  { id: "front", label: "Front", group: "core", status: "STANDARD", viewType: "PRODUCT_FRONT", usesPlacementPreview: false, requiresManualReview: false },
  { id: "back", label: "Back", group: "core", status: "REVIEW_REQUIRED", viewType: "PRODUCT_BACK", usesPlacementPreview: true, requiresManualReview: true },
];

// Flat print pieces (STUDIO V4 brief) — no garment photography exists or is even applicable, so
// every location here is honestly REVIEW_REQUIRED with usesPlacementPreview true, same as any
// other location this site can't yet show real confirmed production photography for. Respect
// bleed/safe area at the PRINT_AREAS level (printAreas.ts), never reusing apparel print-area
// assumptions (Section "BUSINESS CARD TEMPLATE CATEGORIES": "Do not reuse T-shirt print-area
// assumptions").
const BUSINESS_CARD_LOCATIONS: DecorationLocation[] = [
  { id: "card-front", label: "Front", group: "core", status: "REVIEW_REQUIRED", viewType: "CARD_FRONT_FLAT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Standard 3.5 × 2 in card. Bleed/safe/trim area confirmed by Maple before production." },
  { id: "card-back", label: "Back", group: "core", status: "REVIEW_REQUIRED", viewType: "CARD_BACK_FLAT", usesPlacementPreview: true, requiresManualReview: true },
];

const FLYER_LOCATIONS: DecorationLocation[] = [
  { id: "flyer-front", label: "Front", group: "core", status: "REVIEW_REQUIRED", viewType: "FLYER_FRONT_FLAT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Standard 8.5 × 11 in flyer. Bleed/safe area confirmed by Maple before production." },
  { id: "flyer-back", label: "Back", group: "core", status: "REVIEW_REQUIRED", viewType: "FLYER_BACK_FLAT", usesPlacementPreview: true, requiresManualReview: true },
];

const POSTER_LOCATIONS: DecorationLocation[] = [
  { id: "poster-front", label: "Front", group: "core", status: "REVIEW_REQUIRED", viewType: "POSTER_FLAT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Standard 18 × 24 in poster. Bleed/safe area confirmed by Maple before production." },
];

const MUG_LOCATIONS: DecorationLocation[] = [
  { id: "mug-wrap", label: "Wrap", group: "core", status: "REVIEW_REQUIRED", viewType: "MUG_WRAP_FLAT", usesPlacementPreview: true, requiresManualReview: true, productionNotes: "Full sublimation wrap. Exact print-safe curvature confirmed by Maple before production." },
];

const PROFILES: Record<ProductFamily, DecorationLocation[]> = {
  tee: TEE_LOCATIONS,
  hoodie: HOODIE_LOCATIONS,
  joggers: JOGGERS_LOCATIONS,
  headwear: HEADWEAR_LOCATIONS,
  accessory: ACCESSORY_LOCATIONS,
  "business-card": BUSINESS_CARD_LOCATIONS,
  flyer: FLYER_LOCATIONS,
  poster: POSTER_LOCATIONS,
  mug: MUG_LOCATIONS,
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
