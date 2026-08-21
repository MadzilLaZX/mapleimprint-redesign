// Application-level design model — deliberately decoupled from whichever canvas engine renders it
// (react-konva today). Nothing outside src/components/studio/CanvasStage.tsx should ever import a
// Konva type; everything else in the app talks in these normalized, print-area-relative shapes so
// swapping the rendering engine later doesn't touch the storefront/order model.

export type DesignSideType = "front" | "back";
export type DesignObjectType = "image" | "text";
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
  zIndex: number;
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
