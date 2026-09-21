"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";
import { ExpressCheckoutButtons } from "@/components/checkout/payment/ExpressCheckoutButtons";

const ENVIRONMENT = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
const SQUARE_JS_SRC =
  ENVIRONMENT === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";

interface PayPayload {
  items: CheckoutCartItemInput[];
  contact: { fullName: string; email: string; phone: string };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export function SquarePaymentSection({
  totalCents,
  payload,
  onSuccess,
}: {
  totalCents: number;
  payload: PayPayload;
  onSuccess: (orderReference: string) => void;
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [payments, setPayments] = useState<SquarePayments | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (!sdkReady || payments) return;
    // Deferred a tick so this stays an async continuation rather than a synchronous setState
    // directly in the effect body (see the identical pattern in CheckoutClient's quote effect).
    const timer = setTimeout(() => {
      const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
      const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
      if (!window.Square || !appId || !locationId) {
        setError("Payment isn't available right now. Please try again later.");
        return;
      }
      setPayments(window.Square.payments(appId, locationId));
    }, 0);
    return () => clearTimeout(timer);
  }, [sdkReady, payments]);

  useEffect(() => {
    if (!payments || cardRef.current) return;
    let cancelled = false;

    payments
      .card()
      .then((card) => card.attach("#square-card-container").then(() => card))
      .then((card) => {
        if (cancelled) {
          card.destroy().catch(() => {});
          return;
        }
        cardRef.current = card;
        setCardReady(true);
      })
      .catch((err) => {
        console.error("[checkout] Square card setup failed:", err);
        setError("Couldn't load the payment form. Please refresh and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [payments]);

  useEffect(
    () => () => {
      cardRef.current?.destroy().catch(() => {});
    },
    [],
  );

  // Shared by the Card "Pay" button and both express-wallet buttons — the server doesn't care
  // which method produced the token, it only ever sees a sourceId + sourceType.
  const submitToken = useCallback(
    async (token: string, sourceType: "CARD" | "APPLE_PAY" | "GOOGLE_PAY") => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/checkout/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, sourceId: token, sourceType, idempotencyKey: idempotencyKeyRef.current }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          // A fresh idempotency key for the NEXT attempt — reusing this one with a changed
          // request would conflict with Square's idempotency contract on retry.
          idempotencyKeyRef.current = crypto.randomUUID();
          setError(data.error ?? "Your payment didn't go through. Please try again.");
          setSubmitting(false);
          return;
        }
        onSuccess(data.orderReference);
      } catch {
        idempotencyKeyRef.current = crypto.randomUUID();
        setError("Couldn't reach the payment server. Check your connection and try again.");
        setSubmitting(false);
      }
    },
    [payload, onSuccess],
  );

  async function handleCardPay() {
    if (!cardRef.current || submitting) return;
    const tokenResult = await cardRef.current.tokenize({
      amount: (totalCents / 100).toFixed(2),
      currencyCode: "CAD",
      intent: "CHARGE",
      billingContact: { givenName: payload.contact.fullName, email: payload.contact.email, phone: payload.contact.phone },
    });
    if (tokenResult.status !== "OK" || !tokenResult.token) {
      setError(tokenResult.errors?.[0]?.message ?? "Couldn't process your card. Check the details and try again.");
      return;
    }
    await submitToken(tokenResult.token, "CARD");
  }

  return (
    <div>
      <Script src={SQUARE_JS_SRC} strategy="afterInteractive" onLoad={() => setSdkReady(true)} />

      {payments && (
        <ExpressCheckoutButtons
          payments={payments}
          totalCents={totalCents}
          disabled={submitting}
          onToken={(token, sourceType) => {
            submitToken(token, sourceType);
          }}
        />
      )}

      <div id="square-card-container" className="min-h-[90px] rounded-2xl border border-sand p-4" />
      {!cardReady && !error && <p className="mt-2 text-xs text-muted">Loading payment form…</p>}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-crimson" role="alert" aria-live="assertive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!cardReady || submitting}
        onClick={handleCardPay}
        aria-live="polite"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay $${(totalCents / 100).toFixed(2)}`}
      </button>
    </div>
  );
}
