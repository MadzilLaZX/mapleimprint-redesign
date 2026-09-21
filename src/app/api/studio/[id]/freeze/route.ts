import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import { loadDesignProjectRecord } from "@/lib/studio/loadProjectRecord";

/** Called once, at "Approve & add to cart" — turns the live, editable DesignProject into an
 *  immutable snapshot that a cart line / order can safely reference. Idempotent: calling this
 *  again on an already-frozen project just returns the existing snapshot rather than erroring,
 *  since the client may retry after a network blip. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Missing Studio session." }, { status: 400 });
  const supabase = createStudioClient(sessionToken);

  const { data: current, error: currentError } = await supabase
    .from("DesignProject")
    .select("frozenAt, designSnapshot, frozenRevision")
    .eq("id", id)
    .maybeSingle();
  if (currentError) {
    console.error("[studio] freeze status check failed:", currentError);
    return NextResponse.json({ error: "Couldn't finalize your design." }, { status: 502 });
  }
  if (!current) return NextResponse.json({ error: "Design not found." }, { status: 404 });

  if (current.frozenAt) {
    return NextResponse.json({
      frozenRevision: current.frozenRevision,
      designSnapshot: current.designSnapshot,
    });
  }

  const { record, error } = await loadDesignProjectRecord(supabase, id);
  if (error) return NextResponse.json({ error: "Couldn't finalize your design." }, { status: 502 });
  if (!record) return NextResponse.json({ error: "Design not found." }, { status: 404 });
  if (!record.sides.some((s) => s.objects.length > 0)) {
    return NextResponse.json({ error: "Add at least one design element before approving." }, { status: 422 });
  }

  const frozenAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("DesignProject")
    .update({
      frozenAt,
      designSnapshot: record,
      frozenRevision: record.revision,
      status: "ordered",
      updatedAt: frozenAt,
    })
    .eq("id", id);

  if (updateError) {
    console.error("[studio] freeze update failed:", updateError);
    return NextResponse.json({ error: "Couldn't finalize your design." }, { status: 502 });
  }

  return NextResponse.json({ frozenRevision: record.revision, designSnapshot: record });
}
