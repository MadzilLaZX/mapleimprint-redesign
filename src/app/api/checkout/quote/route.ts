import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { priceCartItem, type CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";
import { taxProvider } from "@/lib/checkout/taxProvider";
import { shippingProvider } from "@/lib/checkout/shippingProvider";

interface QuoteRequestBody {
  items: CheckoutCartItemInput[];
  shippingAddress: { province: string; country: string; postalCode: string };
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

  const shippingOptions = await shippingProvider.getOptions(body.shippingAddress);
  const shippingOption = shippingOptions[0] ?? { id: "free", label: "Free Shipping", cents: 0 };

  const { taxCents, breakdown: taxBreakdown } = await taxProvider.calculate({
    subtotalCents,
    shippingAddress: body.shippingAddress,
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
