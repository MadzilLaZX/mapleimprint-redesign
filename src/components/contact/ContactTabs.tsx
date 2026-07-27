"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { QuoteWizard } from "@/components/contact/QuoteWizard";
import { cn } from "@/lib/cn";

export function ContactTabs({ initialTab }: { initialTab: "quote" | "general" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <div className="inline-flex rounded-full bg-canvas p-1">
        <button
          type="button"
          onClick={() => setTab("quote")}
          className={cn(
            "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            tab === "quote" ? "bg-ink-950 text-white" : "text-ink-900/70 hover:text-ink-900",
          )}
        >
          Get a project quote
        </button>
        <button
          type="button"
          onClick={() => setTab("general")}
          className={cn(
            "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            tab === "general" ? "bg-ink-950 text-white" : "text-ink-900/70 hover:text-ink-900",
          )}
        >
          General inquiry
        </button>
      </div>

      <div className="mt-8">{tab === "quote" ? <QuoteWizard /> : <GeneralInquiryForm />}</div>
    </div>
  );
}

function GeneralInquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
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
