// Pricing for supplier-bundle products (CatalogueProduct.bundlePricing — the Joto drinkware line,
// jotoDrinkwareCatalogDraft.ts). One cart "unit" is one bundle: a whole case, a whole pack, or a
// single item for sellUnit "unit". The cart quantity is the number of bundles, and the per-bundle
// price comes from the highest tier whose bundleCount the quantity reaches (e.g. 3 cases on a
// 1/2/6/20-case ladder pays the 2-case rate). Shared by BundleConfigurator (display), the cart
// (via CartItem.priceTiers built by bundleCartTiers) and priceCartItem (the server-side
// recompute before charging), so all three price an order identically.
import type { CatalogueProduct, SupplierBundlePricing } from "@/lib/products";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The pricing entry for a chosen option value: an entry tied to that exact value wins, else the
 *  entry that applies to every option. Null when the option isn't priced (never guessed). */
export function bundleEntryFor(product: CatalogueProduct, option: string | null): SupplierBundlePricing | null {
  const entries = product.bundlePricing ?? [];
  return (
    (option ? entries.find((e) => e.appliesTo === option) : undefined) ??
    entries.find((e) => e.appliesTo === undefined) ??
    null
  );
}

/** The one selectable option group (colour, size or finish) — every bundle product has at most one. */
export function bundleOption(product: CatalogueProduct): { name: string; values: string[] } | null {
  const o = product.productOptions?.find((g) => g.values.length > 0);
  return o ? { name: o.name, values: o.values } : null;
}

/** Whether `option` is a value the customer may actually pick for this product. */
export function isValidBundleOption(product: CatalogueProduct, option: string | null): boolean {
  const o = bundleOption(product);
  if (!o) return option === null || option === "";
  return option !== null && o.values.includes(option);
}

/** Price of ONE bundle when `bundles` are ordered — null below the first tier's minimum. */
export function bundleUnitPrice(entry: SupplierBundlePricing, bundles: number): number | null {
  const tier = [...entry.tiers].reverse().find((t) => bundles >= t.bundleCount);
  return tier ? round2(tier.totalCad / tier.bundleCount) : null;
}

/** The same ladder in the cart's tier shape (minQty/maxQty/pricePerUnit per bundle). */
export function bundleCartTiers(entry: SupplierBundlePricing) {
  return entry.tiers.map((t, i) => ({
    minQty: t.bundleCount,
    maxQty: i + 1 < entry.tiers.length ? entry.tiers[i + 1].bundleCount - 1 : null,
    pricePerUnit: round2(t.totalCad / t.bundleCount),
  }));
}

/** What one price buys, for labels like "From $77.22 / case of 36". */
export function bundleUnitLabel(entry: Pick<SupplierBundlePricing, "sellUnit" | "itemsPerBundle">): string {
  if (entry.sellUnit === "unit") return "unit";
  return `${entry.sellUnit} of ${entry.itemsPerBundle}`;
}

/** Label for a product's "From" price on shop/listing tiles — "unit" for every non-bundle product. */
export function priceUnitLabel(product: CatalogueProduct): string {
  const first = product.bundlePricing?.[0];
  return first ? bundleUnitLabel(first) : "unit";
}
