"use client";

import { useRef, useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { QuoteWizard } from "@/components/contact/QuoteWizard";
import { LocationPanel } from "@/components/contact/LocationPanel";
import { AppointmentPanel } from "@/components/contact/AppointmentPanel";
import { cn } from "@/lib/cn";

export type ContactTab = "location" | "quote" | "general" | "appointment";

const TABS: { key: ContactTab; label: string }[] = [
  { key: "location", label: "Location" },
  { key: "quote", label: "Get a Project Quote" },
  { key: "appointment", label: "Book an Appointment" },
  { key: "general", label: "General Inquiry" },
];

/** WAI-ARIA Tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), automatic activation:
 *  arrow keys move focus AND select in one step (no separate "activate" keypress), matching the
 *  simplest and most common real-world tabs behavior. Home/End jump to the first/last tab. Only
 *  the active tab sits in the Tab-key sequence (roving tabindex) -- the others are reached via
 *  arrow keys once a tab has focus, same as this pattern's reference implementation. */
export function ContactTabs({ initialTab, initialMessage }: { initialTab: ContactTab; initialMessage?: string }) {
  const [tab, setTab] = useState<ContactTab>(initialTab);
  const tabRefs = useRef<Record<ContactTab, HTMLButtonElement | null>>({
    location: null,
    quote: null,
    general: null,
    appointment: null,
  });

  function selectTab(index: number) {
    const next = TABS[index];
    setTab(next.key);
    tabRefs.current[next.key]?.focus();
  }

  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectTab((index + 1) % TABS.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab((index - 1 + TABS.length) % TABS.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab(TABS.length - 1);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Contact options"
        className="flex flex-wrap gap-2 rounded-[28px] bg-canvas p-1.5 sm:inline-flex sm:rounded-full"
      >
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[t.key] = el;
            }}
            role="tab"
            id={`contact-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`contact-tabpanel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            type="button"
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors sm:px-5",
              tab === t.key ? "bg-ink-950 text-white" : "text-ink-900/70 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`contact-tabpanel-${tab}`}
        aria-labelledby={`contact-tab-${tab}`}
        tabIndex={0}
        className="mt-8"
      >
        {tab === "location" && <LocationPanel />}
        {tab === "quote" && <QuoteWizard />}
        {tab === "appointment" && <AppointmentPanel />}
        {tab === "general" && <GeneralInquiryForm initialMessage={initialMessage} />}
      </div>
    </div>
  );
}

/** `initialMessage` is only ever real data the customer already entered elsewhere on the site
 *  (e.g. CheckoutClient.tsx's "Request a Shipping Quote" CTA, which pre-fills cart contents and
 *  delivery address) -- never invented here, and always still a plain editable textarea, not a
 *  locked/read-only field, so the customer can edit or clear it before sending. */
function GeneralInquiryForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Your name is required.";
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!message.trim()) nextErrors.message = "Add a short message.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[28px] bg-white p-8 lg:p-10">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-orange/10">
          <Check className="size-7 text-crimson" weight="bold" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink-900">Message sent</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Thanks, {name.split(" ")[0]}. We&apos;ll reply to {email} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] bg-white p-6 lg:p-10">
      <h2 className="font-display text-xl font-semibold text-ink-900">Send a general message</h2>
      <p className="mt-1.5 text-sm text-muted">For quick questions that don&apos;t need a full project quote.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="contact-name">Full name</FieldLabel>
          <TextInput id="contact-name" value={name} onChange={(e) => setName(e.target.value)} />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="contact-email">Email</FieldLabel>
          <TextInput id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="contact-message">Message</FieldLabel>
          <TextArea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <FieldError>{errors.message}</FieldError>
        </div>
      </div>
      {submitError && <FieldError>{submitError}</FieldError>}
      <Button type="submit" className="mt-6" showArrow>
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
