import { NextResponse } from "next/server";
import { notifyInquiry } from "@/lib/automation/notify";
import { generateReference } from "@/lib/automation/reference";
import { saveInquiry } from "@/lib/automation/save";
import { scoreInquiry } from "@/lib/automation/scoring";
import type { NormalizedInquiry } from "@/lib/automation/types";

type UploadedFile = { storagePath: string; fileName: string; fileSize?: number; contentType?: string };

function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = str(body, "email");
  const name = str(body, "name");

  if (!email || !name) {
    return NextResponse.json(
      { error: "Name and email are required to submit a quote request." },
      { status: 422 },
    );
  }

  const uploadedFiles: UploadedFile[] = Array.isArray(body.uploadedFiles)
    ? (body.uploadedFiles as UploadedFile[]).filter(
        (f) => f && typeof f.storagePath === "string" && typeof f.fileName === "string",
      )
    : [];

  const inquiry: NormalizedInquiry = {
    source: "quote",
    name,
    email,
    organization: str(body, "organization") || undefined,
    phone: str(body, "phone") || undefined,
    preferredContact: str(body, "preferredContact") || undefined,
    projectType: str(body, "projectType") || undefined,
    productDescription: str(body, "productDescription") || undefined,
    quantity: str(body, "quantity") || undefined,
    budgetRange: str(body, "budgetRange") || undefined,
    decorationMethod: str(body, "decorationMethod") || undefined,
    placements: str(body, "placements") || undefined,
    designHelp: body.designHelp === true,
    neededBy: str(body, "neededBy") || undefined,
    eventDate: str(body, "eventDate") || undefined,
    deliveryMethod: str(body, "deliveryMethod") || undefined,
    postalCode: str(body, "postalCode") || undefined,
    fileNames: uploadedFiles.map((f) => f.fileName),
  };

  const { score, tags } = scoreInquiry(inquiry);
  const reference = await generateReference();
  const scored = { ...inquiry, reference, score, tags };

  await saveInquiry(scored, uploadedFiles);
  await notifyInquiry(scored);

  return NextResponse.json({ reference });
}
