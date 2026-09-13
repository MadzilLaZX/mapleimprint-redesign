import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient, DESIGN_UPLOADS_BUCKET } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";

// Server-side only — never exposed to the browser. Not configured in this environment (no real
// Photoroom account), so this route degrades exactly like every other optional integration in
// this codebase (see AUTOMATION.md's "Degrades gracefully" section for the established pattern):
// missing key -> a clear, friendly 503, never a raw vendor error, never a broken page.
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;
const PHOTOROOM_ENDPOINT = "https://sdk.photoroom.com/v1/segment";

function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${DESIGN_UPLOADS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

/** Derived path is a deterministic function of the original's own path, not a fresh random id —
 *  this is what makes the "already processed, don't pay twice" check possible: re-requesting the
 *  same source image always maps to the same derived path, so it can be checked for existence
 *  before ever calling Photoroom again. */
function derivedPathFor(originalPath: string): string {
  const dot = originalPath.lastIndexOf(".");
  const base = dot === -1 ? originalPath : originalPath.slice(0, dot);
  return `${base}-nobg.png`;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing Studio session. Reload the page and try again." }, { status: 400 });
  }

  if (!PHOTOROOM_API_KEY) {
    return NextResponse.json(
      { error: "Background removal isn't available yet. You can still use the image as uploaded, or let Maple Imprint help prepare it." },
      { status: 503 },
    );
  }

  let body: { imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.imageUrl) {
    return NextResponse.json({ error: "No image specified." }, { status: 400 });
  }

  const originalPath = pathFromPublicUrl(body.imageUrl);
  if (!originalPath || !originalPath.startsWith(`${sessionToken}/`)) {
    // Also blocks a session trying to background-remove another session's upload — every path in
    // this bucket is session-prefixed (see /api/studio/upload), so a mismatch here means either a
    // malformed URL or someone passing an id that was never theirs.
    return NextResponse.json({ error: "That image can't be processed." }, { status: 400 });
  }

  const supabase = createStudioClient(sessionToken);
  const derivedPath = derivedPathFor(originalPath);

  // Duplicate-cost prevention: if this exact source was already processed successfully, reuse it
  // instead of calling Photoroom (and paying) again for the same click.
  const existing = supabase.storage.from(DESIGN_UPLOADS_BUCKET).getPublicUrl(derivedPath);
  const existingCheck = await fetch(existing.data.publicUrl, { method: "HEAD" }).catch(() => null);
  if (existingCheck?.ok) {
    return NextResponse.json({ url: existing.data.publicUrl, reused: true });
  }

  let sourceBytes: ArrayBuffer;
  try {
    const sourceRes = await fetch(body.imageUrl);
    if (!sourceRes.ok) throw new Error(`source fetch ${sourceRes.status}`);
    sourceBytes = await sourceRes.arrayBuffer();
  } catch (err) {
    console.error("[studio] background-removal source fetch failed:", err);
    return NextResponse.json({ error: "We couldn't read that image. Try uploading it again." }, { status: 502 });
  }

  let removedBytes: Buffer;
  try {
    const form = new FormData();
    form.append("image_file", new Blob([sourceBytes]), "source");
    const res = await fetch(PHOTOROOM_ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": PHOTOROOM_API_KEY },
      body: form,
    });
    if (!res.ok) throw new Error(`photoroom ${res.status}`);
    removedBytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[studio] Photoroom request failed:", err);
    return NextResponse.json(
      { error: "We couldn't remove this background automatically. You can try again, or keep the original." },
      { status: 502 },
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(DESIGN_UPLOADS_BUCKET)
    .upload(derivedPath, removedBytes, { contentType: "image/png", upsert: true });
  if (uploadError) {
    console.error("[studio] derived-image upload failed:", uploadError);
    return NextResponse.json({ error: "We removed the background but couldn't save the result. Please try again." }, { status: 502 });
  }

  const { data } = supabase.storage.from(DESIGN_UPLOADS_BUCKET).getPublicUrl(derivedPath);
  return NextResponse.json({ url: data.publicUrl, reused: false });
}
