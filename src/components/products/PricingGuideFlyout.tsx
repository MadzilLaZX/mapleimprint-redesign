"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react/dist/ssr";

export interface PricingGuideRow {
  qty: number;
  totalCents: number;
  perUnitCents: number;
}

/** "Show pricing guide" — a small expandable list of {qty, total, per-unit} rows, matching
 *  VistaPrint's own pricing-guide link/flyout. Purely a display of numbers the caller already
 *  computed from the real pricing modules (quoteBanner/quoteBusinessCard/quoteFlyer); this
 *  component has no pricing logic of its own. */
export function PricingGuideFlyout({ rows }: { rows: PricingGuideRow[] }) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-ink-900 underline decoration-sand underline-offset-2 hover:decoration-ink-900"
      >
        Show pricing guide
        {open ? <CaretUp className="size-3" weight="bold" /> : <CaretDown className="size-3" weight="bold" />}
      </button>
      {open && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-sand bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sand text-ink-900/50">
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Per unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.qty} className="border-b border-sand/60 last:border-0">
                  <td className="px-3 py-1.5 text-ink-900">{row.qty.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-ink-900">${(row.totalCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-ink-900/70">${(row.perUnitCents / 100).toFixed(2)} each</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
