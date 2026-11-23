"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nextFulfillmentOptions, FULFILLMENT_STATUS_LABELS, type FulfillmentStatus } from "@/lib/checkout/orderFulfillment";

/** Staff-facing fulfillment control for a single PAID order (src/app/(admin)/admin/(dashboard)/
 *  orders/[reference]/page.tsx). All real validation happens server-side in
 *  transition_order_fulfillment_status() -- this component only decides which button(s) to SHOW
 *  (via nextFulfillmentOptions, the same state machine mirrored for UI purposes) and surfaces
 *  whatever error the server actually returns if a transition is somehow rejected anyway. */
export function OrderFulfillmentControl({
  reference,
  currentStatus,
  isPickup,
  shippingCarrier,
  trackingNumber,
}: {
  reference: string;
  currentStatus: FulfillmentStatus | null;
  isPickup: boolean;
  shippingCarrier: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(shippingCarrier ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = nextFulfillmentOptions(currentStatus, isPickup);

  async function handleTransition(toStatus: FulfillmentStatus, requiresTracking: boolean) {
    setError(null);
    if (requiresTracking && !tracking.trim()) {
      setError("Enter a tracking number before marking this order shipped.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${reference}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus,
          shippingCarrier: requiresTracking ? carrier.trim() || null : null,
          trackingNumber: requiresTracking ? tracking.trim() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Couldn't update fulfillment status.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[24px] bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fulfillment</p>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-900">
          {currentStatus ? FULFILLMENT_STATUS_LABELS[currentStatus] : "Not started"}
        </span>
      </div>

      {currentStatus === "SHIPPED" && (shippingCarrier || trackingNumber) && (
        <p className="mt-3 text-sm text-ink-900">
          {shippingCarrier ?? "Carrier not recorded"} — {trackingNumber ?? "no tracking number"}
        </p>
      )}

      {error && <p className="mt-3 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">{error}</p>}

      {options.length === 0 ? (
        <p className="mt-3 text-sm text-muted">This order is complete — no further action needed.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {options.map((opt) =>
            opt.requiresTracking ? (
              <div key={opt.status} className="space-y-2 rounded-xl bg-canvas p-3">
                <input
                  type="text"
                  placeholder="Carrier (e.g. Canada Post, Chit Chats)"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full rounded-full border border-sand px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Tracking number"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="w-full rounded-full border border-sand px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleTransition(opt.status, true)}
                  className="w-full rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Mark {opt.label}
                </button>
              </div>
            ) : (
              <button
                key={opt.status}
                type="button"
                disabled={submitting}
                onClick={() => handleTransition(opt.status, false)}
                className="w-full rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Mark {opt.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
