import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim().toUpperCase() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Enter both an order number and email." }, { status: 422 });
  }

  // ilike's `%`/`_` are pattern wildcards -- escape any literal occurrence in the submitted email
  // so it can't accidentally broaden the match beyond an exact (case-insensitive) address. The
  // order reference itself is the real access-control boundary (high-entropy, see
  // generateOrderReference.ts); this is defense in depth, not the only thing standing between a
  // guesser and someone else's order.
  const escapedEmail = email.replace(/[%_]/g, (c) => `\\${c}`);

  const supabaseAdmin = createAdminClient();
  const { data: order } = await supabaseAdmin
    .from("MapleOrder")
    .select("reference")
    .eq("reference", orderNumber)
    .ilike("contactEmail", escapedEmail)
    .maybeSingle();

  const notFound = NextResponse.json(
    { error: "We couldn't find a matching order. Double-check the order number, or contact us for help." },
    { status: 404 },
  );
  if (!order) return notFound;

  return NextResponse.json({ reference: order.reference });
}
