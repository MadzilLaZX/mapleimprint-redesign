import { getSupabase } from "./supabase";
import type { NormalizedInquiry, ScoredInquiry } from "./types";

/**
 * Persists a scored inquiry as an `inquiries` row, plus one `attachments`
 * row per already-uploaded file (paths come from /api/upload, called
 * separately by the quote wizard before final submit). No-ops when
 * Supabase isn't configured — the caller still returns a reference number
 * to the user either way.
 */
export async function saveInquiry(
  inquiry: ScoredInquiry,
  attachmentPaths: { storagePath: string; fileName: string; fileSize?: number; contentType?: string }[] = [],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("[automation] Supabase not configured; skipping CRM write for", inquiry.reference);
    return;
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      reference: inquiry.reference,
      source: inquiry.source,
      name: inquiry.name,
      organization: inquiry.organization || null,
      email: inquiry.email,
      phone: inquiry.phone || null,
      preferred_contact: inquiry.preferredContact || null,
      project_type: inquiry.projectType || null,
      product_description: inquiry.productDescription || null,
      quantity: inquiry.quantity || null,
      budget_range: inquiry.budgetRange || null,
      decoration_method: inquiry.decorationMethod || null,
      placements: inquiry.placements || null,
      needed_by: inquiry.neededBy || null,
      event_date: inquiry.eventDate || null,
      delivery_method: inquiry.deliveryMethod || null,
      postal_code: inquiry.postalCode || null,
      message: inquiry.message || null,
      score: inquiry.score,
      tags: inquiry.tags,
      raw_payload: inquiry satisfies NormalizedInquiry as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[automation] Failed to insert inquiry:", error);
    return;
  }

  if (attachmentPaths.length > 0) {
    const { error: attachmentError } = await supabase.from("attachments").insert(
      attachmentPaths.map((a) => ({
        inquiry_id: data.id,
        storage_path: a.storagePath,
        file_name: a.fileName,
        file_size: a.fileSize ?? null,
        content_type: a.contentType ?? null,
      })),
    );
    if (attachmentError) {
      console.error("[automation] Failed to insert attachments:", attachmentError);
    }
  }
}
