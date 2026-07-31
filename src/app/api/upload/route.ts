import { NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/automation/drive";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = new Set(["ai", "eps", "pdf", "svg", "png", "jpg", "jpeg", "psd", "zip"]);

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
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

  const bytes = Buffer.from(await file.arrayBuffer());

  let uploaded;
  try {
    uploaded = await uploadToDrive(bytes, file.name, file.type || null);
  } catch (err) {
    console.error("[automation] Google Drive upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }

  if (!uploaded) {
    return NextResponse.json(
      { error: "File uploads aren't configured yet. Describe your files in the notes field instead." },
      { status: 503 },
    );
  }

  return NextResponse.json(uploaded);
}
