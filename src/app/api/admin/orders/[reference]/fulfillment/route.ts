import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { FULFILLMENT_STATUSES } from "@/lib/checkout/orderFulfillment";

/** Authorization: this route lives under /api/admin/, which proxy.ts's matcher
 *  ("/api/admin/:path*") already gates on a valid staff session cookie -- no auth check needed
 *  here, the request never reaches this handler without one.
 *
 *  All real validation (allowed transitions, PAID precondition, tracking-number requirement,
 *  idempotent duplicate handling, the row lock that makes concurrent requests safe) happens inside
 *  transition_order_fulfillment_status() (014_order_fulfillment_status.sql) -- this route is a
 *  thin translation layer: look up the order's id from its reference, call the function, forward
 *  its result. It never writes to MapleOrder directly. */
export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const toStatus = typeof body.toStatus === "string" ? body.toStatus : "";
  const shippingCarrier = typeof body.shippingCarrier === "string" && body.shippingCarrier.trim() ? body.shippingCarrier.trim() : null;
  const trackingNumber = typeof body.trackingNumber === "string" && body.trackingNumber.trim() ? body.trackingNumber.trim() : null;

  if (!FULFILLMENT_STATUSES.includes(toStatus as (typeof FULFILLMENT_STATUSES)[number])) {
    return NextResponse.json({ error: "Unknown fulfillment status." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: order } = await supabaseAdmin.from("MapleOrder").select("id").eq("reference", reference).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const { data, error } = await supabaseAdmin.rpc("transition_order_fulfillment_status", {
    p_order_id: order.id,
    p_to_status: toStatus,
    p_shipping_carrier: shippingCarrier,
    p_tracking_number: trackingNumber,
  });

  if (error) {
    console.error("[admin] transition_order_fulfillment_status RPC failed:", error);
    return NextResponse.json({ error: "Couldn't update fulfillment status." }, { status: 502 });
  }

  const result = data?.[0] as { success: boolean; error: string | null; new_status: string | null } | undefined;
  if (!result?.success) {
    return NextResponse.json({ error: result?.error ?? "Couldn't update fulfillment status." }, { status: 422 });
  }

  return NextResponse.json({ fulfillmentStatus: result.new_status });
}
