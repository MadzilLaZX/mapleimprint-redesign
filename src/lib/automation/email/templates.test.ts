import { test } from "node:test";
import assert from "node:assert/strict";
import { adminOrderPaidEmail, orderConfirmationEmail } from "./templates.ts";

const BASE_ORDER = {
  reference: "MI-1042",
  contactName: "Jordan Lee",
  contactEmail: "jordan@example.com",
  totalCents: 12345,
  lines: [
    { productName: "Custom Tee", quantity: 2, colourName: "Black" },
    { productName: "Mug", quantity: 1, colourName: null },
  ],
};

test("adminOrderPaidEmail: subject includes reference and customer name", () => {
  const { subject } = adminOrderPaidEmail(BASE_ORDER);
  assert.match(subject, /MI-1042/);
  assert.match(subject, /Jordan Lee/);
});

test("adminOrderPaidEmail: text includes total formatted as dollars and all line items", () => {
  const { text } = adminOrderPaidEmail(BASE_ORDER);
  assert.match(text, /\$123\.45/);
  assert.match(text, /Custom Tee \(Black\) × 2/);
  assert.match(text, /Mug × 1/);
  assert.match(text, /MI-1042/);
});

test("adminOrderPaidEmail: html escapes customer-supplied fields", () => {
  const malicious = {
    ...BASE_ORDER,
    contactName: '<script>alert("x")</script>',
    contactEmail: "a&b@example.com",
    lines: [{ productName: "<b>Tee</b>", quantity: 1, colourName: "<i>Red</i>" }],
  };
  const { html } = adminOrderPaidEmail(malicious);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a&amp;b@example\.com/);
  assert.match(html, /&lt;b&gt;Tee&lt;\/b&gt;/);
  assert.match(html, /&lt;i&gt;Red&lt;\/i&gt;/);
});

test("adminOrderPaidEmail: html includes a link to the admin order page for the reference", () => {
  const { html } = adminOrderPaidEmail(BASE_ORDER);
  assert.match(html, /\/admin\/orders\/MI-1042/);
});

test("adminOrderPaidEmail: omits colour suffix when colourName is null", () => {
  const { text } = adminOrderPaidEmail(BASE_ORDER);
  const mugLine = text.split("\n").find((l) => l.includes("Mug"));
  assert.equal(mugLine, "- Mug × 1");
});

test("adminOrderPaidEmail: a pickup order is clearly flagged in subject, text, and html", () => {
  const pickupOrder = {
    ...BASE_ORDER,
    fulfillment: { method: "pickup" as const, pickupLabel: "Maple Imprint — Ottawa" },
  };
  const { subject, text, html } = adminOrderPaidEmail(pickupOrder);
  assert.match(subject, /PICKUP/);
  assert.match(text, /PICKUP — Maple Imprint — Ottawa/);
  assert.match(html, /PICKUP/);
  assert.match(html, /Maple Imprint — Ottawa/);
});

test("adminOrderPaidEmail: a delivery order (no fulfillment field) does not mention pickup at all", () => {
  const { subject, text, html } = adminOrderPaidEmail(BASE_ORDER);
  assert.doesNotMatch(subject, /PICKUP/);
  assert.match(text, /Fulfillment: Delivery/);
  assert.doesNotMatch(html, /PICKUP/);
});

test("orderConfirmationEmail: a pickup order shows the pickup location and collection next-step, not shipping", () => {
  const pickupOrder = {
    ...BASE_ORDER,
    fulfillment: {
      method: "pickup" as const,
      pickupLabel: "Maple Imprint — Ottawa",
      pickupAddressLine: "Suite 125, 2487 Kaladar Ave, Ottawa, ON K1V 8B9",
      pickupHoursLines: ["Monday, Wednesday, Thursday: 11am to 7pm"],
    },
  };
  const { text, html } = orderConfirmationEmail(pickupOrder);
  assert.match(text, /Pickup: Maple Imprint — Ottawa/);
  assert.match(text, /Suite 125, 2487 Kaladar Ave/);
  assert.match(text, /ready for pickup/);
  assert.doesNotMatch(text, /then shipping/);
  assert.match(html, /Maple Imprint — Ottawa/);
});

test("orderConfirmationEmail: a delivery order (no fulfillment field) mentions shipping as the next step, not pickup", () => {
  const { text } = orderConfirmationEmail(BASE_ORDER);
  assert.match(text, /then shipping/);
  assert.doesNotMatch(text, /Pickup:/);
});

test("orderConfirmationEmail: an amountBreakdown with tax shows Subtotal, Shipping, and Tax as separate lines", () => {
  const taxedOrder = {
    ...BASE_ORDER,
    amountBreakdown: { subtotalCents: 10000, shippingCents: 1850, taxCents: 1541 },
  };
  const { text, html } = orderConfirmationEmail(taxedOrder);
  assert.match(text, /Subtotal: \$100\.00/);
  assert.match(text, /Shipping: \$18\.50/);
  assert.match(text, /Tax: \$15\.41/);
  assert.match(html, /Subtotal/);
  assert.match(html, /\$15\.41/);
});

test("orderConfirmationEmail: an amountBreakdown with zero shipping shows 'Free', and zero tax omits the Tax line entirely", () => {
  const freeShippingOrder = {
    ...BASE_ORDER,
    amountBreakdown: { subtotalCents: 35000, shippingCents: 0, taxCents: 0 },
  };
  const { text } = orderConfirmationEmail(freeShippingOrder);
  assert.match(text, /Shipping: Free/);
  assert.doesNotMatch(text, /Tax:/);
});

test("orderConfirmationEmail: no amountBreakdown (older/unactivated-tax order) shows no Subtotal/Tax lines at all", () => {
  const { text } = orderConfirmationEmail(BASE_ORDER);
  assert.doesNotMatch(text, /Subtotal:/);
  assert.doesNotMatch(text, /Tax:/);
});

test("adminOrderPaidEmail: an amountBreakdown with tax shows Subtotal, Shipping, and Tax as separate lines", () => {
  const taxedOrder = {
    ...BASE_ORDER,
    amountBreakdown: { subtotalCents: 10000, shippingCents: 1850, taxCents: 1541 },
  };
  const { text, html } = adminOrderPaidEmail(taxedOrder);
  assert.match(text, /Subtotal: \$100\.00/);
  assert.match(text, /Tax: \$15\.41/);
  assert.match(html, /\$15\.41/);
});
