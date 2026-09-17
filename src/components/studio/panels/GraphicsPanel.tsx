"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { MapleAssetProvider, type AssetProvider, type DesignAsset } from "@/lib/studio/assetProviders";
import { OpenIconProvider } from "@/lib/studio/openIconProvider";
import { IllustrationProvider } from "@/lib/studio/illustrationProvider";

const DEBOUNCE_MS = 250;

// Every provider the Graphics panel searches. Adding a provider is exactly the one-line change the
// abstraction promises (assetProviders.ts's top comment) — nothing below needs to know which
// provider an asset came from beyond what's already on DesignAsset (provider/licenseMetadata).
const PROVIDERS: AssetProvider[] = [MapleAssetProvider, OpenIconProvider, IllustrationProvider];

/** Section 12. Originally showed a small, curated grid (Maple's internal demo set is ~16 items
 *  total) with debounced search and category chips — the same pattern DesignsPanel uses for
 *  templates, since both talk to the same kind of provider abstraction underneath. Now aggregates
 *  every registered AssetProvider (Maple's own marks plus the curated open-icon set) into one
 *  unified search grid; categories are merged/deduped across providers too. */
export function GraphicsPanel({ onAddGraphic }: { onAddGraphic: (asset: DesignAsset) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [results, setResults] = useState<DesignAsset[]>([]);

  useEffect(() => {
    Promise.all(PROVIDERS.map((p) => p.categories())).then((lists) => {
      setCategories([...new Set(lists.flat())]);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const q = category === "all" ? undefined : category;
      Promise.all(PROVIDERS.map((p) => p.search(query, q))).then((lists) => setResults(lists.flat()));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, category]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search graphics…"
          className="w-full rounded-full border border-sand py-2 pl-9 pr-3 text-sm outline-none focus:border-ink-950/30"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
            category === "all" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
              category === c ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            {c.replace("-", " ")}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">No graphics found. Try a different search.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {results.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onAddGraphic(asset)}
              title={`${asset.title} — ${asset.licenseMetadata}`}
              className="flex aspect-square items-center justify-center rounded-xl border border-sand bg-white p-3 transition-colors hover:border-ink-950/30 hover:bg-canvas"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data-url icon */}
              <img src={asset.previewUrl} alt={asset.title} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
