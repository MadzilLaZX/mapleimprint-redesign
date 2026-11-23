import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { PRINT_AREAS, PRINT_AREA_TEMPLATE_VERSION } from "@/lib/studio/printAreas";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import type { CreateDesignProjectInput } from "@/lib/studio/types";

const SAVED_DESIGNS_LIMIT = 20;

/** "My saved designs" discovery -- lets a customer who lost their /studio/[id] link find their way
 *  back to it, without a login system. Safe within the EXISTING trust model, not a new one: the
 *  session-scoped client (createStudioClient) sends the `x-mi-session` header the DesignProject
 *  RLS policies already key off everywhere else (see supabaseClient.ts, and GET /api/studio/[id]'s
 *  own comment) -- a plain SELECT with no id filter returns exactly this cookie's own rows, no
 *  more and no less, the same guarantee already relied on to read ANY single design by id. Nothing
 *  here is reachable by a guessed id, and nothing exposes another session's rows: RLS enforces
 *  that, not application code. What this does NOT solve -- recovering designs from a different
 *  browser/device, or after this cookie is cleared -- would need a real account system, a separate
 *  decision outside this change's scope; this only recovers what the SAME browser can already
 *  authenticate for via the cookie it already holds. */
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ projects: [] });

  const supabase = createStudioClient(sessionToken);
  const { data: projects, error } = await supabase
    .from("DesignProject")
    .select("id, productName, colourName, totalQuantity, status, mockupImages, updatedAt")
    .order("updatedAt", { ascending: false })
    .limit(SAVED_DESIGNS_LIMIT);

  if (error) {
    console.error("[studio] list projects failed:", error);
    return NextResponse.json({ error: "Couldn't load your saved designs." }, { status: 502 });
  }

  return NextResponse.json({ projects: projects ?? [] });
}

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

  return NextResponse.json({ id: project.id });
}
