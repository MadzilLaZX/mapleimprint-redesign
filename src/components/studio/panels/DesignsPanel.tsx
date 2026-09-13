"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { MAPLE_ASSETS } from "@/lib/studio/assetProviders";
import { TEMPLATE_CATEGORIES, templatesFor, type DesignTemplate } from "@/lib/studio/templates";
import type { ProductFamily } from "@/lib/studio/productDecorationProfile";

const PREVIEW_BY_ASSET_ID: Record<string, string> = Object.fromEntries(MAPLE_ASSETS.map((a) => [a.id, a.previewUrl]));

/** Section 5/9/10. A TEMPLATE is a whole composition (not one asset — see templates.ts), so each
 *  card shows a small generated preview built from the template's own text/graphic content rather
 *  than a pre-rendered thumbnail image (~10 internal demo templates; no thumbnail-generation
 *  pipeline exists yet, and faking one with a static image per template would be the same kind of
 *  "pretend this is finished" shortcut the brief explicitly warns against elsewhere). */
export function DesignsPanel({ family, onApplyTemplate }: { family: ProductFamily; onApplyTemplate: (template: DesignTemplate) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const available = useMemo(() => templatesFor(family), [family]);
  const usedCategories = useMemo(
    () => TEMPLATE_CATEGORIES.filter((c) => available.some((t) => t.category === c.id)),
    [available],
  );
  const filtered = available.filter((t) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q));
    const matchesCategory = category === "all" || t.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="w-full rounded-full border border-sand py-2 pl-9 pr-3 text-sm outline-none focus:border-ink-950/30"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            category === "all" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
          )}
        >
          Recommended
        </button>
        {usedCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === c.id ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">No templates match yet — try a different search or category.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onApplyTemplate(t)}
              className="flex flex-col items-center gap-2 rounded-xl border border-sand bg-white p-3 text-center transition-colors hover:border-ink-950/30 hover:bg-canvas"
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-canvas p-3">
                {t.linkedAssetIds[0] && PREVIEW_BY_ASSET_ID[t.linkedAssetIds[0]] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline SVG data-url icon
                  <img src={PREVIEW_BY_ASSET_ID[t.linkedAssetIds[0]]} alt="" className="size-10 object-contain opacity-80" />
                ) : (
                  <span className="font-display text-xs font-semibold text-ink-900/50">Aa</span>
                )}
              </div>
              <span className="text-xs font-semibold text-ink-900">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
