import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Enter both an order number and email." }, { status: 422 });
  }

  // Order lookup is not connected to a commerce backend yet (see
  // ARCHITECTURE_DECISION note in PROJECT_NOTES.md), so every lookup
  // honestly reports "not found" rather than fabricating order data.
  return NextResponse.json(
    { error: "We couldn't find a matching order. Double-check the order number, or contact us for help." },
    { status: 404 },
  );
}
