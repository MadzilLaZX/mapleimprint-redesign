// Application-level design model — deliberately decoupled from whichever canvas engine renders it
// (react-konva today). Nothing outside src/components/studio/CanvasStage.tsx should ever import a
// Konva type; everything else in the app talks in these normalized, print-area-relative shapes so
// swapping the rendering engine later doesn't touch the storefront/order model.

// The full set of print locations across every product family Studio knows about (tees, hoodies,
// joggers, headwear). NOT every product offers every location — see productDecorationProfile.ts
// for which locations exist per product family and whether each is STANDARD (real photography,
// auto-orderable), REVIEW_REQUIRED (Maple confirms before production) or UNAVAILABLE (not shown).
// "Location," not strictly "side" — left-chest shares the front garment photo (a smaller print
// area within the same view), it isn't a distinct camera angle.
export type DesignSideType =
  | "front"
  | "back"
  | "left-chest"
  | "right-chest"
  | "left-sleeve"
  | "right-sleeve"
  | "upper-back"
  | "hood"
  | "pocket"
  | "inside-neck"
  | "outside-neck"
  | "left-leg"
  | "right-leg"
  | "left-side"
  | "right-side";

export type DesignObjectType = "image" | "text" | "shape";
export type ShapeKind = "rectangle" | "circle" | "line";
export type TextAlign = "left" | "center" | "right";
export type DesignProjectStatus = "draft" | "reviewed" | "ordered";

export interface DesignObjectRecord {
  id: string;
  type: DesignObjectType;
  assetUrl: string | null;
  content: string | null;
  fontFamily: string | null;
  fontSize: number | null;
  fill: string | null;
  /** All position/size fields are normalized 0-1 against the side's print area, not pixels —
   *  see PRINT_AREA in printAreas.ts. This is what makes the design portable across screen sizes
   *  and, eventually, a real production-file renderer. */
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  rotation: number;
  opacity: number;
  /** Source of truth for z-order is each side's `objects` ARRAY INDEX (last = topmost, matching
   *  the Layers panel's top-of-list-is-front convention) — this field is kept only so a fresh
   *  read from the DB (which has no inherent order) can be sorted back into that order. Never
   *  read this to decide render order; always resort by it once on load, then trust array order. */
  zIndex: number;
  /** Custom layer name shown in the Layers panel; falls back to a generated label (e.g. "Text",
   *  "Logo.png") when null. */
  name: string | null;
  /** Hidden from canvas/preview/production but still part of the design (kept for re-enabling) —
   *  distinct from deleting. */
  hidden: boolean;
  // --- text-only fields (null for image/shape) ---
  bold: boolean;
  italic: boolean;
  align: TextAlign | null;
  /** Extra spacing between letters, in px at the object's own font size. */
  letterSpacing: number | null;
  /** Line-height multiplier (e.g. 1.2). Null = engine default. */
  lineHeight: number | null;
  /** 0 = straight text. Positive/negative bends the baseline into an arc; magnitude is the arc's
   *  strength, not a physical unit. Null/0 both mean "no curve." */
  curve: number | null;
  // --- shape-only fields (null for image/text) ---
  shapeKind: ShapeKind | null;
  strokeColor: string | null;
  strokeWidth: number | null;
  // --- image-only fields (false/null for text/shape) ---
  flipX: boolean;
  flipY: boolean;
  /** Crop window as fractions (0-1) of the image's natural pixel size. All null = uncropped
   *  (show the full source image) — see Konva's native `crop`/`cropWidth`/`cropHeight` support,
   *  which this maps onto directly in CanvasStage. */
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
}

export interface DesignSideRecord {
  id: string;
  sideType: DesignSideType;
  printAreaWidth: number;
  printAreaHeight: number;
  objects: DesignObjectRecord[];
}

export interface PricingSnapshot {
  /** Blank-garment unit price (wholesale x markup only, no decoration) — constant regardless of
   *  how many sides end up designed. */
  unitBasePrice: number;
  designFee: number;
  /** Per-unit chart cost for 1 print location, at this order's quantity tier — lets Studio
   *  recompute the printing line live as sides gain/lose artwork without re-deriving pricing. */
  chartFirstLocationCost: number;
  /** Per-unit chart cost for each additional location beyond the first, same tier. */
  chartAdditionalLocationCost: number;
  quantity: number;
  /** Snapshot total at creation time — Studio recomputes the live total from the fields above as
   *  the design changes; this is what gets frozen into the cart line at Review/Add to cart. */
  total: number;
  printRuleVersion: string;
}

export interface SizeQty {
  size: string;
  qty: number;
}

export interface DesignProjectRecord {
  id: string;
  productSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  productName: string;
  brandName: string;
  colourName: string;
  sizeBreakdown: SizeQty[];
  totalQuantity: number;
  productTemplateVersion: string;
  pricingSnapshot: PricingSnapshot | null;
  mockupImages: Partial<Record<DesignSideType, string>>;
  status: DesignProjectStatus;
  revision: number;
  sides: DesignSideRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignProjectInput {
  productSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  productName: string;
  brandName: string;
  colourName: string;
  sizeBreakdown: SizeQty[];
  totalQuantity: number;
  pricingSnapshot: PricingSnapshot;
  mockupImages: Partial<Record<DesignSideType, string>>;
  sides: DesignSideType[];
}
