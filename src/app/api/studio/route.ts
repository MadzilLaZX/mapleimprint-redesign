import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { PRINT_AREAS, PRINT_AREA_TEMPLATE_VERSION } from "@/lib/studio/printAreas";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import { getProduct } from "@/lib/products";
import { priceStudioDesign } from "@/lib/studio/serverPricing";
import { signPricing } from "@/lib/studio/pricingSignature";
import type { CreateDesignProjectInput } from "@/lib/studio/types";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing Studio session. Reload the product page and try again." }, { status: 400 });
  }

  let input: CreateDesignProjectInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!input.productSlug || !input.colourName || !input.sizeBreakdown?.length || input.totalQuantity < 1) {
    return NextResponse.json({ error: "Missing product configuration." }, { status: 400 });
  }
  if (input.sides.length === 0) {
    return NextResponse.json({ error: "A design needs at least one side." }, { status: 400 });
  }

  // The price is computed here from the catalogue and the customer's chosen options
  // (studio/serverPricing.ts) — never taken from the request. Only real, published products.
  const product = getProduct(input.categorySlug, input.subcategorySlug, input.productSlug);
  if (!product || product.status === "draft") {
    return NextResponse.json({ error: "This product isn't available." }, { status: 400 });
  }
  if (product.houseProductKind === "price-list") {
    // Price-listed print products: the canvas and sides come from the catalogue too.
    const canvas = product.studioCanvas;
    if (!canvas) {
      return NextResponse.json({ error: "This product can't be designed online yet." }, { status: 400 });
    }
    const size = { widthIn: canvas.widthIn, heightIn: canvas.heightIn };
    input = {
      ...input,
      productName: product.name,
      brandName: product.brandName,
      sizeBreakdown: [{ size: product.printSpecs?.printedSides ?? "Printed", qty: input.totalQuantity }],
      sides:
        canvas.kind === "banner"
          ? [{ type: "banner-face", ...size }]
          : [{ type: "print-front", ...size }, ...(canvas.surfaces === 2 ? [{ type: "print-back" as const, ...size }] : [])],
    };
  }
  const priced = priceStudioDesign(product, input.totalQuantity, input.pricingOptions ?? {}, input.sizeBreakdown);
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: 400 });
  }

  const supabase = createStudioClient(sessionToken);

  const { data: project, error: projectError } = await supabase
    .from("DesignProject")
    .insert({
      ownerSession: sessionToken,
      productSlug: input.productSlug,
      categorySlug: input.categorySlug,
      subcategorySlug: input.subcategorySlug,
      productName: input.productName,
      brandName: input.brandName,
      colourName: input.colourName,
      sizeBreakdown: input.sizeBreakdown,
      totalQuantity: input.totalQuantity,
      productTemplateVersion: PRINT_AREA_TEMPLATE_VERSION,
      pricingSnapshot: priced.snapshot,
      mockupImages: input.mockupImages,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    console.error("[studio] create project failed:", projectError);
    return NextResponse.json({ error: "Couldn't start your design. Please try again." }, { status: 502 });
  }

  const sideRows = input.sides.map((side) => ({
    designProjectId: project.id,
    sideType: side.type,
    printAreaWidth: side.widthIn ?? PRINT_AREAS[side.type].widthIn,
    printAreaHeight: side.heightIn ?? PRINT_AREAS[side.type].heightIn,
  }));

  const { error: sidesError } = await supabase.from("DesignSide").insert(sideRows);
  if (sidesError) {
    console.error("[studio] create sides failed:", sidesError);
    return NextResponse.json({ error: "Couldn't set up your design canvas. Please try again." }, { status: 502 });
  }

  // Sign the price now that the project id and its sized sides exist — see pricingSignature.ts.
  const sizedSides = sideRows
    .filter((_, i) => input.sides[i].widthIn !== undefined && input.sides[i].heightIn !== undefined)
    .map((s) => ({ sideType: s.sideType, widthIn: s.printAreaWidth, heightIn: s.printAreaHeight }));
  const signature = signPricing({
    projectId: project.id,
    productSlug: input.productSlug,
    categorySlug: input.categorySlug,
    subcategorySlug: input.subcategorySlug,
    colourName: input.colourName,
    sizeBreakdown: input.sizeBreakdown,
    totalQuantity: input.totalQuantity,
    sizedSides,
    pricing: priced.snapshot,
  });
  if (!signature) {
    // No signing key in this environment (checkout can't run here either — it needs the same key
    // for its admin client). The design still works; it just can't be charged until signed.
    console.error("[studio] pricing signature unavailable — SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ id: project.id });
  }
  const { error: signError } = await supabase
    .from("DesignProject")
    .update({ pricingSnapshot: { ...priced.snapshot, sizedSideTypes: sizedSides.map((s) => s.sideType), signature } })
    .eq("id", project.id);
  if (signError) {
    console.error("[studio] pricing signature save failed:", signError);
    return NextResponse.json({ error: "Couldn't start your design. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ id: project.id });
}
