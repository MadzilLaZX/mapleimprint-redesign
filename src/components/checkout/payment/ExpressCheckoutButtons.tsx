"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Apple Pay and Google Pay, converging on the same `onToken` callback the Card field uses (see
 * SquarePaymentSection.tsx) so the server never needs to know which method produced the token.
 *
 * Per Square's docs: Apple Pay has NO attach() — it's a plain button you style yourself (Apple's
 * official CSS below) with your own click handler calling tokenize() directly. Google Pay's
 * button IS rendered via attach(). Both wallets self-report availability by resolving/rejecting
 * payments.applePay()/googlePay() — a rejection here just means "not supported in this
 * browser/device/account," not an error to surface to the customer, so it's swallowed and the
 * button simply doesn't render (per Square's own guidance to keep other payment methods working).
 *
 * Real support (Safari + a card in Apple Wallet for Apple Pay; a real HTTPS domain for both in
 * production) can't be verified from this dev environment — this is built to spec but needs a
 * manual browser check once deployed.
 */
export function ExpressCheckoutButtons({
  payments,
  totalCents,
  disabled,
  onToken,
}: {
  payments: SquarePayments;
  totalCents: number;
  disabled: boolean;
  onToken: (token: string, sourceType: "APPLE_PAY" | "GOOGLE_PAY") => void;
}) {
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [googlePayAvailable, setGooglePayAvailable] = useState(false);
  const applePayRef = useRef<SquareApplePayButton | null>(null);
  const googlePayRef = useRef<SquareGooglePayButton | null>(null);

  // Stable across renders via refs so the native listener added below always calls the latest
  // onToken/disabled without needing to re-attach the Google Pay button on every render.
  const onTokenRef = useRef(onToken);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onTokenRef.current = onToken;
    disabledRef.current = disabled;
  }, [onToken, disabled]);

  useEffect(() => {
    let cancelled = false;
    const paymentRequest = payments.paymentRequest({
      countryCode: "CA",
      currencyCode: "CAD",
      total: { amount: (totalCents / 100).toFixed(2), label: "Maple Imprint" },
    });

    payments
      .applePay(paymentRequest)
      .then((applePay) => {
        if (cancelled) return;
        applePayRef.current = applePay;
        setApplePayAvailable(true);
      })
      .catch(() => {
        // Not supported here (browser/device/no card in Wallet) — leave it hidden, not an error.
      });

    // Google Pay's button is rendered by attach() into this container, so (unlike Apple Pay,
    // which is a plain button this component owns) the click listener has to be wired onto the
    // real DOM node natively rather than via a React onClick prop.
    let googlePayButtonEl: HTMLElement | null = null;
    async function onGooglePayButtonClick() {
      if (!googlePayRef.current || disabledRef.current) return;
      const result = await googlePayRef.current.tokenize();
      if (result.status === "OK" && result.token) onTokenRef.current(result.token, "GOOGLE_PAY");
    }
    payments
      .googlePay(paymentRequest)
      .then(async (googlePay) => {
        await googlePay.attach("#google-pay-button");
        if (cancelled) return;
        googlePayRef.current = googlePay;
        googlePayButtonEl = document.getElementById("google-pay-button");
        googlePayButtonEl?.addEventListener("click", onGooglePayButtonClick);
        setGooglePayAvailable(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      googlePayButtonEl?.removeEventListener("click", onGooglePayButtonClick);
    };
    // Deliberately not re-running on every totalCents tick — re-initializing a wallet mid-attach
    // would risk tearing down a button the customer is about to click. The total is effectively
    // fixed by the time Payment is reachable (Contact+Delivery must already be valid).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  async function handleApplePayClick() {
    if (!applePayRef.current || disabled) return;
    // Square's docs are explicit: call tokenize() immediately in the click handler with no
    // awaited work first, or Safari may not treat the resulting sheet as user-initiated.
    const result = await applePayRef.current.tokenize();
    if (result.status === "OK" && result.token) onToken(result.token, "APPLE_PAY");
  }

  if (!applePayAvailable && !googlePayAvailable) return null;

  return (
    <div className="mb-5 space-y-2.5">
      <style>{`
        .mi-apple-pay-button {
          -webkit-appearance: -apple-pay-button;
          -apple-pay-button-type: plain;
          -apple-pay-button-style: black;
        }
      `}</style>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Express Checkout</p>
      {applePayAvailable && (
        <button
          type="button"
          onClick={handleApplePayClick}
          disabled={disabled}
          aria-label="Pay with Apple Pay"
          className="mi-apple-pay-button h-11 w-full rounded-xl disabled:opacity-50"
        />
      )}
      <div id="google-pay-button" className={googlePayAvailable ? "h-11" : "hidden"} />
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-sand" />
        or
        <span className="h-px flex-1 bg-sand" />
      </div>
    </div>
  );
}
