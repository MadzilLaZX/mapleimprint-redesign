import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignObjectRecord, DesignProjectRecord } from "@/lib/studio/types";

/** Shared by GET /api/studio/[id] and the freeze endpoint — both need the same fully-assembled
 *  project+sides+objects shape, and the freeze snapshot must be byte-for-byte the same structure
 *  a live load would produce, so this is one function rather than two copies that could drift. */
export async function loadDesignProjectRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  id: string,
): Promise<{ record: DesignProjectRecord | null; error: "load_failed" | null }> {
  const { data: project, error: projectError } = await supabase
    .from("DesignProject")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    console.error("[studio] fetch project failed:", projectError);
    return { record: null, error: "load_failed" };
  }
  if (!project) return { record: null, error: null };

  const { data: sides, error: sidesError } = await supabase
    .from("DesignSide")
    .select("*, DesignObject(*)")
    .eq("designProjectId", id);

  if (sidesError) {
    console.error("[studio] fetch sides failed:", sidesError);
    return { record: null, error: "load_failed" };
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
      objects: (s.DesignObject ?? []).sort(
        (a: DesignObjectRecord, b: DesignObjectRecord) => a.zIndex - b.zIndex,
      ),
    })),
  };

  return { record, error: null };
}
