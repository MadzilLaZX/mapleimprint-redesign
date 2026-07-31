import { NextResponse } from "next/server";
import { notifyInquiry } from "@/lib/automation/notify";
import { generateReference } from "@/lib/automation/reference";
import { saveInquiry } from "@/lib/automation/save";
import { scoreInquiry } from "@/lib/automation/scoring";
import type { NormalizedInquiry } from "@/lib/automation/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!email || !name || !message) {
    return NextResponse.json({ error: "Name, email and message are required." }, { status: 422 });
  }

  const inquiry: NormalizedInquiry = { source: "contact", name, email, message };

  const { score, tags } = scoreInquiry(inquiry);
  const reference = await generateReference();
  const scored = { ...inquiry, reference, score, tags };

  await saveInquiry(scored);
  await notifyInquiry(scored);

  return NextResponse.json({ ok: true, reference });
}
