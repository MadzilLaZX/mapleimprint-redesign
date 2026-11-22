/** Builds the pre-filled General Inquiry message for the "Request a Shipping Quote" path
 *  (CheckoutClient.tsx) -- shown when a real carrier rate can't be calculated for the customer's
 *  cart/destination (ChitChatsShippingProvider threw ShippingRateUnavailableError), so checkout
 *  never silently substitutes a free or invented rate instead.
 *
 *  Every field here is real data the customer already typed into the checkout form -- never
 *  invented, never a guessed price or rate. Plain text only (no HTML), since this becomes a
 *  `?message=` query param pre-filling GeneralInquiryForm's plain <textarea>, and the business
 *  sees it via a Resend-sent email, not rendered HTML.
 *
 *  Extracted into its own plain .ts module specifically so it has a regression test -- see this
 *  project's established pattern (productImageFallback.ts's own header) for why .tsx components
 *  can't be covered by this repo's test runner directly. */

export interface ShippingQuoteRequestItem {
  name: string;
  quantity: number;
  colourName?: string | null;
}

export interface ShippingQuoteRequestDelivery {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
}

export function buildShippingQuoteRequestMessage(
  items: ShippingQuoteRequestItem[],
  delivery: ShippingQuoteRequestDelivery,
): string {
  const itemLines = items.map((i) => `- ${i.name}${i.colourName ? ` (${i.colourName})` : ""} x${i.quantity}`);
  const addressLine = [delivery.addressLine1, delivery.addressLine2, delivery.city, delivery.province, delivery.postalCode]
    .filter((part) => part && part.trim().length > 0)
    .join(", ");

  return [
    "Hi, I'd like a shipping quote for my order -- the website couldn't calculate a live shipping rate for this address.",
    "",
    "Items:",
    ...itemLines,
    "",
    `Delivery address: ${addressLine || "(not provided)"}`,
  ].join("\n");
}
