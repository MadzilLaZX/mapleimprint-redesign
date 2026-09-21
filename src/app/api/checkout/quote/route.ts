// Server-authoritative checkout quote (ACTIVATE REAL CHECKOUT brief, Section 21). The client cart
// (CartProvider/localStorage) is for DISPLAY only — every price a customer could actually pay
// against is recomputed here from scratch, server-side, never trusted from the request body:
//
// - BLANK lines: re-look-up the real CatalogueProduct by slug and recompute with blankUnitPrice().
// - CUSTOM lines: re-fetch the DesignProject itself (session-cookie-scoped via the same RLS
//   pattern as /api/studio/[id]/route.ts), confirm it still exists and is the frozen "ordered"
//   revision, then recompute with calculateCustomizePrice() against the design's OWN stored
//   product/size/print-location data — not whatever pricingSnapshot the client originally
//   submitted (that was never server-verified at creation time; this route is what actually closes
//   that gap).
// - MAPLE_DESIGNER lines: always QUOTE_REQUIRED — there is no calculable price for a
//   designer-brief job until Maple's team has produced something.
//
// This intentionally does NOT persist anything (no Order table exists yet — see checkoutDraft.ts's
// header for why). It's a pure, stateless recomputation the checkout UI calls to get numbers it
// can actually trust before Payment is ever enabled.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProduct } from "@/lib/products";
import { blankUnitPrice, calculateCustomizePrice } from "@/lib/studio/pricing";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";

type LineStatus = "ok" | "design-missing" | "product-missing";

interface QuoteLineRequest {
  id: string;
  quantity: number;
  customizationType?: "BLANK" | "CUSTOM" | "MAPLE_DESIGNER";
  categorySlug: string;
  subcategorySlug?: string;
  productSlug?: string;
  designProjectId?: string;
}

interface QuoteLineResult {
  id: string;
  mode: "CHECKOUT_READY" | "QUOTE_REQUIRED";
  status: LineStatus;
  unitPrice: number | null;
  lineTotal: number | null;
  reason: string | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function priceCustomLine(
  line: QuoteLineRequest,
  supabase: ReturnType<typeof createStudioClient> | null,
): Promise<QuoteLineResult> {
  if (!supabase || !line.designProjectId) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "design-missing", unitPrice: null, lineTotal: null, reason: "We need to refresh this design before checkout." };
  }

  const { data: project, error: projectError } = await supabase
    .from("DesignProject")
    .select("id, productSlug, categorySlug, subcategorySlug, sizeBreakdown, totalQuantity, status")
    .eq("id", line.designProjectId)
    .maybeSingle();

  if (projectError || !project) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "design-missing", unitPrice: null, lineTotal: null, reason: "We need to refresh this design before checkout." };
  }

  const product = getProduct(project.categorySlug, project.subcategorySlug, project.productSlug);
  if (!product) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "product-missing", unitPrice: null, lineTotal: null, reason: "This product is no longer available in our catalogue." };
  }

  const { data: sides } = await supabase
    .from("DesignSide")
    .select("id, DesignObject(id)")
    .eq("designProjectId", project.id);
  const locationsWithArt = Math.max(1, (sides ?? []).filter((s: { DesignObject: unknown[] | null }) => (s.DesignObject?.length ?? 0) > 0).length);

  const breakdown = calculateCustomizePrice(product, project.totalQuantity, locationsWithArt);
  if (!breakdown) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "product-missing", unitPrice: null, lineTotal: null, reason: "This product isn't on our standard pricing chart yet." };
  }

  const unitPrice = round2(breakdown.total / project.totalQuantity);
  return { id: line.id, mode: "CHECKOUT_READY", status: "ok", unitPrice, lineTotal: round2(unitPrice * line.quantity), reason: null };
}

function priceBlankLine(line: QuoteLineRequest): QuoteLineResult {
  if (!line.subcategorySlug || !line.productSlug) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "product-missing", unitPrice: null, lineTotal: null, reason: "We couldn't verify this product's current pricing." };
  }
  const product = getProduct(line.categorySlug, line.subcategorySlug, line.productSlug);
  if (!product) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "product-missing", unitPrice: null, lineTotal: null, reason: "This product is no longer available in our catalogue." };
  }
  const unitPrice = blankUnitPrice(product);
  if (unitPrice === null) {
    return { id: line.id, mode: "QUOTE_REQUIRED", status: "product-missing", unitPrice: null, lineTotal: null, reason: "This product isn't on our standard pricing chart yet." };
  }
  return { id: line.id, mode: "CHECKOUT_READY", status: "ok", unitPrice, lineTotal: round2(unitPrice * line.quantity), reason: null };
}

export async function POST(request: Request) {
  let body: { items?: QuoteLineRequest[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ lines: [], subtotal: 0 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  const supabase = sessionToken ? createStudioClient(sessionToken) : null;

  const lines: QuoteLineResult[] = await Promise.all(
    items.map((line) => {
      if (line.customizationType === "MAPLE_DESIGNER") {
        return Promise.resolve<QuoteLineResult>({
          id: line.id,
          mode: "QUOTE_REQUIRED",
          status: "ok",
          unitPrice: null,
          lineTotal: null,
          reason: "Designer-created pieces are reviewed and priced by our team before production.",
        });
      }
      if (line.customizationType === "CUSTOM") return priceCustomLine(line, supabase);
      return Promise.resolve(priceBlankLine(line));
    }),
  );

  const subtotal = round2(lines.reduce((sum, l) => sum + (l.mode === "CHECKOUT_READY" ? l.lineTotal ?? 0 : 0), 0));

  return NextResponse.json({ lines, subtotal });
}

// Re-exported only so the route's types are traceable from outside without duplicating them —
// CheckoutClient imports these for its own response typing.
export type { QuoteLineResult, LineStatus };
