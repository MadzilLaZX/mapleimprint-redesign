import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import { loadDesignProjectRecord } from "@/lib/studio/loadProjectRecord";
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

  const { record, error } = await loadDesignProjectRecord(supabase, id);
  if (error) return NextResponse.json({ error: "Couldn't load your design." }, { status: 502 });
  // RLS returning no row covers both "doesn't exist" and "belongs to a different session" —
  // deliberately the same 404 for both, so this never confirms/denies another session's project.
  if (!record) return NextResponse.json({ error: "Design not found." }, { status: 404 });

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

  // A frozen/ordered design is the thing a cart line and, downstream, a paid order reference —
  // further autosaves here would silently change what was approved/purchased. Reject outright
  // rather than letting the full-replace autosave below corrupt it.
  const { data: current, error: currentError } = await supabase
    .from("DesignProject")
    .select("status, frozenAt, revision")
    .eq("id", id)
    .maybeSingle();
  if (currentError) {
    console.error("[studio] status check failed:", currentError);
    return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
  }
  if (!current) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  if (current.status === "ordered" || current.frozenAt) {
    return NextResponse.json(
      { error: "This design has been finalized and can no longer be edited." },
      { status: 409 },
    );
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
      // Only a real edit (sides mutation) counts as a new revision — a bare pricing/status touch
      // isn't a design change.
      ...(body.sides ? { revision: current.revision + 1 } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[studio] project update failed:", updateError);
    return NextResponse.json({ error: "Couldn't save your design." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
