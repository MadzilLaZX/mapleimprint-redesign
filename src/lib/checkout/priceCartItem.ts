import type { SupabaseClient } from "@supabase/supabase-js";
import { getProduct } from "@/lib/products";
import { blankUnitPrice } from "@/lib/studio/pricing";
import type { DesignProjectRecord } from "@/lib/studio/types";

/** The subset of CartItem the browser posts to the checkout endpoints — deliberately NOT the
 *  full CartItem type, since price-bearing fields (startingPrice, priceTiers) are read here only
 *  to know WHICH item is being priced, never trusted as the actual price. */
export interface CheckoutCartItemInput {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  quantity: number;
  colourName?: string;
  sizeBreakdown?: { size: string; qty: number }[];
  customizationType?: "BLANK" | "CUSTOM" | "MAPLE_DESIGNER";
  designProjectId?: string;
  designFrozenRevision?: number;
  productSlug?: string;
  subcategorySlug?: string;
}

export interface PricedCartLine {
  cartItemId: string;
  productName: string;
  categorySlug: string;
  colourName: string | null;
  sizeBreakdown: { size: string; qty: number }[] | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  customizationType: string | null;
  designProjectId: string | null;
  designFrozenRevision: number | null;
  designSnapshot: DesignProjectRecord | null;
}

export type PriceCartItemResult =
  | { ok: true; line: PricedCartLine }
  | { ok: false; cartItemId: string; reason: string };

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Recomputes a single cart line's price entirely server-side — never trusts any price field the
 *  browser sent. Used by both /api/checkout/quote (display) and /api/checkout/pay (the
 *  authoritative recompute immediately before charging), so the two can't drift apart. */
export async function priceCartItem(
  item: CheckoutCartItemInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
): Promise<PriceCartItemResult> {
  if (item.customizationType === "CUSTOM") {
    if (!item.designProjectId) {
      return { ok: false, cartItemId: item.id, reason: "This custom item is missing its design." };
    }
    const { data: project, error } = await supabaseAdmin
      .from("DesignProject")
      .select("frozenAt, designSnapshot, frozenRevision")
      .eq("id", item.designProjectId)
      .maybeSingle();
    if (error) {
      console.error("[checkout] design lookup failed:", error);
      return { ok: false, cartItemId: item.id, reason: "Couldn't load this design. Please try again." };
    }
    if (!project) return { ok: false, cartItemId: item.id, reason: "This design could not be found." };
    if (!project.frozenAt || !project.designSnapshot) {
      return { ok: false, cartItemId: item.id, reason: "This design hasn't been finalized yet." };
    }
    if (
      item.designFrozenRevision !== undefined &&
      item.designFrozenRevision !== project.frozenRevision
    ) {
      return {
        ok: false,
        cartItemId: item.id,
        reason: "This design has changed since it was added to your cart. Remove it and add it again.",
      };
    }

    const snapshot = project.designSnapshot as DesignProjectRecord;
    const pricing = snapshot.pricingSnapshot;
    if (!pricing || snapshot.totalQuantity < 1) {
      return { ok: false, cartItemId: item.id, reason: "This design has no valid pricing." };
    }
    const locations = Math.max(
      1,
      snapshot.sides.filter((s) => s.objects.length > 0).length,
    );
    const perUnitPrinting = pricing.chartFirstLocationCost + pricing.chartAdditionalLocationCost * (locations - 1);
    const blankSubtotal = pricing.unitBasePrice * snapshot.totalQuantity;
    const printingSubtotal = perUnitPrinting * snapshot.totalQuantity;
    const total = blankSubtotal + pricing.designFee + printingSubtotal;

    return {
      ok: true,
      line: {
        cartItemId: item.id,
        productName: snapshot.productName,
        categorySlug: snapshot.categorySlug,
        colourName: snapshot.colourName,
        sizeBreakdown: snapshot.sizeBreakdown,
        quantity: snapshot.totalQuantity,
        unitPriceCents: Math.round(toCents(total) / snapshot.totalQuantity),
        lineTotalCents: toCents(total),
        customizationType: "CUSTOM",
        designProjectId: item.designProjectId,
        designFrozenRevision: project.frozenRevision,
        designSnapshot: snapshot,
      },
    };
  }

  if (item.customizationType === "BLANK") {
    if (!item.productSlug || !item.subcategorySlug) {
      return { ok: false, cartItemId: item.id, reason: "This item is missing product information." };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return { ok: false, cartItemId: item.id, reason: "Invalid quantity." };
    }
    const product = getProduct(item.categorySlug, item.subcategorySlug, item.productSlug);
    if (!product) return { ok: false, cartItemId: item.id, reason: "This product could not be found." };
    const blank = blankUnitPrice(product);
    if (blank === null) {
      return { ok: false, cartItemId: item.id, reason: "This item requires a custom quote and can't be purchased at checkout yet." };
    }

    return {
      ok: true,
      line: {
        cartItemId: item.id,
        productName: product.name,
        categorySlug: product.categorySlug,
        colourName: item.colourName ?? null,
        sizeBreakdown: item.sizeBreakdown ?? null,
        quantity: item.quantity,
        unitPriceCents: toCents(blank),
        lineTotalCents: toCents(blank) * item.quantity,
        customizationType: "BLANK",
        designProjectId: null,
        designFrozenRevision: null,
        designSnapshot: null,
      },
    };
  }

  return {
    ok: false,
    cartItemId: item.id,
    reason: "This item requires a custom quote and can't be purchased at checkout yet.",
  };
}
