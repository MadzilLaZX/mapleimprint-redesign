import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import type { DesignObjectRecord, DesignProjectRecord, DesignSideType, PricingSnapshot } from "@/lib/studio/types";

async function requireSupabase() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) return null;
  return createStudioClient(sessionToken);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing Studio session." }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from("DesignProject")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    console.error("[studio] fetch project failed:", projectError);
    return NextResponse.json({ error: "Couldn't load your design." }, { status: 502 });
  }
  // RLS returning no row covers both "doesn't exist" and "belongs to a different session" —
  // deliberately the same 404 for both, so this never confirms/denies another session's project.
  if (!project) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  const { data: sides, error: sidesError } = await supabase
    .from("DesignSide")
    .select("*, DesignObject(*)")
    .eq("designProjectId", id);

  if (sidesError) {
    console.error("[studio] fetch sides failed:", sidesError);
    return NextResponse.json({ error: "Couldn't load your design." }, { status: 502 });
  }

  const record: DesignProjectRecord = {
    id: project.id,
    productSlug: project.productSlug,
    categorySlug: project.categorySlug,
    subcategorySlug: project.subcategorySlug,
    productName: project.productName,
    brandName: project.brandName,
    colourName: project.colourName,
    sizeBreakdown: project.sizeBreakdown,
    totalQuantity: project.totalQuantity,
    productTemplateVersion: project.productTemplateVersion,
    pricingSnapshot: project.pricingSnapshot,
    mockupImages: project.mockupImages ?? {},
    status: project.status,
    revision: project.revision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sides: (sides ?? []).map((s) => ({
      id: s.id,
      sideType: s.sideType,
      printAreaWidth: s.printAreaWidth,
      printAreaHeight: s.printAreaHeight,
      objects: (s.DesignObject ?? []).sort((a: DesignObjectRecord, b: DesignObjectRecord) => a.zIndex - b.zIndex),
    })),
  };

  return NextResponse.json(record);
}

interface PatchBody {
  sides?: { sideType: DesignSideType; objects: Omit<DesignObjectRecord, "id">[] }[];
  pricingSnapshot?: PricingSnapshot;
  status?: DesignProjectRecord["status"];
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireSupabase();
  if (!supabase) return NextResponse.json({ error: "Missing Studio session." }, { status: 400 });

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Full-replace-per-side autosave: simple and correct for MVP-scale object counts (tens, not
  // thousands, of objects per design). Diffing individual object mutations is a real optimization
  // but not one this needs yet.
  if (body.sides) {
    const { data: existingSides, error: sidesLookupError } = await supabase
      .from("DesignSide")
      .select("id, sideType")
      .eq("designProjectId", id);

    if (sidesLookupError || !existingSides) {
      console.error("[studio] side lookup failed:", sidesLookupError);
      return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
    }

    for (const sideUpdate of body.sides) {
      const side = existingSides.find((s) => s.sideType === sideUpdate.sideType);
      if (!side) continue; // this project's template doesn't have this side — ignore rather than error

      const { error: deleteError } = await supabase.from("DesignObject").delete().eq("designSideId", side.id);
      if (deleteError) {
        console.error("[studio] object clear failed:", deleteError);
        return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
      }

      if (sideUpdate.objects.length > 0) {
        const { error: insertError } = await supabase
          .from("DesignObject")
          .insert(sideUpdate.objects.map((o) => ({ ...o, designSideId: side.id })));
        if (insertError) {
          console.error("[studio] object insert failed:", insertError);
          return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
        }
      }
    }
  }

  const { error: updateError } = await supabase
    .from("DesignProject")
    .update({
      ...(body.pricingSnapshot ? { pricingSnapshot: body.pricingSnapshot } : {}),
      ...(body.status ? { status: body.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[studio] project update failed:", updateError);
    return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
