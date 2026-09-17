"use client";

import { useMemo, useRef, useState } from "react";
import { MagnifyingGlass, Heart, X, ClockCounterClockwise, Sparkle, Crown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { MAPLE_ASSETS } from "@/lib/studio/assetProviders";
import {
  TEMPLATE_CATEGORIES,
  templatesFor,
  filterTemplates,
  getRecommendedTemplates,
  type DesignTemplate,
} from "@/lib/studio/templates";
import type { ProductFamily } from "@/lib/studio/productDecorationProfile";

const PREVIEW_BY_ASSET_ID: Record<string, string> = Object.fromEntries(MAPLE_ASSETS.map((a) => [a.id, a.previewUrl]));

/** Optional style filter chips (Pro collection's `style` tag — see templates.ts) — a second,
 *  independent refinement on top of the category pills above, not a replacement for them. Only
 *  templates that set `style` (currently the Pro collection) are affected; everything else simply
 *  never matches a non-"all" chip, which is the correct behavior (older templates have no style). */
const STYLE_FILTERS: { id: NonNullable<DesignTemplate["style"]>; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "modern", label: "Modern" },
  { id: "bold", label: "Bold" },
  { id: "retro", label: "Retro" },
  { id: "luxury", label: "Luxury" },
  { id: "streetwear", label: "Streetwear" },
  { id: "vintage", label: "Vintage" },
  { id: "corporate", label: "Corporate" },
  { id: "elegant", label: "Elegant" },
  { id: "sport", label: "Sport" },
];

const FAVORITES_KEY = "maple-studio-template-favorites";
const RECENTS_KEY = "maple-studio-template-recents";
const MAX_RECENTS = 8;

function readLocalIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocalIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Guests without localStorage (private browsing, blocked storage) just lose favorites/recents
    // across sessions — never worth surfacing an error for.
  }
}

/** A small live preview rendered straight from the template's own object data (Section 13) — the
 *  card and the eventual on-canvas result share the exact same normalized coordinates, so they
 *  can never drift out of sync the way a hand-made screenshot would. The viewBox is sized to
 *  roughly the real "front" print-area's own pixel proportions (CANVAS_NATURAL_WIDTH * widthFrac,
 *  see printAreas.ts), which is the box every template's objects were authored against, so text
 *  that fits the real print area also fits this card at the same relative scale — no separate
 *  fudge factor needed, only the SVG's own uniform viewBox-to-container scaling. */
// Rough average glyph-width factor for the display/body sans faces used across templates — good
// enough to decide "will this line overrun its box," not meant to be a real text-metrics engine.
const AVG_CHAR_WIDTH_FACTOR = 0.58;

