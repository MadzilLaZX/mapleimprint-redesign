// Mirrors the real authority for this state machine: supabase/migrations/014_order_fulfillment_
// status.sql's transition_order_fulfillment_status() Postgres function. THAT function is what
// actually validates and enforces every transition server-side -- this file exists only so the
// admin UI can decide which button(s) to show for a given order's current state, without the UI
// having to guess or allow a button that the database would just reject anyway. If this file and
// the database function ever disagree, the database wins; this file being wrong would only ever
// show the wrong buttons, never let an invalid transition actually succeed.

export const FULFILLMENT_STATUSES = ["AWAITING_PRODUCTION", "IN_PRODUCTION", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  AWAITING_PRODUCTION: "Awaiting production",
  IN_PRODUCTION: "In production",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
};

export interface FulfillmentOption {
  status: FulfillmentStatus;
  label: string;
  requiresTracking: boolean;
}

/** Every status this order could move to next, given its current fulfillment status (null if
 *  payment succeeded before this feature existed, or before any transition has been recorded) and
 *  whether it's a pickup or delivery order. Empty array means no further staff action is possible
 *  (COMPLETED, or the order isn't paid yet -- callers should check payment status separately
 *  before even showing fulfillment controls at all). */
export function nextFulfillmentOptions(current: FulfillmentStatus | null, isPickup: boolean): FulfillmentOption[] {
  const option = (status: FulfillmentStatus): FulfillmentOption => ({
    status,
    label: FULFILLMENT_STATUS_LABELS[status],
    requiresTracking: status === "SHIPPED",
  });

  if (current === null) return [option("AWAITING_PRODUCTION")];
  if (current === "AWAITING_PRODUCTION") return [option("IN_PRODUCTION")];
  if (current === "IN_PRODUCTION") return [option(isPickup ? "READY_FOR_PICKUP" : "SHIPPED")];
  if (current === "READY_FOR_PICKUP") return [option("COMPLETED")];
  if (current === "SHIPPED") return [option("COMPLETED")];
  return []; // COMPLETED -- terminal
}
