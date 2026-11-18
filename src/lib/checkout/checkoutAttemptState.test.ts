import { test } from "node:test";
import assert from "node:assert/strict";
import { decideCheckoutAttemptAction, type ExistingOrderForAttempt } from "./checkoutAttemptState.ts";

function order(overrides: Partial<ExistingOrderForAttempt> = {}): ExistingOrderForAttempt {
  return { id: "order-1", reference: "MO-TESTREF01", status: "PENDING_PAYMENT", squareOrderId: null, ...overrides };
}

test("no existing order for this checkoutAttemptId -- a genuine first attempt, create a new order", () => {
  const action = decideCheckoutAttemptAction(null);
  assert.deepEqual(action, { kind: "CREATE_NEW_ORDER" });
});

test("SECURITY/CORRECTNESS -- an already-PAID order for this attempt returns success immediately, never calls Square again (the core double-charge fix)", () => {
  const action = decideCheckoutAttemptAction(order({ status: "PAID", squareOrderId: "sq-order-1" }));
  assert.deepEqual(action, { kind: "ALREADY_PAID", orderReference: "MO-TESTREF01" });
});

test("a PENDING_PAYMENT order with no Square Order yet reuses the SAME MapleOrder, but still needs a fresh Square Order", () => {
  const action = decideCheckoutAttemptAction(order({ status: "PENDING_PAYMENT", squareOrderId: null }));
  assert.deepEqual(action, { kind: "REUSE_ORDER_NEW_SQUARE_ORDER", orderId: "order-1", orderReference: "MO-TESTREF01" });
});

test("a PENDING_PAYMENT order that already has a Square Order reuses BOTH -- only a fresh Payment attempt is needed", () => {
  const action = decideCheckoutAttemptAction(order({ status: "PENDING_PAYMENT", squareOrderId: "sq-order-1" }));
  assert.deepEqual(action, { kind: "REUSE_ORDER_REUSE_SQUARE_ORDER", orderId: "order-1", orderReference: "MO-TESTREF01", squareOrderId: "sq-order-1" });
});

test("a PAYMENT_FAILED order (a genuine decline, not a lost response) is retried the same way as PENDING_PAYMENT -- reuses the order and its Square Order if one exists", () => {
  const withSquareOrder = decideCheckoutAttemptAction(order({ status: "PAYMENT_FAILED", squareOrderId: "sq-order-1" }));
  assert.equal(withSquareOrder.kind, "REUSE_ORDER_REUSE_SQUARE_ORDER");

  const withoutSquareOrder = decideCheckoutAttemptAction(order({ status: "PAYMENT_FAILED", squareOrderId: null }));
  assert.equal(withoutSquareOrder.kind, "REUSE_ORDER_NEW_SQUARE_ORDER");
});

test("a CANCELLED order is never silently resurrected by a stale retry -- rejected, customer must start a new checkout", () => {
  const action = decideCheckoutAttemptAction(order({ status: "CANCELLED" }));
  assert.deepEqual(action, { kind: "REJECT_CANCELLED_ORDER", orderReference: "MO-TESTREF01" });
});

test("every action for a non-null, non-PAID, non-CANCELLED order carries the SAME orderId/orderReference as the existing row -- never a different one", () => {
  const existing = order({ id: "order-xyz", reference: "MO-XYZ123", status: "PENDING_PAYMENT", squareOrderId: "sq-abc" });
  const action = decideCheckoutAttemptAction(existing);
  assert.ok(action.kind === "REUSE_ORDER_REUSE_SQUARE_ORDER");
  if (action.kind === "REUSE_ORDER_REUSE_SQUARE_ORDER") {
    assert.equal(action.orderId, "order-xyz");
    assert.equal(action.orderReference, "MO-XYZ123");
    assert.equal(action.squareOrderId, "sq-abc");
  }
});
