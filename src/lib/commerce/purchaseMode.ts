// CHECKOUT_READY vs QUOTE_REQUIRED (ACTIVATE REAL CHECKOUT brief, Section 2) — a real classification
// driven by product/business rules, never inferred from "does a price happen to be zero." This is
// deliberately a DIFFERENT concept from a print LOCATION's SupportStatus (STANDARD/REVIEW_REQUIRED/
// UNAVAILABLE, see productDecorationProfile.ts) — a design needing manual review before production
// does not by itself mean the ORDER can't be priced and paid for today. Nothing in this file (or
// anywhere else in the checkout/cart code) checks a location's REVIEW_REQUIRED status to decide
// purchase mode; the two stay structurally separate.
//
// This is the CLIENT-side classifier — fast, no network round-trip, used purely to decide which
// cart CTA to show. It trusts the cart item's own stored price fields (set at add-to-cart time).
// Checkout itself never trusts this for the actual payable total — /api/checkout/quote
// re-derives every price server-side from the real product/DesignProject data before payment is
// ever enabled (see that route's own header comment).

import type { CartItem } from "@/components/cart/CartProvider";

export type PurchaseMode = "CHECKOUT_READY" | "QUOTE_REQUIRED";

export interface PurchaseModeResult {
  mode: PurchaseMode;
  /** Only set for QUOTE_REQUIRED — a short, customer-facing reason, never an internal code. */
  reason?: string;
}

/** Real per-unit price for this item's CURRENT quantity — uses the tier matching `item.quantity`
 *  when the customizer attached a tier table, falling back to the flat startingPrice (lowest-tier
 *  quick-add) otherwise. Moved here from CartView.tsx so both the cart UI and the purchase-mode
 *  classifier share exactly one definition of "does this item have a price." */
export function unitPriceFor(item: CartItem): number | null {
  if (item.priceTiers && item.priceTiers.length > 0) {
    const tier = item.priceTiers.find(
      (t) => item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty),
    );
    return tier ? tier.pricePerUnit : null;
  }
  return item.startingPrice ?? null;
}

export function purchaseModeForItem(item: CartItem): PurchaseModeResult {
  // Maple Designer ("Surprise Me") jobs have no calculable price until Maple's design team has
  // actually seen the brief and produced something — genuinely QUOTE_REQUIRED by nature, not a
  // pricing gap that will ever resolve itself automatically.
  if (item.customizationType === "MAPLE_DESIGNER") {
    return { mode: "QUOTE_REQUIRED", reason: "Designer-created pieces are reviewed and priced by our team before production." };
  }
  if (unitPriceFor(item) === null) {
    return { mode: "QUOTE_REQUIRED", reason: "This item isn't on our standard pricing chart yet." };
  }
  return { mode: "CHECKOUT_READY" };
}

export interface CartPurchaseSplit {
  readyItems: CartItem[];
  quoteItems: CartItem[];
  allReady: boolean;
  allQuoteRequired: boolean;
  mixed: boolean;
}

export function splitCartByPurchaseMode(items: CartItem[]): CartPurchaseSplit {
  const readyItems = items.filter((i) => purchaseModeForItem(i).mode === "CHECKOUT_READY");
  const quoteItems = items.filter((i) => purchaseModeForItem(i).mode === "QUOTE_REQUIRED");
  return {
    readyItems,
    quoteItems,
    allReady: items.length > 0 && quoteItems.length === 0,
    allQuoteRequired: items.length > 0 && readyItems.length === 0,
    mixed: readyItems.length > 0 && quoteItems.length > 0,
  };
}
