/** Pure decision logic for the durable payment-attempt state model proposed in
 *  docs/payment-idempotency-design.md -- NOT wired into /api/checkout/pay/route.ts yet (that
 *  requires Square sandbox validation first, which this environment doesn't have). Deliberately
 *  has zero dependency on Supabase or Square's SDK: given "what MapleOrder (if any) already exists
 *  for this stable checkoutAttemptId," decide what the route should do next. The actual DB lookup
 *  and Square calls stay in the route; this function only makes the decision testable in
 *  isolation, with a fake DB/Square client. */

export type MapleOrderStatus = "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "CANCELLED";

export interface ExistingOrderForAttempt {
  id: string;
  reference: string;
  status: MapleOrderStatus;
  squareOrderId: string | null;
}

export type CheckoutAttemptAction =
  /** No order has ever been created for this checkoutAttemptId -- this is genuinely the first
   *  attempt. Create a new MapleOrder/MapleOrderLine/PaymentAttempt and a new Square Order, same
   *  as today's behavior. */
  | { kind: "CREATE_NEW_ORDER" }
  /** A prior attempt for this SAME checkoutAttemptId already succeeded -- possibly one whose
   *  synchronous response never reached this browser (the exact lost-response scenario this
   *  model exists to close). Return success immediately. Must NEVER call Square again here. */
  | { kind: "ALREADY_PAID"; orderReference: string }
  /** An order exists for this attempt and isn't paid yet, but Square never got far enough to
   *  create a Square Order for it (e.g. the previous call failed before that step). Reuse the
   *  same MapleOrder row -- do not create a second one -- but a fresh Square Order is still
   *  needed. */
  | { kind: "REUSE_ORDER_NEW_SQUARE_ORDER"; orderId: string; orderReference: string }
  /** An order exists, isn't paid yet, and already has a Square Order -- reuse BOTH; only a new
   *  Payment (with a fresh idempotencyKey, since the source token is necessarily fresh too) needs
   *  to be attempted against the existing Square Order. */
  | { kind: "REUSE_ORDER_REUSE_SQUARE_ORDER"; orderId: string; orderReference: string; squareOrderId: string }
  /** The order for this checkoutAttemptId was explicitly cancelled (e.g. by an admin) --
   *  deliberately NOT silently resurrected by a stale retry. The route should reject this and
   *  tell the customer to start a new checkout (a fresh page load mints a new checkoutAttemptId). */
  | { kind: "REJECT_CANCELLED_ORDER"; orderReference: string };

export function decideCheckoutAttemptAction(existingOrder: ExistingOrderForAttempt | null): CheckoutAttemptAction {
  if (!existingOrder) return { kind: "CREATE_NEW_ORDER" };

  if (existingOrder.status === "PAID") {
    return { kind: "ALREADY_PAID", orderReference: existingOrder.reference };
  }

  if (existingOrder.status === "CANCELLED") {
    return { kind: "REJECT_CANCELLED_ORDER", orderReference: existingOrder.reference };
  }

  // PENDING_PAYMENT or PAYMENT_FAILED -- a real retry of a not-yet-successful attempt.
  if (existingOrder.squareOrderId) {
    return {
      kind: "REUSE_ORDER_REUSE_SQUARE_ORDER",
      orderId: existingOrder.id,
      orderReference: existingOrder.reference,
      squareOrderId: existingOrder.squareOrderId,
    };
  }
  return { kind: "REUSE_ORDER_NEW_SQUARE_ORDER", orderId: existingOrder.id, orderReference: existingOrder.reference };
}
