"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarBlank, Check, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FieldError, FieldLabel, TextArea, TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const TIME_SLOTS = ["12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

export function AppointmentPanel() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  function selectDate(d: Date) {
    setSelectedDate(d);
    setSelectedSlot(null);
    setErrors((prev) => ({ ...prev, date: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!selectedDate) nextErrors.date = "Choose a date.";
    if (!selectedSlot) nextErrors.slot = "Choose a time.";
    if (!name.trim()) nextErrors.name = "Your name is required.";
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!consent) nextErrors.consent = "Please confirm we can contact you about this appointment.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate!.toISOString(),
          time: selectedSlot,
          name,
          email,
          phone,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setReference(json.reference);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference && selectedDate && selectedSlot) {
    return (
      <div className="rounded-[28px] bg-white p-8 lg:p-10">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-orange/10">
          <Check className="size-7 text-crimson" weight="bold" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink-900">Appointment requested</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Reference <span className="font-semibold text-ink-900">{reference}</span>. We&apos;ll confirm your{" "}
          <span className="font-semibold text-ink-900">
            {formatDate(selectedDate)} at {selectedSlot}
          </span>{" "}
          appointment by email.
        </p>
        <Button
          variant="secondary"
          tone="light"
          className="mt-6"
          onClick={() => {
            setSelectedDate(null);
            setSelectedSlot(null);
            setName("");
            setEmail("");
            setPhone("");
            setNotes("");
            setConsent(false);
            setReference(null);
          }}
        >
          Book another appointment
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] bg-white p-6 lg:p-10">
      <h2 className="font-display text-xl font-semibold text-ink-900">Book an appointment</h2>
      <p className="mt-1.5 text-sm text-muted">
        Open 12pm to 6pm, Monday to Saturday. Closed Sunday.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold text-ink-900">{monthLabel}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                disabled={isCurrentMonth}
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="rounded-full p-1.5 text-ink-900/70 transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-30"
              >
                <CaretLeft className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="rounded-full p-1.5 text-ink-900/70 transition-colors hover:bg-canvas"
              >
                <CaretRight className="size-4" weight="bold" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isSunday = d.getDay() === 0;
              const isPast = d < today;
              const disabled = isSunday || isPast;
              const selected = selectedDate && sameDay(d, selectedDate);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDate(d)}
                  className={cn(
                    "aspect-square rounded-xl text-sm font-medium transition-colors",
                    disabled && "cursor-not-allowed text-muted/40",
                    !disabled && !selected && "text-ink-900 hover:bg-canvas",
                    !disabled && !selected && isToday && "ring-1 ring-inset ring-orange/50",
                    selected && "bg-maple-gradient font-semibold text-ink-950",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <FieldError>{errors.date}</FieldError>
        </div>

        <div>
          <FieldLabel htmlFor="time-slots">
            {selectedDate ? `Available times, ${formatDate(selectedDate)}` : "Pick a date first"}
          </FieldLabel>
          <div id="time-slots" className="grid grid-cols-2 gap-2.5">
            {TIME_SLOTS.map((slot) => {
              const selected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!selectedDate}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setErrors((prev) => ({ ...prev, slot: "" }));
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    !selectedDate && "cursor-not-allowed border-sand text-muted/40",
                    selectedDate && !selected && "border-sand text-ink-900 hover:border-orange/40",
                    selected && "border-transparent bg-maple-gradient font-semibold text-ink-950",
                  )}
                >
                  <CalendarBlank className={cn("size-4", selected ? "text-ink-950" : "text-crimson")} />
                  {slot}
                </button>
              );
            })}
          </div>
          <FieldError>{errors.slot}</FieldError>

          <AnimatePresence>
            {selectedSlot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-6 grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="appt-name">Full name</FieldLabel>
                      <TextInput id="appt-name" value={name} onChange={(e) => setName(e.target.value)} />
                      <FieldError>{errors.name}</FieldError>
                    </div>
                    <div>
                      <FieldLabel htmlFor="appt-email">Email</FieldLabel>
                      <TextInput
                        id="appt-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <FieldError>{errors.email}</FieldError>
                    </div>
                    <div>
                      <FieldLabel htmlFor="appt-phone" optional>
                        Phone
                      </FieldLabel>
                      <TextInput id="appt-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor="appt-notes" optional>
                      What&apos;s the appointment for?
                    </FieldLabel>
                    <TextArea
                      id="appt-notes"
                      placeholder="e.g. Reviewing artwork for a 50-piece uniform order"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <CheckboxField id="appt-consent" checked={consent} onChange={setConsent}>
                    I agree to be contacted by Maple Imprint to confirm this appointment.
                  </CheckboxField>
                  <FieldError>{errors.consent}</FieldError>
                  {submitError && <FieldError>{submitError}</FieldError>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Button type="submit" className="mt-8" showArrow>
        {submitting ? "Requesting…" : "Request appointment"}
      </Button>
    </form>
  );
}
