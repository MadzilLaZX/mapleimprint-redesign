import { test } from "node:test";
import assert from "node:assert/strict";
import { adminOrderPaidEmail } from "./templates.ts";

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
