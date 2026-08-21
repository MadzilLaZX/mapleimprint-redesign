import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { PRINT_AREAS, PRINT_AREA_TEMPLATE_VERSION } from "@/lib/studio/printAreas";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
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
      pricingSnapshot: input.pricingSnapshot,
      mockupImages: input.mockupImages,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    console.error("[studio] create project failed:", projectError);
    return NextResponse.json({ error: "Couldn't start your design. Please try again." }, { status: 502 });
  }

  const sideRows = input.sides.map((sideType) => ({
    designProjectId: project.id,
    sideType,
    printAreaWidth: PRINT_AREAS[sideType].widthIn,
    printAreaHeight: PRINT_AREAS[sideType].heightIn,
  }));

  const { error: sidesError } = await supabase.from("DesignSide").insert(sideRows);
  if (sidesError) {
    console.error("[studio] create sides failed:", sidesError);
    return NextResponse.json({ error: "Couldn't set up your design canvas. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ id: project.id });
}
