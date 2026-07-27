"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel, TextInput } from "@/components/ui/Field";

export function OrderTrackingForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "We couldn't find that order.");
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] bg-white p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="orderNumber">Order number</FieldLabel>
          <TextInput
            id="orderNumber"
            placeholder="e.g. MI-104822"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="track-email">Email used for the order</FieldLabel>
          <TextInput id="track-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" className="mt-6" showArrow>
        {loading ? "Checking…" : "Track order"}
      </Button>
    </form>
  );
}
