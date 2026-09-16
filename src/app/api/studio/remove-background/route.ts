import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient, DESIGN_UPLOADS_BUCKET } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";

// Server-side only — never exposed to the browser (no NEXT_PUBLIC_ prefix, read only here). When
// unset, this route degrades exactly like every other optional integration in this codebase (see
// AUTOMATION.md's "Degrades gracefully" section): missing key -> a clear, friendly 503, never a
// raw vendor error, never a broken page, never a false "success."
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;
// Photoroom's "Remove Background API" (Basic plan) — verified against the current official docs
// (docs.photoroom.com/remove-background-api-basic-plan) before implementing, per the brief's "do
// not guess the API" requirement. POST multipart/form-data, `x-api-key` header auth, `image_file`
// binary field, returns raw image bytes (not JSON/base64) on 200.
const PHOTOROOM_ENDPOINT = "https://sdk.photoroom.com/v1/segment";
// Provider-documented limits (same page) — checked here BEFORE spending an API call, not just
// left for Photoroom to reject.
const MAX_SOURCE_BYTES = 50 * 1024 * 1024; // 50MB, Photoroom's own documented max
const PHOTOROOM_TIMEOUT_MS = 30_000;
// What Photoroom's Remove Background API accepts as INPUT (HEIC is documented as accepted input
// but this app never produces/stores HEIC — see upload/route.ts's own ALLOWED_TYPES — so it's
// listed here only for completeness, not because any path in this app can currently reach it).
const PHOTOROOM_ACCEPTED_INPUT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);

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
  let sourceContentType: string | null;
  try {
    const sourceRes = await fetch(body.imageUrl);
    if (!sourceRes.ok) throw new Error(`source fetch ${sourceRes.status}`);
    sourceContentType = sourceRes.headers.get("content-type");
    sourceBytes = await sourceRes.arrayBuffer();
  } catch (err) {
    console.error("[studio] background-removal source fetch failed:", err);
    return NextResponse.json({ error: "We couldn't read that image. Try uploading it again." }, { status: 502 });
  }

  // Validate the ACTUAL fetched payload, not just the filename/extension — this app only ever
  // stores PNG/JPEG (see upload/route.ts), so these should always pass; this is a defensive check
  // against a malformed/derived URL, not the primary format gate (that's at upload time).
  if (sourceBytes.byteLength === 0) {
    return NextResponse.json({ error: "That image appears to be empty. Try uploading it again." }, { status: 422 });
  }
  if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "That image is too large for background removal (50MB max)." }, { status: 422 });
  }
  if (sourceContentType && !PHOTOROOM_ACCEPTED_INPUT_TYPES.has(sourceContentType.split(";")[0].trim())) {
    return NextResponse.json({ error: "This image format isn't supported for background removal." }, { status: 422 });
  }

  let removedBytes: Buffer;
  try {
    const form = new FormData();
    form.append("image_file", new Blob([sourceBytes]), "source");
    // Explicit, not just relying on Photoroom's own defaults (which happen to match today, per
    // the current docs) — format=png keeps alpha transparency, size=full avoids any provider-side
    // downscaling (this is going to print), crop=false keeps the output the SAME pixel canvas as
    // the input so the subject's on-garment position doesn't shift (see StudioClient's
    // acceptRemovedBackground, which only ever patches assetUrl — x/y/width/height/rotation stay
    // exactly as they were, which only holds if the output image's own dimensions are unchanged).
    form.append("format", "png");
    form.append("size", "full");
    form.append("crop", "false");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHOTOROOM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(PHOTOROOM_ENDPOINT, {
        method: "POST",
        headers: { "x-api-key": PHOTOROOM_API_KEY },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      // Photoroom returns JSON error details on failure — logged server-side for diagnosis, never
      // forwarded to the customer (could contain account/billing details).
      const detail = await res.text().catch(() => "");
      console.error(`[studio] Photoroom request failed: ${res.status} ${detail.slice(0, 500)}`);
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: "Background removal isn't available right now. You can still use the image as uploaded." }, { status: 503 });
      }
      if (res.status === 402) {
        return NextResponse.json({ error: "Background removal isn't available right now. You can still use the image as uploaded." }, { status: 503 });
      }
      if (res.status === 429) {
        return NextResponse.json({ error: "Background removal is busy right now. Please try again in a moment." }, { status: 503 });
      }
      throw new Error(`photoroom ${res.status}`);
    }
    removedBytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[studio] Photoroom request timed out");
      return NextResponse.json(
        { error: "Background removal is taking too long. Your original image is unchanged — please try again." },
        { status: 504 },
      );
    }
    console.error("[studio] Photoroom request failed:", err);
    return NextResponse.json(
      { error: "Background removal couldn't be completed. Your original image is unchanged. Please try again." },
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
