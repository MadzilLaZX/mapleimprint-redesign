"use client";

import { Check, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { isContactValid, isLikelyEmail, isLikelyPhone, type ContactDraft } from "@/lib/commerce/checkoutDraft";

/** Section 14/27: Email + phone, proper autocomplete/keyboard hints, inline validation, subtle
 *  completion state (a small check, not a giant green panel) — click the heading to reopen once
 *  complete. No account creation is ever asked for here. */
export function ContactSection({
  draft,
  onChange,
  open,
  done,
  onOpen,
  onContinue,
}: {
  draft: ContactDraft;
  onChange: (draft: ContactDraft) => void;
  open: boolean;
  done: boolean;
  onOpen: () => void;
  onContinue: () => void;
}) {
  const emailTouched = draft.email.length > 0;
  const phoneTouched = draft.phone.length > 0;
  const emailValid = isLikelyEmail(draft.email);
  const phoneValid = isLikelyPhone(draft.phone);

  return (
    <section className="rounded-2xl border border-sand bg-white">
      <button
        type="button"
        onClick={onOpen}
        disabled={!done}
        className="flex w-full items-center justify-between px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2 font-display text-base font-semibold text-ink-900">
          Contact
          {done && !open && (
            <span className="flex items-center gap-1 text-xs font-semibold text-ink-900/50">
              <Check className="size-3.5" weight="bold" /> {draft.email}
            </span>
          )}
        </span>
        {done && <CaretDown className={cn("size-4 text-ink-900/40 transition-transform", open && "rotate-180")} weight="bold" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-sand px-5 py-5">
          <div>
            <label htmlFor="checkout-email" className="text-xs font-medium text-ink-900/70">Email</label>
            <input
              id="checkout-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={draft.email}
              onChange={(e) => onChange({ ...draft, email: e.target.value })}
              placeholder="name@example.com"
              className={cn(
                "mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                emailTouched && !emailValid ? "border-crimson focus:border-crimson" : "border-sand focus:border-ink-950/30",
              )}
            />
            {emailTouched && !emailValid && <p className="mt-1 text-xs text-crimson">Enter a valid email address.</p>}
          </div>
          <div>
            <label htmlFor="checkout-phone" className="text-xs font-medium text-ink-900/70">Phone</label>
            <input
              id="checkout-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => onChange({ ...draft, phone: e.target.value })}
              placeholder="(613) 555-1234"
              className={cn(
                "mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none",
                phoneTouched && !phoneValid ? "border-crimson focus:border-crimson" : "border-sand focus:border-ink-950/30",
              )}
            />
            {phoneTouched && !phoneValid && <p className="mt-1 text-xs text-crimson">Enter a valid phone number.</p>}
          </div>
          <button
            type="button"
            disabled={!isContactValid(draft)}
            onClick={onContinue}
            className="w-full rounded-full bg-ink-950 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Delivery
          </button>
        </div>
      )}
    </section>
  );
}
