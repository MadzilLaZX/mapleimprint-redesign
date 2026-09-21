import type { CartItem } from "@/components/cart/CartProvider";

/** Real per-unit price for this item's CURRENT quantity — uses the tier matching `item.quantity`
 *  when the customizer attached a tier table, falling back to the flat startingPrice (lowest-tier
 *  quick-add) otherwise. Keeps the price honest if quantity is adjusted from the cart. Shared by
 *  CartView (display) and the checkout quote endpoint (server-authoritative recompute) so the two
 *  can't drift apart. */
export function unitPriceFor(item: CartItem): number | null {
  if (item.priceTiers && item.priceTiers.length > 0) {
    const tier = item.priceTiers.find(
      (t) => item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty),
    );
    return tier ? tier.pricePerUnit : null;
  }
  return item.startingPrice ?? null;
}
