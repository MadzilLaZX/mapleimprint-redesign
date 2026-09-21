import Link from "next/link";
import { Check, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { createAdminClient } from "@/lib/server/supabaseAdmin";

interface OrderLine {
  productName: string;
  quantity: number;
  colourName: string | null;
  customizationType: string | null;
}

/**
 * `reference` is a high-entropy, non-sequential token (see generateOrderReference.ts) — it IS the
 * access control for this page, since it reads via the service-role client. Do not add a lookup
 * that also works by internal id, and never list/enumerate orders from this route.
 */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: order } = await supabaseAdmin
    .from("MapleOrder")
    .select("id, reference, status, contactName, contactEmail, shippingAddress, totalCents, currency")
    .eq("reference", reference)
    .maybeSingle();

  if (!order) {
    return (
      <Container className="max-w-lg py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Order not found</h1>
        <p className="mt-3 text-sm text-muted">
          We couldn&apos;t find an order with that reference. Double-check the link, or{" "}
          <Link href="/contact" className="underline underline-offset-2">
            contact us
          </Link>{" "}
          if you think this is a mistake.
        </p>
      </Container>
    );
  }

  const { data: lines } = await supabaseAdmin
    .from("MapleOrderLine")
    .select("productName, quantity, colourName, customizationType")
    .eq("orderId", order.id);

  const firstName = order.contactName.split(" ")[0] || order.contactName;
  const address = order.shippingAddress as { city?: string; province?: string } | null;

  if (order.status !== "PAID") {
    return (
      <Container className="max-w-lg py-24 text-center">
        <SpinnerGap className="mx-auto size-8 animate-spin text-muted" weight="bold" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Confirming your payment…</h1>
        <p className="mt-3 text-sm text-muted">
          {order.status === "PAYMENT_FAILED" || order.status === "CANCELLED"
            ? "This order's payment didn't go through. If you were charged, contact us with this reference."
            : "This usually takes just a few seconds. Refresh this page in a moment."}
        </p>
        <p className="mt-4 text-xs text-muted">Order {order.reference}</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-lg py-16 text-center lg:py-24">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-crimson/10 text-crimson">
        <Check className="size-6" weight="bold" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-ink-900 lg:text-3xl">Order confirmed</h1>
      <p className="mt-2 text-sm font-semibold text-ink-900">{order.reference}</p>
      <p className="mt-4 text-sm text-muted">
        Thanks, {firstName}. We&apos;ve received your order.
        <br />
        Confirmation sent to {order.contactEmail}.
      </p>
      {address?.city && (
        <p className="mt-1 text-sm text-muted">
          Shipping to {address.city}
          {address.province ? `, ${address.province}` : ""}
        </p>
      )}

      <div className="mt-8 rounded-[24px] bg-white p-6 text-left">
        <ul className="divide-y divide-sand">
          {(lines ?? []).map((line: OrderLine, i: number) => (
            <li key={i} className="flex items-center justify-between py-3 text-sm">
              <span className="text-ink-900">
                {line.productName}
                {line.colourName ? ` (${line.colourName})` : ""} × {line.quantity}
              </span>
              {line.customizationType === "CUSTOM" && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-crimson">Custom</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-sand pt-3 font-display text-base font-semibold text-ink-900">
          <span>Total paid</span>
          <span>${(order.totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] bg-canvas p-6 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">What happens next</p>
        <ol className="mt-3 space-y-2 text-sm text-ink-900">
          <li>✓ Design approved</li>
          <li>✓ Payment received</li>
          <li className="text-muted">Preparing for production</li>
          <li className="text-muted">Printing</li>
          <li className="text-muted">Shipping</li>
        </ol>
      </div>

      <Link href="/shop" className="mt-8 inline-block rounded-full bg-maple-gradient px-6 py-3 text-sm font-semibold text-ink-950">
        Continue shopping
      </Link>
    </Container>
  );
}
