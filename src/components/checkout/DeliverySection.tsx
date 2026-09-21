"use client";

import { Check, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { isDeliveryValid, type DeliveryDraft } from "@/lib/commerce/checkoutDraft";

const FIELD = "mt-1 w-full rounded-xl border border-sand px-3.5 py-2.5 text-sm outline-none focus:border-ink-950/30";
const LABEL = "text-xs font-medium text-ink-900/70";

/** Section 15: Full Name, Address (+ optional Apt/Unit), City, Province/State, Postal/ZIP, Country
 *  — email/phone are NOT re-asked here (Section 14 already collected them). Proper autocomplete
 *  attributes throughout so mobile keyboards and browser autofill both behave correctly. */
export function DeliverySection({
  draft,
  onChange,
  open,
  done,
  disabled,
  onOpen,
  onContinue,
}: {
  draft: DeliveryDraft;
  onChange: (draft: DeliveryDraft) => void;
  open: boolean;
  done: boolean;
  disabled: boolean;
  onOpen: () => void;
  onContinue: () => void;
}) {
  return (
    <section className={cn("rounded-2xl border border-sand bg-white", disabled && "opacity-50")}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!done || disabled}
        className="flex w-full items-center justify-between px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2 font-display text-base font-semibold text-ink-900">
          Delivery
          {done && !open && (
            <span className="flex items-center gap-1 text-xs font-semibold text-ink-900/50">
              <Check className="size-3.5" weight="bold" /> {draft.city}, {draft.region}
            </span>
          )}
        </span>
        {done && <CaretDown className={cn("size-4 text-ink-900/40 transition-transform", open && "rotate-180")} weight="bold" />}
      </button>

      {open && !disabled && (
        <div className="space-y-4 border-t border-sand px-5 py-5">
          <div>
            <label htmlFor="checkout-full-name" className={LABEL}>Full Name</label>
            <input id="checkout-full-name" autoComplete="name" value={draft.fullName} onChange={(e) => onChange({ ...draft, fullName: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="checkout-address1" className={LABEL}>Address</label>
            <input id="checkout-address1" autoComplete="address-line1" value={draft.address1} onChange={(e) => onChange({ ...draft, address1: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="checkout-address2" className={LABEL}>Apartment / Unit (optional)</label>
            <input id="checkout-address2" autoComplete="address-line2" value={draft.address2} onChange={(e) => onChange({ ...draft, address2: e.target.value })} className={FIELD} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="checkout-city" className={LABEL}>City</label>
              <input id="checkout-city" autoComplete="address-level2" value={draft.city} onChange={(e) => onChange({ ...draft, city: e.target.value })} className={FIELD} />
            </div>
            <div>
              <label htmlFor="checkout-region" className={LABEL}>Province / State</label>
              <input id="checkout-region" autoComplete="address-level1" value={draft.region} onChange={(e) => onChange({ ...draft, region: e.target.value })} className={FIELD} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="checkout-postal" className={LABEL}>Postal / ZIP Code</label>
              <input id="checkout-postal" autoComplete="postal-code" value={draft.postalCode} onChange={(e) => onChange({ ...draft, postalCode: e.target.value })} className={FIELD} />
            </div>
            <div>
              <label htmlFor="checkout-country" className={LABEL}>Country</label>
              <select id="checkout-country" autoComplete="country" value={draft.country} onChange={(e) => onChange({ ...draft, country: e.target.value })} className={FIELD}>
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>
          {/* Section 17: a real structural placeholder, not a fabricated $10/free-shipping
              number — Maple's shipping rules aren't connected yet. */}
          <div className="rounded-xl bg-canvas px-3.5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/60">Delivery Method</p>
            <p className="mt-1 text-xs text-muted">Delivery options will be calculated once shipping rules are connected.</p>
          </div>
          <button
            type="button"
            disabled={!isDeliveryValid(draft)}
            onClick={onContinue}
            className="w-full rounded-full bg-ink-950 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Payment
          </button>
        </div>
      )}
    </section>
  );
}
