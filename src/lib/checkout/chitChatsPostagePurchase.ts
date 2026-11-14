import type { ChitChatsQuoteStore } from "./chitChatsQuoteStore.ts";
import { ShippingRateUnavailableError } from "./canadaPostShippingProvider.ts";

// Dormant, NOT called from any live code path -- /api/checkout/pay never invokes this today, and
// must not until two separate conditions are both true: (1) Square has confirmed the payment
// succeeded (markOrderPaidAndNotify has already run), and (2) the order's fulfillment workflow
// explicitly authorizes purchasing postage for it (a business/ops decision, not an automatic
// consequence of payment -- e.g. an order might be held for manual review, or produced before
// shipping is scheduled). This file exists so wiring that authorization in later is a call-site
// change, not something designed from scratch under launch pressure.
//
// Real call, once credentials and a confirmed request shape exist:
//   PATCH /clients/<client_id>/shipments/{id}/buy  body: { "postage_type": "..." }
// (https://chitchats.com/docs/api/v1) -- buying can take a few seconds; the API recommends polling
// the shipment afterward rather than assuming the response is final.

export type ChitChatsPostagePurchaser = (chitChatsShipmentId: string, postageType: string) => Promise<void>;

// Throws rather than silently no-op-ing or fabricating success -- consistent with every other
// "not wired to real credentials yet" stub in this codebase (fetchCanadaPostRate; fetchChitChatsRates
// in chitChatsShippingProvider.ts is now a real implementation, but postage purchasing is a
// separate, still-unimplemented step -- see this file's header for why it stays dormant). Replace
// this body with the real PATCH call above once approved.
const purchasePostageViaChitChats: ChitChatsPostagePurchaser = async (_chitChatsShipmentId, _postageType) => {
  throw new Error("Postage purchasing is not implemented -- no Chit Chats credentials exist in this codebase.");
};

/**
 * Purchases postage for an already-quoted, already-paid order's shipment, then marks the quote
 * row purchased so cleanup (ChitChatsQuoteStore.deleteExpiredUnpurchased) can never remove it
 * afterward. NOT called anywhere in this codebase today -- see this file's header for the two
 * conditions that must both hold before a real caller wires this in.
 *
 * Idempotent against being called twice for the same fingerprint: if the quote has no
 * chitChatsShipmentId (never actually quoted through a real fetcher) this throws rather than
 * inventing a shipment to buy postage for.
 */
export async function purchasePostageForQuote(
  quoteStore: ChitChatsQuoteStore,
  fingerprint: string,
  postageType: string,
  now: Date,
  purchaser: ChitChatsPostagePurchaser = purchasePostageViaChitChats,
): Promise<void> {
  const quote = await quoteStore.findReady(fingerprint, now);
  if (!quote) {
    throw new ShippingRateUnavailableError("This shipping quote has expired or was never completed -- it cannot be purchased.");
  }
  if (quote.purchasedAt) {
    return; // already purchased -- safe no-op, not a second purchase attempt
  }
  if (!quote.chitChatsShipmentId) {
    throw new Error("This quote has no associated Chit Chats shipment id -- nothing to purchase postage for.");
  }

  await purchaser(quote.chitChatsShipmentId, postageType);
  await quoteStore.markPurchased(fingerprint, now);
}
