import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { priceCartItem, type CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";
import { taxProvider } from "@/lib/checkout/taxProvider";
import { shippingProvider } from "@/lib/checkout/shippingProvider";
import { ShippingRateUnavailableError, OTTAWA_PICKUP_OPTION } from "@/lib/checkout/canadaPostShippingProvider";
import { PICKUP_LOCATION } from "@/lib/checkout/pickupLocation";

interface QuoteRequestBody {
  items: CheckoutCartItemInput[];
  /** Required for "delivery", absent/ignored for "pickup" -- the fulfillment selector never
   *  collects a delivery address when pickup is chosen. */
  shippingAddress?: { province: string; country: string; postalCode: string };
  /** Defaults to "delivery" -- existing callers that don't send this field are unaffected.
   *  "pickup" means Ottawa local pickup: free, and taxed at Ontario's point-of-sale rate
   *  regardless of shippingAddress. */
  fulfillmentMethod?: "delivery" | "pickup";
}

/**
 * Display-only recompute of the checkout total — never trusts any price the browser sends,
 * independently re-derives every line from the real catalogue / frozen design snapshot. This is
 * NOT the authoritative charge amount: /api/checkout/pay repeats this exact recompute immediately
 * before calling Square, so a stale quote can never be used to pay a stale total.
 */
export async function POST(request: Request) {
  let body: QuoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const results = await Promise.all(body.items.map((item) => priceCartItem(item, supabaseAdmin)));

  const unresolved = results.filter((r) => !r.ok) as Extract<(typeof results)[number], { ok: false }>[];
  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: "Some items in your cart can't be checked out yet.",
        unresolvedItems: unresolved.map((r) => ({ cartItemId: r.cartItemId, reason: r.reason })),
      },
      { status: 422 },
    );
  }

  const lines = results
    .filter((r): r is Extract<(typeof results)[number], { ok: true }> => r.ok)
    .map((r) => r.line);

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const isPickup = body.fulfillmentMethod === "pickup";

  let shippingOption: { id: string; label: string; cents: number };
  if (isPickup) {
    // No carrier rate needed for pickup -- never call the shipping provider at all.
    shippingOption = OTTAWA_PICKUP_OPTION;
  } else {
    if (!body.shippingAddress) {
      return NextResponse.json({ error: "A delivery address is required to calculate shipping." }, { status: 400 });
    }
    let shippingOptions: Awaited<ReturnType<typeof shippingProvider.getOptions>>;
    try {
      shippingOptions = await shippingProvider.getOptions(
        body.shippingAddress,
        subtotalCents,
        lines.map((l) => ({ unitWeightLb: l.unitWeightLb, quantity: l.quantity })),
      );
    } catch (err) {
      if (err instanceof ShippingRateUnavailableError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      console.error("[checkout] shipping quote failed:", err);
      return NextResponse.json(
        { error: "We couldn't get a shipping rate for this address right now. Please try again or contact us." },
        { status: 502 },
      );
    }
    shippingOption = shippingOptions[0] ?? { id: "free", label: "Free Shipping", cents: 0 };
  }

  const { taxCents, breakdown: taxBreakdown } = await taxProvider.calculate({
    subtotalCents,
    shippingCents: shippingOption.cents,
    // PICKUP_LOCATION for pickup -- same reasoning as /api/checkout/pay: the sale is physically
    // completed there, and isPickup forces Ontario regardless of whatever this value is anyway.
    shippingAddress: isPickup ? PICKUP_LOCATION : body.shippingAddress!,
    isPickup,
  });

  const totalCents = subtotalCents + shippingOption.cents + taxCents;

  return NextResponse.json({
    lines: lines.map(({ designSnapshot: _designSnapshot, ...rest }) => rest),
    subtotalCents,
    shippingCents: shippingOption.cents,
    shippingOption,
    taxCents,
    taxBreakdown,
    totalCents,
    currency: "CAD",
  });
}
