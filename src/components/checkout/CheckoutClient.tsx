"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/CartProvider";
import { splitCartByPurchaseMode } from "@/lib/commerce/purchaseMode";
import {
  isContactValid,
  isDeliveryValid,
  loadCheckoutDraft,
  saveCheckoutDraft,
  clearCheckoutDraft,
  type ContactDraft,
  type DeliveryDraft,
} from "@/lib/commerce/checkoutDraft";
import { ContactSection } from "@/components/checkout/ContactSection";
import { DeliverySection } from "@/components/checkout/DeliverySection";
import { PaymentSection } from "@/components/checkout/PaymentSection";
import { OrderSummary, type SummaryLine } from "@/components/checkout/OrderSummary";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import type { QuoteLineResult } from "@/app/api/checkout/quote/route";

type SectionId = "contact" | "delivery" | "payment";

/** Checkout's orchestrator — hydrates the cart, revalidates pricing server-side (Section 21), owns
 *  Contact → Delivery → Payment progression, and guards against an empty/fully-quote-required cart
 *  ever landing here (Section 11). Square itself is out of scope (Section 39) — PaymentSection's
 *  slot is the only thing that changes when it's connected later. */
export function CheckoutClient({ testCheckoutEnabled }: { testCheckoutEnabled: boolean }) {
  const { items, hydrated, removeItem } = useCart();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const split = useMemo(() => splitCartByPurchaseMode(items), [items]);
  const readyIds = split.readyItems.map((i) => i.id).join(",");

  const [quote, setQuote] = useState<{ lines: QuoteLineResult[]; subtotal: number } | null>(null);
  // Derived, not its own state — a `setQuoteLoading(true)` as the first statement of the effect
  // below would be a synchronous setState-in-effect (react-hooks/set-state-in-effect flags this as
  // a cascading-render risk, the same class of issue fixed in the QR work's session-hydration
  // effect). Comparing "which readyIds set is the current `quote` actually for" gives the same
  // loading boolean without ever needing to set it eagerly.
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const quoteLoading = split.readyItems.length > 0 && quoteFor !== readyIds;
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  const [activeSection, setActiveSection] = useState<SectionId>("contact");
  const [contact, setContact] = useState<ContactDraft>(() => loadCheckoutDraft().contact);
  const [delivery, setDelivery] = useState<DeliveryDraft>(() => loadCheckoutDraft().delivery);

  // Section 11: an empty cart, or a cart with nothing CHECKOUT_READY, has nothing for this route
  // to do — redirect to /cart (which already shows the right empty/quote-only messaging) rather
  // than rendering a broken checkout. Never fires mid-Test-Checkout success (that legitimately
  // empties `readyItems` on purpose).
  useEffect(() => {
    if (!hydrated || testCompleted) return;
    if (items.length === 0 || split.readyItems.length === 0) router.replace("/cart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.length, split.readyItems.length, testCompleted]);

  // Section 21: revalidate every ready line's price server-side before showing anything payable.
  useEffect(() => {
    if (!hydrated || split.readyItems.length === 0) return;
    let cancelled = false;
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: split.readyItems.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          customizationType: i.customizationType,
          categorySlug: i.categorySlug,
          subcategorySlug: i.subcategorySlug,
          productSlug: i.productSlug,
          designProjectId: i.designProjectId,
        })),
      }),
    })
      .then((res) => res.json())
      .then((data: { lines: QuoteLineResult[]; subtotal: number }) => {
        if (cancelled) return;
        setQuote(data);
        setQuoteFor(readyIds);
      })
      .catch(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteFor(readyIds);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readyIds]);

  // Section 16/32: persist the draft on every change and across Back to Cart / refresh — never in
  // DesignProject, design.json, or a URL param (see checkoutDraft.ts's own header).
  useEffect(() => {
    saveCheckoutDraft({ contact, delivery });
  }, [contact, delivery]);

  const contactDone = isContactValid(contact);
  const deliveryDone = isDeliveryValid(delivery);

  // Section 36: a line the server couldn't verify (design deleted/corrupt, product delisted) never
  // reaches payment — surfaced plainly, never silently dropped or deleted.
  const brokenLines = (quote?.lines ?? []).filter((l) => l.status !== "ok");

  function handleTestCheckout() {
    if (!quote) return;
    setTestSubmitting(true);
    window.setTimeout(() => {
      for (const line of quote.lines) {
        if (line.mode === "CHECKOUT_READY") removeItem(line.id);
      }
      clearCheckoutDraft();
      setTestSubmitting(false);
      setTestCompleted(true);
    }, 500);
  }

  if (!hydrated || (items.length === 0 && !testCompleted)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SpinnerGap className="size-6 animate-spin text-muted" weight="bold" />
      </div>
    );
  }

  const summaryLines: SummaryLine[] = split.readyItems.map((item) => ({
    item,
    quote: quote?.lines.find((l) => l.id === item.id),
  }));

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.route, ease: EASE_PREMIUM }}
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <h1 className="font-display text-2xl font-semibold text-ink-900">Checkout</h1>
      <p className="mt-1 text-sm text-muted">
        {split.readyItems.length} item{split.readyItems.length === 1 ? "" : "s"}
        {split.quoteItems.length > 0 && ` · ${split.quoteItems.length} more in your cart need${split.quoteItems.length === 1 ? "s" : ""} a quote`}
      </p>

      {testCompleted ? (
        <div className="mt-8 rounded-3xl border border-sand bg-white p-8 text-center">
          <p className="font-display text-xl font-semibold text-ink-900">✓ Test order placed</p>
          <p className="mt-2 text-sm text-muted">
            No real order was created — this is a development-only completion, gated off in production.
          </p>
          <Link href="/shop" className="mt-6 inline-block rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-white">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="order-2 space-y-4 lg:order-1">
            {brokenLines.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-crimson/10 p-4">
                {brokenLines.map((line) => {
                  const item = items.find((i) => i.id === line.id);
                  return (
                    <div key={line.id} className="flex items-start gap-2.5 text-sm text-crimson">
                      <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
                      <div>
                        <p className="font-semibold">We need to refresh {item?.name ?? "this item"} before checkout.</p>
                        {item?.designProjectId && (
                          <Link href={`/studio/${item.designProjectId}`} className="mt-1 inline-block text-xs font-semibold underline underline-offset-2">
                            Review Design
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <ContactSection
              draft={contact}
              onChange={setContact}
              open={activeSection === "contact"}
              done={contactDone}
              onOpen={() => setActiveSection("contact")}
              onContinue={() => setActiveSection("delivery")}
            />
            <DeliverySection
              draft={delivery}
              onChange={setDelivery}
              open={activeSection === "delivery"}
              done={deliveryDone}
              disabled={!contactDone}
              onOpen={() => setActiveSection("delivery")}
              onContinue={() => setActiveSection("payment")}
            />
            <PaymentSection
              testCheckoutEnabled={testCheckoutEnabled}
              canCheckout={contactDone && deliveryDone && !quoteLoading && Boolean(quote) && quote!.lines.some((l) => l.mode === "CHECKOUT_READY")}
              total={quote?.subtotal ?? null}
              submitting={testSubmitting}
              completed={testCompleted}
              onTestCheckout={handleTestCheckout}
            />
          </div>

          <div className="order-1 lg:order-2">
            <OrderSummary
              lines={summaryLines}
              subtotal={quote?.subtotal ?? null}
              loading={quoteLoading}
              quoteOnlyCount={split.quoteItems.length}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
