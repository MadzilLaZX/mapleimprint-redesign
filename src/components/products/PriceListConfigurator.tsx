"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { QUOTE_PREFILL_KEY } from "@/components/cart/CartProvider";
import { formatUnitPrice } from "@/lib/pricing/formatUnitPrice";
import type { CatalogueProduct, ProductPriceTier } from "@/lib/products";

const MONEY = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function money(n: number): string {
  return `$${MONEY.format(n)}`;
}

/** Unit price for a quantity is the tier it falls in — the same 1-D tier model the client's price
 *  list uses. Below the first tier's minQty there is no price (that's the minimum order). */
function tierFor(tiers: ProductPriceTier[], qty: number): ProductPriceTier | null {
  return tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) ?? null;
}

/** For the client's own price-listed print catalogue (src/lib/houseProducts/printCatalogue.ts):
 *  shows the list's specs and quantity tiers verbatim (MOQ, order total, per-unit price) and sends
 *  the chosen quantity into the quote flow — there's no Studio template or server-side checkout
 *  pricing for these yet, so they're ordered by quote, same handoff QuoteOnlyConfigurator uses. */
export function PriceListConfigurator({ product }: { product: CatalogueProduct }) {
  const router = useRouter();
  const tiers = product.priceTiers;
  const moq = tiers?.[0]?.minQty ?? 1;
  // Raw text so the field can be cleared and retyped; clamped to the MOQ for pricing and on blur.
  const [qtyText, setQtyText] = useState(String(moq));
  const qty = Math.max(moq, Math.floor(Number(qtyText)) || moq);
  const setQty = (next: number) => setQtyText(String(Math.max(moq, next)));

  const tier = tiers ? tierFor(tiers, qty) : null;
  const total = tier ? tier.pricePerUnit * qty : null;
  // Tier pricing can make a slightly larger order cheaper overall (e.g. 199 vs 200) — point that out.
  const nextTier = tiers && tier ? tiers[tiers.indexOf(tier) + 1] : undefined;
  const nextTierTotal = nextTier ? nextTier.pricePerUnit * nextTier.minQty : null;
  const cheaperAtNextTier = total !== null && nextTier && nextTierTotal !== null && nextTierTotal <= total;

  function handleRequest() {
    const id = product.catalogueId ? ` (${product.catalogueId})` : "";
    const summary =
      tier && total !== null
        ? `${product.name}${id} — ${qty} units, ${money(total)} CAD est. (${formatUnitPrice(tier.pricePerUnit)}/unit)`
        : `${product.name}${id} — ${qty} units, price on request`;
    window.sessionStorage.setItem(QUOTE_PREFILL_KEY, summary);
    router.push("/contact?type=quote");
  }

  const specs = product.printSpecs;
  const specRows = specs
    ? ([
        [specs.sizeLabel, specs.size],
        ["Material", specs.material],
        ["Printing", specs.printedSides],
        ["Finish", specs.finish],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  return (
    <div>
      {tiers ? (
        <p className="font-display text-3xl font-semibold text-ink-900">
          From {formatUnitPrice(tiers[0].pricePerUnit)}
          <span className="text-base font-normal text-muted"> / unit</span>
          <span className="ml-2 text-lg font-normal text-muted">· Minimum order {moq}</span>
        </p>
      ) : (
        <p className="font-display text-2xl font-semibold text-ink-900">Price on request</p>
      )}

      {specRows.length > 0 && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-white p-4 text-sm">
          {specRows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-ink-900">{label}</dt>
              <dd className="text-ink-900/80">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {tiers && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-950/10">
                <th className="px-4 py-3 font-semibold text-ink-900">Quantity</th>
                <th className="px-4 py-3 font-semibold text-ink-900">Order total</th>
                <th className="px-4 py-3 font-semibold text-ink-900">Per unit</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr
                  key={t.minQty}
                  className={cn("border-b border-ink-950/5 last:border-0", t === tier && "bg-canvas")}
                >
                  <td className="px-4 py-3 text-ink-900">{t.minQty}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    {money(t.orderTotal ?? t.pricePerUnit * t.minQty)}
                  </td>
                  <td className="px-4 py-3 text-ink-900/80">{formatUnitPrice(t.pricePerUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="price-list-qty" className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">
          Quantity
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty(qty - 1)}
            disabled={qty <= moq}
            className="flex size-10 items-center justify-center rounded-full bg-white text-ink-900 disabled:opacity-40"
          >
            <Minus weight="bold" className="size-4" />
          </button>
          <input
            id="price-list-qty"
            type="number"
            inputMode="numeric"
            min={moq}
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            onBlur={() => setQty(qty)}
            className="h-10 w-24 rounded-full bg-white px-4 text-center text-sm font-semibold text-ink-900"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty(qty + 1)}
            className="flex size-10 items-center justify-center rounded-full bg-white text-ink-900"
          >
            <Plus weight="bold" className="size-4" />
          </button>
          {total !== null && (
            <p className="ml-auto text-right text-sm text-muted">
              <span className="block font-display text-xl font-semibold text-ink-900">{money(total)}</span>
              CAD, before tax
            </p>
          )}
        </div>
        {cheaperAtNextTier && nextTier && nextTierTotal !== null && (
          <p className="mt-3 text-sm text-ink-900/80">
            Tip: {nextTier.minQty} units costs {money(nextTierTotal)} — no more than {qty}.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4">
        <p className="text-sm text-ink-900/80">
          Send us your order and artwork — we&apos;ll confirm your proof and final price within one
          business day.
        </p>
      </div>
      <button
        type="button"
        onClick={handleRequest}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-maple-gradient px-6 py-3.5 text-sm font-semibold text-ink-950"
      >
        {tiers ? "Request this order" : "Request a quote"}
      </button>
    </div>
  );
}
