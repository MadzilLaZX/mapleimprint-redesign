"use client";

import { AppleLogo, Check, CreditCard, GoogleLogo, LockSimple, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/** Section 23/24/26: a real structured placeholder — no fake card fields, no card details
 *  collected, no pretending payment happened. Reserves the Express Checkout (Apple Pay/Google Pay)
 *  and Card slots so Square, when connected later, plugs into exactly this location without a
 *  checkout redesign (Section 26: "No checkout redesign should be required").
 *
 *  `testCheckoutEnabled` is decided SERVER-SIDE by the checkout page (NODE_ENV / ENABLE_TEST_
 *  CHECKOUT, never a NEXT_PUBLIC_ var) and passed down as a plain boolean — this component never
 *  reads env vars itself, so there's no way for a production client bundle to carry the flag. */
export function PaymentSection({
  testCheckoutEnabled,
  canCheckout,
  total,
  submitting,
  completed,
  onTestCheckout,
}: {
  testCheckoutEnabled: boolean;
  canCheckout: boolean;
  total: number | null;
  submitting: boolean;
  completed: boolean;
  onTestCheckout: () => void;
}) {
  return (
    <section className="rounded-2xl border border-sand bg-white px-5 py-5">
      <p className="font-display text-base font-semibold text-ink-900">Payment</p>

      {/* Reserved express-checkout slot — visually present, never interactive until Square is
          configured (Section 23: "these controls remain unavailable until Square SDK is
          configured"). */}
      <div className="mt-4 grid grid-cols-2 gap-2 opacity-40">
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-sand py-2.5 text-xs font-semibold text-ink-900">
          <AppleLogo className="size-4" weight="fill" /> Apple Pay
        </div>
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-sand py-2.5 text-xs font-semibold text-ink-900">
          <GoogleLogo className="size-4" weight="bold" /> Google Pay
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-sand py-3 text-xs font-semibold text-ink-900/50 opacity-60">
        <CreditCard className="size-4" weight="bold" /> Card
      </div>

      <div className="mt-4 rounded-xl bg-canvas px-3.5 py-3 text-xs leading-relaxed text-ink-900/70">
        <p className="flex items-center gap-1.5 font-semibold text-ink-900">
          <LockSimple className="size-3.5" weight="bold" /> Square not connected
        </p>
        <p className="mt-1">Payment setup required — this section becomes live once Square is integrated.</p>
      </div>

      {completed ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-semibold text-white">
          <Check className="size-4" weight="bold" /> Test order placed — no real order was created.
        </div>
      ) : testCheckoutEnabled ? (
        <button
          type="button"
          disabled={!canCheckout || submitting}
          onClick={onTestCheckout}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
            "bg-maple-gradient text-ink-950",
          )}
        >
          {submitting ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : null}
          {submitting ? "Placing test order…" : `Test Checkout${total !== null ? ` — $${total.toFixed(2)}` : ""}`}
        </button>
      ) : (
        <div className="mt-4 rounded-full bg-canvas py-3 text-center text-sm font-semibold text-ink-900/40">
          Payment setup required
        </div>
      )}
      {testCheckoutEnabled && !completed && (
        <p className="mt-2 text-center text-[11px] text-ink-900/40">
          Development-only test completion — never shown in production.
        </p>
      )}
    </section>
  );
}
