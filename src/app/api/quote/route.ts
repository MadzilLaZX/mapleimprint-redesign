import { NextResponse } from "next/server";

function randomReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MI-${code}`;
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

  if (!email || !name) {
    return NextResponse.json(
      { error: "Name and email are required to submit a quote request." },
      { status: 422 },
    );
  }

  // NOTE: this endpoint currently validates and acknowledges the request only.
  // Wiring to real email delivery / CRM intake is tracked in PROJECT_NOTES.md
  // as part of the commerce-architecture phase, once staff workflow tooling
  // (see ARCHITECTURE_DECISION section) is chosen.
  const reference = randomReference();

  return NextResponse.json({ reference });
}
