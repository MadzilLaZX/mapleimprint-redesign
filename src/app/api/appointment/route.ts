import { NextResponse } from "next/server";

function randomReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MI-APT-${code}`;
}

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

  // NOTE: this endpoint validates and acknowledges the request only. It does
  // not yet check a real calendar for conflicts or write to one — wiring to
  // real scheduling (and email confirmation) is tracked in PROJECT_NOTES.md
  // alongside the other intake endpoints.
  const reference = randomReference();

  return NextResponse.json({ reference });
}