function TemplateThumbnail({ template }: { template: DesignTemplate }) {
  const W = 200;
  const H = 224;
  const clipId = `tpl-clip-${template.id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={12} />
        </clipPath>
      </defs>
      <rect width={W} height={H} rx={12} fill="#F7F4EE" />
      {/* Clipped so a composition authored against the real print area's proportions can never
          bleed past this card's own edges, even before the per-line shrink-to-fit below kicks in
          (belt-and-suspenders — the shrink alone is an estimate, not exact text metrics). */}
      <g clipPath={`url(#${clipId})`}>
      {template.objects.map((obj, i) => {
        const x = obj.normalizedX * W;
        const y = obj.normalizedY * H;
        const w = obj.normalizedWidth * W;
        const h = obj.normalizedHeight * H;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rotate = obj.rotation ? `rotate(${obj.rotation} ${cx} ${cy})` : undefined;
        if (obj.type === "image") {
          // Original collection: resolves lazily via `content` (a bare Maple asset id) against the
          // library's default-colored preview. Creative collection: pre-colored at definition time
          // (see templates.ts's cbuild) straight onto `assetUrl`, with `content` left null — so this
          // card shows the SAME palette color the real canvas will render, not the library default.
          const preview = obj.content ? PREVIEW_BY_ASSET_ID[obj.content] : obj.assetUrl;
          if (!preview) return null;
          return <image key={i} href={preview} x={x} y={y} width={w} height={h} opacity={obj.opacity} transform={rotate} />;
        }
        if (obj.type === "shape") {
          const stroke = obj.strokeColor ?? undefined;
          const strokeWidth = obj.strokeWidth ?? undefined;
          const fill = obj.fill === "transparent" ? "none" : obj.fill ?? "#171412";
          if (obj.shapeKind === "circle") {
            return (
              <circle key={i} cx={cx} cy={cy} r={Math.max(Math.min(w, h) / 2, 0.5)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={obj.opacity} transform={rotate} />
            );
          }
          if (obj.shapeKind === "line") {
            return (
              <line key={i} x1={x} y1={cy} x2={x + w} y2={cy} stroke={obj.fill ?? "#171412"} strokeWidth={Math.max(2, obj.strokeWidth ?? 3)} strokeLinecap="round" opacity={obj.opacity} transform={rotate} />
            );
          }
          return <rect key={i} x={x} y={y} width={Math.max(w, 1)} height={Math.max(h, 1)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={1} opacity={obj.opacity} transform={rotate} />;
        }
        if (!obj.content) return null;
        let fontSize = Math.max(6, obj.fontSize ?? 16);
        // Shrink-to-fit: templates are authored against the real print area's own box width, which
        // is occasionally wider than what this compact card can show at full size (e.g. a long,
        // letter-spaced line meant for a 12"-wide front print). Scale the line down rather than
        // letting it visually collide with neighbouring text — the real canvas still uses the
        // template's true fontSize; this only affects the card preview.
        const ls = obj.letterSpacing ?? 0;
        const estimatedWidth = obj.content.length * fontSize * AVG_CHAR_WIDTH_FACTOR + Math.abs(ls) * obj.content.length;
        const available = Math.max(w, W * 0.9);
        if (estimatedWidth > available) fontSize *= available / estimatedWidth;
        const anchor = obj.align === "left" ? "start" : obj.align === "right" ? "end" : "middle";
        const tx = anchor === "start" ? x : anchor === "end" ? x + w : x + w / 2;
        // Curved text (Pro/Creative collections' `curve` field — see curvedText.ts for the real,
        // per-glyph canvas renderer): this card is a lightweight live SVG preview, not a second
        // implementation of that glyph-by-glyph layout — approximating the arc with a single
        // quadratic-bezier textPath is enough to keep the card from looking flat/wrong for a
        // template that leans on curve, without pulling the canvas-only measurement code in here.
        if (obj.curve) {
          const pathId = `tpl-curve-${template.id}-${i}`;
          const bulge = Math.max(-1, Math.min(1, obj.curve / 100)) * Math.max(w, 40) * 0.35;
          const baseY = y + fontSize * 0.85;
          // Positive curve arcs upward ("smile"), so the control point lifts above the baseline.
          const controlY = baseY - bulge;
          return (
            <g key={i} transform={rotate}>
              <defs>
                <path id={pathId} d={`M ${x} ${baseY} Q ${cx} ${controlY} ${x + w} ${baseY}`} />
              </defs>
              <text
                fontFamily={obj.fontFamily ?? undefined}
                fontSize={fontSize}
                fontWeight={obj.bold ? 700 : 500}
                fontStyle={obj.italic ? "italic" : "normal"}
                letterSpacing={obj.letterSpacing ?? 0}
                fill={obj.fill ?? "#171412"}
              >
                <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                  {obj.content}
                </textPath>
              </text>
            </g>
          );
        }
        return (
          <text
            key={i}
            x={tx}
            y={y + fontSize * 0.85}
            fontFamily={obj.fontFamily ?? undefined}
            fontSize={fontSize}
            fontWeight={obj.bold ? 700 : 500}
            fontStyle={obj.italic ? "italic" : "normal"}
            letterSpacing={obj.letterSpacing ?? 0}
            fill={obj.fill ?? "#171412"}
            textAnchor={anchor}
            transform={rotate}
          >
            {obj.content}
          </text>
        );
      })}
      </g>
    </svg>
  );
}

function TemplateCard({
  template,
  favorited,
  onToggleFavorite,
  onApply,
}: {
  template: DesignTemplate;
  favorited: boolean;
  onToggleFavorite: () => void;
  onApply: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onApply();
        }
      }}
      aria-label={`Use ${template.name} template`}
      className="group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border border-sand bg-white p-2 text-left outline-none transition-colors hover:border-ink-950/30 focus-visible:border-ink-950/50 focus-visible:ring-2 focus-visible:ring-orange/50"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-canvas">
        <TemplateThumbnail template={template} />

        <button
          type="button"
          aria-label={favorited ? `Remove ${template.name} from favorites` : `Add ${template.name} to favorites`}
          aria-pressed={favorited}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute right-1.5 top-1.5 z-10 rounded-full bg-white/90 p-1.5 text-ink-900/50 shadow-sm transition-colors hover:text-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
        >
          <Heart className="size-3.5" weight={favorited ? "fill" : "regular"} color={favorited ? "#D41414" : undefined} />
        </button>

        {/* Hover/focus overlay (Section 4/14) — a premium but restrained micro-interaction: fade +
            slight rise, no bounce or scale-jump. Also appears on keyboard focus so the CTA is
            reachable without a mouse. */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink-950/70 via-ink-950/0 to-ink-950/0 p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="translate-y-1 rounded-full bg-maple-gradient px-3 py-1.5 text-[11px] font-semibold text-ink-950 shadow-lg transition-transform duration-150 group-hover:translate-y-0 group-focus-visible:translate-y-0">
            Use template
          </span>
        </div>
      </div>

      <div className="px-0.5">
        <p className="truncate text-xs font-semibold text-ink-900">{template.name}</p>
      </div>
    </div>
  );
}

function TemplateCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-sand bg-white p-2">
      <div className="aspect-[4/5] w-full animate-pulse rounded-lg bg-canvas" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-canvas" />
    </div>
  );
}

/** Section 2-16: template-first Designs browser. Search + horizontally-scrolling category pills +
 *  a 2-column grid of live, data-driven thumbnails (never flattened images — see TemplateThumbnail)
 *  replace the earlier bare-bones list. Applying a card hands the whole DesignTemplate up to
 *  StudioClient's existing applyTemplate(), which already deep-copies each object into real,
 *  individually-editable layers on the active print area and pushes one undo step — this panel
 *  only needs to pick which template. */
export function DesignsPanel({
  family,
  loading = false,
  onApplyTemplate,
}: {
  family: ProductFamily;
  loading?: boolean;
  onApplyTemplate: (template: DesignTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  // Lazy initializers (not an effect) — this only needs to run once, reading whatever's already in
  // localStorage before first paint; no external subscription to keep in sync with.
  const [favorites, setFavorites] = useState<string[]>(() => readLocalIds(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => readLocalIds(RECENTS_KEY));
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const available = useMemo(() => templatesFor(family), [family]);
  const recommended = useMemo(() => getRecommendedTemplates(family, available), [family, available]);
  const usedCategories = useMemo(
    () => TEMPLATE_CATEGORIES.filter((c) => available.some((t) => t.category === c.id)),
    [available],
  );
  const byId = useMemo(() => new Map(available.map((t) => [t.id, t])), [available]);

  const favoriteTemplates = favorites.map((id) => byId.get(id)).filter((t): t is DesignTemplate => Boolean(t));
  const recentTemplates = recents.map((id) => byId.get(id)).filter((t): t is DesignTemplate => Boolean(t));
  // Cross-cutting discovery pill: every template tagged as part of the newer, more colorful/
  // logo-style collection (see templates.ts's `collection` field), regardless of its own real
  // category — a "Plumbing Pro" stays filed under Trades AND shows up here.
  const creativeTemplates = available.filter((t) => t.collection === "creative");
  // Same cross-cutting discovery pattern as "Creative" above, for the new Pro collection (see
  // templates.ts's PRO_SPECS/pbuild) — a template stays filed under its real category AND shows up
  // here.
  const proTemplates = available.filter((t) => t.collection === "pro");

  let base: DesignTemplate[];
  if (category === "favorites") base = favoriteTemplates;
  else if (category === "recent") base = recentTemplates;
  else if (category === "creative") base = creativeTemplates;
  else if (category === "pro") base = proTemplates;
  else if (category === "all") base = recommended;
  else base = available.filter((t) => t.category === category);

  if (styleFilter !== "all") base = base.filter((t) => t.style === styleFilter);

  const filtered = filterTemplates(base, { query });

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      writeLocalIds(FAVORITES_KEY, next);
      return next;
    });
  }

  function applyTemplate(template: DesignTemplate) {
    setRecents((prev) => {
      const next = [template.id, ...prev.filter((x) => x !== template.id)].slice(0, MAX_RECENTS);
      writeLocalIds(RECENTS_KEY, next);
      return next;
    });
    onApplyTemplate(template);
  }

  function clearSearch() {
    setQuery("");
    searchInputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
        <label htmlFor="template-search" className="sr-only">
          Search templates
        </label>
        <input
          id="template-search"
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="w-full rounded-full border border-sand py-2 pl-9 pr-8 text-sm outline-none focus:border-ink-950/30"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:text-ink-900"
          >
            <X className="size-3.5" weight="bold" />
          </button>
        )}
      </div>

      {/* Section 2/21: horizontally scrollable, never wraps into rows that eat the sidebar. */}
      <div
        role="tablist"
        aria-label="Template categories"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          onClick={() => setCategory("all")}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            category === "all" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
          )}
        >
          Recommended
        </button>
        {creativeTemplates.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={category === "creative"}
            onClick={() => setCategory("creative")}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === "creative" ? "bg-maple-gradient text-ink-950" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            <Sparkle className="size-3" weight="fill" />
            Creative
          </button>
        )}
        {proTemplates.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={category === "pro"}
            onClick={() => setCategory("pro")}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === "pro" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            <Crown className="size-3" weight="fill" />
            Pro
          </button>
        )}
        {favoriteTemplates.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={category === "favorites"}
            onClick={() => setCategory("favorites")}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === "favorites" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            <Heart className="size-3" weight="fill" />
            Favorites
          </button>
        )}
        {recentTemplates.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={category === "recent"}
            onClick={() => setCategory("recent")}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === "recent" ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            <ClockCounterClockwise className="size-3" weight="bold" />
            Recent
          </button>
        )}
        {usedCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              category === c.id ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Optional style refinement (Pro collection's `style` tag) — a second row so it never
          competes with the category pills above for horizontal space; "All styles" clears it. */}
      <div
        role="tablist"
        aria-label="Template styles"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={styleFilter === "all"}
          onClick={() => setStyleFilter("all")}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
            styleFilter === "all" ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900/60 hover:bg-sand/40",
          )}
        >
          All styles
        </button>
        {STYLE_FILTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={styleFilter === s.id}
            onClick={() => setStyleFilter((prev) => (prev === s.id ? "all" : s.id))}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              styleFilter === s.id ? "border-ink-950 bg-ink-950 text-white" : "border-sand text-ink-900/60 hover:bg-sand/40",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm font-semibold text-ink-900">No templates found</p>
          <p className="max-w-[220px] text-xs text-muted">Try another keyword or start from scratch.</p>
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="mt-1 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-canvas"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              favorited={favorites.includes(t.id)}
              onToggleFavorite={() => toggleFavorite(t.id)}
              onApply={() => applyTemplate(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
