import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { PRINT_AREAS } from "@/lib/studio/printAreas";
import { decorationProfileFor } from "@/lib/studio/productDecorationProfile";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import type { DesignSideType } from "@/lib/studio/types";

/** Lazily adds one DesignSide to an existing project — used when a customer opens a location from
 *  the "More" menu (Section 23) that wasn't part of the project's initial STANDARD sides. Only
 *  locations the product's own ProductDecorationProfile actually lists (STANDARD or
 *  REVIEW_REQUIRED) can be added; this is what stops a request from fabricating a location a
 *  product's family doesn't support at all (e.g. "hood" on a t-shirt). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Missing Studio session." }, { status: 400 });

  let body: { sideType?: DesignSideType };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.sideType) return NextResponse.json({ error: "No location specified." }, { status: 400 });

  const supabase = createStudioClient(sessionToken);

  const { data: project, error: projectError } = await supabase
    .from("DesignProject")
    .select("categorySlug, subcategorySlug, mockupImages")
    .eq("id", id)
    .maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  const hasBackPhoto = Boolean((project.mockupImages as Record<string, string> | null)?.back);
  const profile = decorationProfileFor(project.categorySlug, project.subcategorySlug, hasBackPhoto);
  const location = profile.locations.find((l) => l.id === body.sideType);
  if (!location || location.status === "UNAVAILABLE") {
    return NextResponse.json({ error: "That location isn't available for this product." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("DesignSide")
    .select("id")
    .eq("designProjectId", id)
    .eq("sideType", body.sideType)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyExists: true });

  const area = PRINT_AREAS[body.sideType];
  const { error: insertError } = await supabase.from("DesignSide").insert({
    designProjectId: id,
    sideType: body.sideType,
    printAreaWidth: area.widthIn,
    printAreaHeight: area.heightIn,
  });
  if (insertError) {
    console.error("[studio] add location failed:", insertError);
    return NextResponse.json({ error: "Couldn't add that location. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, alreadyExists: false, requiresManualReview: location.requiresManualReview });
}
