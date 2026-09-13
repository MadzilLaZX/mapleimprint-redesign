"use client";

import { useMemo, useState } from "react";
import { X, Ruler } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { getSizeSpecsFor, SPEC_TYPE_INFO, IN_TO_CM, type NormalizedSpecType } from "@/lib/sizeSpecs";

const SPEC_COLUMN_ORDER: NormalizedSpecType[] = [
  "CHEST_WIDTH_FLAT",
  "CHEST_CIRCUMFERENCE",
  "BODY_LENGTH",
  "SLEEVE_LENGTH",
  "SHOULDER_WIDTH",
  "WAIST",
  "INSEAM",
  "NECK",
];

function convert(value: number, unit: "in" | "cm", target: "in" | "cm"): number {
  if (unit === target) return value;
  return target === "cm" ? value * IN_TO_CM : value / IN_TO_CM;
}

/** Simple labelled shirt outline — a text equivalent (the surrounding measurement rows) always
 *  carries the actual information, so this is illustrative, not the only way to get the data. */
function MeasurementDiagram() {
  return (
    <svg viewBox="0 0 200 180" className="mx-auto h-32 w-32 text-ink-900/70" aria-hidden="true">
      <path
        d="M60 20 L80 10 L100 20 L120 10 L140 20 L150 45 L130 55 L125 170 L75 170 L70 55 L50 45 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line x1="70" y1="55" x2="130" y2="55" stroke="#D41414" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="100" y="48" textAnchor="middle" fontSize="10" fill="#D41414" fontWeight="600">
        A
      </text>
      <line x1="150" y1="55" x2="160" y2="55" stroke="#D41414" strokeWidth="1.5" />
      <line x1="160" y1="55" x2="160" y2="170" stroke="#D41414" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="160" y1="170" x2="150" y2="170" stroke="#D41414" strokeWidth="1.5" />
      <text x="170" y="115" textAnchor="middle" fontSize="10" fill="#D41414" fontWeight="600">
        B
      </text>
    </svg>
  );
}

export function SizeGuidePanel({ productSlug, onClose }: { productSlug: string; onClose: () => void }) {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const specs = useMemo(() => getSizeSpecsFor(productSlug), [productSlug]);

  const sizes = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const row of specs) if (!seen.has(row.sizeName)) seen.set(row.sizeName, row.sizeOrder);
    return [...seen.entries()].sort((a, b) => (a[1] ?? a[0]).localeCompare(b[1] ?? b[0])).map(([size]) => size);
  }, [specs]);

  const columns = SPEC_COLUMN_ORDER.filter((type) => specs.some((s) => s.normalizedSpecType === type));
  const hasStructuredData = columns.length > 0 && sizes.length > 0;

  function valueFor(size: string, type: NormalizedSpecType): string | null {
    const row = specs.find((s) => s.sizeName === size && s.normalizedSpecType === type);
    if (!row) return null;
    const numeric = Number(row.value);
    if (!Number.isFinite(numeric)) return row.value;
    const displayUnit = row.unit ?? "in";
    return `${convert(numeric, displayUnit, unit).toFixed(1)}"`.replace('"', unit === "in" ? '"' : " cm");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 sm:items-center sm:p-6">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="size-5 text-crimson" weight="bold" />
            <h2 className="font-display text-lg font-semibold text-ink-900">Size guide</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink-900"
          >
            <X className="size-5" />
          </button>
        </div>

        {!hasStructuredData ? (
          <div className="mt-6 rounded-2xl bg-canvas p-5 text-center">
            <p className="text-sm font-medium text-ink-900">
              Detailed measurements aren&apos;t available for this style yet.
            </p>
            <p className="mt-2 text-sm text-muted">
              We&apos;re working on adding real supplier measurements for every product. In the
              meantime, our team is happy to help you pick a size.
            </p>
            <a
              href="/contact?type=general"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Ask Maple for sizing help
            </a>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-start gap-4">
              <MeasurementDiagram />
              <div className="flex-1 space-y-2 text-xs text-ink-900/70">
                {columns.slice(0, 2).map((type, i) => (
                  <p key={type}>
                    <span className="font-semibold text-crimson">{i === 0 ? "A" : "B"} —</span>{" "}
                    {SPEC_TYPE_INFO[type].label}: {SPEC_TYPE_INFO[type].instruction}
                  </p>
                ))}
              </div>
            </div>

            <p className="mt-4 text-sm text-muted">
              Easiest method: compare these measurements with a shirt you already own and like.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {columns.some((c) => SPEC_TYPE_INFO[c].isFlatMeasurement) && "Garment measurements, laid flat"}
              </p>
              <div className="flex gap-1 rounded-full border border-sand p-1">
                {(["in", "cm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      unit === u ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas",
                    )}
                  >
                    {u === "in" ? "Inches" : "CM"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl bg-canvas">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-950/10">
                    <th className="px-4 py-2.5 font-semibold text-ink-900">Size</th>
                    {columns.map((type) => (
                      <th key={type} className="px-4 py-2.5 font-semibold text-ink-900">
                        {SPEC_TYPE_INFO[type].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size} className="border-b border-ink-950/5 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-ink-900">{size}</td>
                      {columns.map((type) => (
                        <td key={type} className="px-4 py-2.5 text-ink-900/80">
                          {valueFor(size, type) ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
