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
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";

  if (!email || !name || !date || !time) {
    return NextResponse.json(
      { error: "Name, email, date and time are required to request an appointment." },
      { status: 422 },
    );
  }

  if (new Date(date).getDay() === 0) {
    return NextResponse.json({ error: "We're closed Sundays. Choose another day." }, { status: 422 });
  }

  const inquiry: NormalizedInquiry = {
    source: "appointment",
    name,
    email,
    phone: typeof body.phone === "string" ? body.phone.trim() || undefined : undefined,
    message: `Appointment requested for ${date} at ${time}.`,
    neededBy: date,
  };

  const { score, tags } = scoreInquiry(inquiry);
  const reference = await generateReference();
  const scored = { ...inquiry, reference, score, tags };

  await saveInquiry(scored);
  await notifyInquiry(scored);

  return NextResponse.json({ reference });
}
