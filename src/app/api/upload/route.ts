import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ATTACHMENTS_BUCKET, getSupabase } from "@/lib/automation/supabase";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = new Set(["ai", "eps", "pdf", "svg", "png", "jpg", "jpeg", "psd", "zip"]);

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "File uploads aren't configured yet. Describe your files in the notes field instead." },
      { status: 503 },
    );
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

  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: AI, EPS, PDF, SVG, PNG, JPEG, PSD, ZIP." },
      { status: 422 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large. Maximum size is 100MB." }, { status: 422 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${year}/${month}/uploads/${randomUUID()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || undefined, upsert: false });

  if (error) {
    console.error("[automation] Supabase Storage upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }

  return NextResponse.json({
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || null,
  });
}
