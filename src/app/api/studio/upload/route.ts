import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStudioClient, DESIGN_UPLOADS_BUCKET } from "@/lib/studio/supabaseClient";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
// SVG is deliberately not accepted yet — safely sanitizing arbitrary customer SVG (stripping
// <script>, event handlers, external references) isn't implemented, and rendering unsanitized SVG
// in the canvas is a real XSS risk. PNG/JPG cover the MVP; add SVG once sanitization exists.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing Studio session. Reload the page and try again." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "We couldn't use this file type. Upload a PNG or JPG, or let Maple Imprint help prepare it." },
      { status: 422 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "That file is too large. Please upload something under 25MB." }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${sessionToken}/${crypto.randomUUID()}.${extension}`;

  const supabase = createStudioClient(sessionToken);
  const { error: uploadError } = await supabase.storage
    .from(DESIGN_UPLOADS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[studio] upload failed:", uploadError);
    return NextResponse.json({ error: "We couldn't open this file in Studio. Try another version, or let Maple Imprint help prepare it." }, { status: 502 });
  }

  const { data } = supabase.storage.from(DESIGN_UPLOADS_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
