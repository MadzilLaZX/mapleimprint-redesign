// Pricing for price-listed print products (houseProductKind "price-list", printCatalogue.ts): the
// client's own tier list — the unit price of the tier the quantity falls in, times the quantity.
// Shared by PriceListConfigurator (display), /api/studio (the price stored on a new design) and
// priceCartItem (the server-side recompute before charging), so all three price an order
// identically and the browser's copy of the price is never what gets charged.
import type { CatalogueProduct, ProductPriceTier } from "@/lib/products";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The tier a quantity falls in — null below the first tier's minimum (the MOQ). */
export function priceListTierFor(tiers: ProductPriceTier[], quantity: number): ProductPriceTier | null {
  return tiers.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)) ?? null;
}

/** Unit price and order total for `quantity` units, or null when the product has no price list or
 *  the quantity is below its minimum order / not a whole number. */
export function quotePriceList(
  product: CatalogueProduct,
  quantity: number,
): { unitPrice: number; total: number } | null {
  if (product.houseProductKind !== "price-list" || !product.priceTiers) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const tier = priceListTierFor(product.priceTiers, quantity);
  if (!tier) return null;
  return { unitPrice: tier.pricePerUnit, total: round2(tier.pricePerUnit * quantity) };
}
