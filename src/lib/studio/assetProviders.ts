// Normalized graphics-asset model (Section 11 of an earlier brief, "Asset Provider Abstraction";
// extended by the STUDIO V4 brief's free/open-source asset licensing architecture). Studio's
// Graphics panel talks only to this interface, never to a vendor SDK/response shape directly — the
// same principle as SupplierConnector in catalogue-engine.
//
// CORE BUSINESS DECISION (STUDIO V4 brief): no paid asset subscription (Vexels/Freepik/Flaticon/
// Vecteezy/Shutterstock/Canva/Customily) during this phase. Every asset below is either a
// Maple-original mark or comes from a real, verifiable MIT-licensed open-source icon package
// (@tabler/icons, heroicons, bootstrap-icons — all installed as ordinary npm devDependencies with
// their own LICENSE files, not scraped). The brief's PRIMARY sources (Openclipart, Public Domain
// Vectors, Open Peeps, Humaaans) are NOT included here: pulling individually-verified assets from
// those requires manual per-asset browsing/download that isn't something this session can safely
// automate at scale without either fabricating source URLs or importing content whose license
// wasn't actually checked — see PROJECT_NOTES.md and the report delivered this session for that
// as an explicit, honest gap rather than a silent substitution.
//
// Every asset carries real licensing metadata (licenseType/licenseUrl/sourceUrl/
// attributionRequired/approvedForCustomerUse/approvedForPhysicalPrint/reviewedAt) — GraphicsPanel
// only ever sees the combined, already-reviewed set; nothing with an unknown license is reachable
// from it.

import { OPEN_SOURCE_ICONS } from "./openSourceIcons.generated";

export interface DesignAsset {
  id: string;
  provider: string;
  providerAssetId: string;
  title: string;
  type: "graphic" | "icon";
  category: string;
  tags: string[];
  previewUrl: string;
  vectorAvailable: boolean;
  /** Whether the customer can recolor this asset in Studio (true for every asset here — all are
   *  flat single/dual-tone marks, not photography). */
  editableColors: boolean;
  /** Human-readable summary — kept for anywhere that just wants one line of text; the structured
   *  fields below are the actual source of truth for what's actually enforced. */
  licenseMetadata: string;
  licenseType: "maple-original" | "MIT" | "CC0" | "public-domain";
  licenseUrl: string | null;
  sourceUrl: string | null;
  attributionRequired: boolean;
  /** Non-null only when a mark has a real trademark/brand restriction attached (e.g. a
   *  recognizable brand's own icon) — none of the current curated set does, but the field exists
   *  so a future branded/social-logo asset can't silently skip this check. */
  trademarkRestrictions: string | null;
  approvedForCustomerUse: boolean;
  approvedForPhysicalPrint: boolean;
  reviewedAt: string;
  /** What actually gets embedded into the DesignObject when placed — for every provider here this
   *  is the same as previewUrl (a plain SVG), but a future vendor's production asset might differ
   *  from its lightweight search-preview image (e.g. a low-res JPEG preview vs. a vector master). */
  productionSource: string;
}

export interface AssetProvider {
  id: string;
  name: string;
  search(query: string, category?: string): Promise<DesignAsset[]>;
  categories(): Promise<string[]>;
  getAsset(id: string): Promise<DesignAsset | null>;
}

/** Shape of one row in the generated openSourceIcons.generated.ts — see
 *  scripts/extract-open-source-icons.mjs, which is what actually produces that file from the real
 *  installed icon packages. */
export interface OpenSourceIconRecord {
  id: string;
  provider: "tabler" | "heroicons" | "bootstrap-icons";
  providerLabel: string;
  providerAssetId: string;
  title: string;
  category: string;
  tags: string[];
  viewBox: string;
  inner: string;
  licenseType: "MIT";
  licenseUrl: string;
  sourceUrl: string;
}

const REVIEWED_AT = "2026-09-17T00:00:00.000Z";

function svgDataUrl(inner: string, fill = "#171412"): string {
  // A few marks (laurel, compass, snowflake, banner) hardcode their stroke colour rather than
  // inheriting the root `fill` — swap those too so "Colour" recolors the whole mark consistently.
  const recoloured = fill === "#171412" ? inner : inner.replaceAll("#171412", fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${fill}">${recoloured}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Each open-source provider puts its default fill/stroke on the SVG's own root element rather
// than on individual paths (standard for these three packages) — the extraction script strips
// that root element, so it has to be reapplied here to recolor correctly. Tabler ships outline
// icons (stroke-based, fill:none); Heroicons/Bootstrap Icons ship solid icons (fill-based).
function openSourceStyleAttrs(provider: OpenSourceIconRecord["provider"], color: string): string {
  if (provider === "tabler") return `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `fill="${color}"`;
}

function openSourceIconDataUrl(icon: OpenSourceIconRecord, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${openSourceStyleAttrs(icon.provider, fill)}>${icon.inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Hand-built, deliberately simple single-path/shape marks — generic enough (a leaf, a star, a
// shield) that they read as basic geometric iconography rather than anyone's illustration style.
// `path` is kept separate from the rendered previewUrl so GraphicsPanel can recolor the preview
// live against `fill` without regenerating the whole asset list.
const MAPLE_GRAPHICS: { id: string; title: string; category: string; tags: string[]; path: string }[] = [
  { id: "maple-leaf", title: "Maple Leaf", category: "canadian", tags: ["canada", "leaf", "maple"], path: '<path d="M50 8 L58 30 L78 22 L68 40 L92 42 L72 54 L84 74 L60 66 L58 92 L50 72 L42 92 L40 66 L16 74 L28 54 L8 42 L32 40 L22 22 L42 30 Z"/>' },
  { id: "star-burst", title: "Star", category: "minimal", tags: ["star", "award", "badge"], path: '<path d="M50 6 L61 38 L94 38 L67 58 L78 90 L50 70 L22 90 L33 58 L6 38 L39 38 Z"/>' },
  { id: "shield", title: "Shield", category: "sports-teams", tags: ["team", "crest", "badge"], path: '<path d="M50 6 L88 20 V48 C88 72 72 88 50 96 C28 88 12 72 12 48 V20 Z"/>' },
  { id: "laurel", title: "Laurel Badge", category: "vintage", tags: ["vintage", "award", "wreath"], path: '<circle cx="50" cy="50" r="30" fill="none" stroke-width="5" stroke="#171412"/><path d="M20 50 Q10 30 20 15 M80 50 Q90 30 80 15" fill="none" stroke-width="5" stroke="#171412"/>' },
  { id: "bolt", title: "Bolt", category: "sports-teams", tags: ["energy", "sport", "fast"], path: '<path d="M56 4 L20 56 H44 L38 96 L82 40 H56 Z"/>' },
  { id: "heart", title: "Heart", category: "birthday", tags: ["love", "birthday", "event"], path: '<path d="M50 88 C10 62 6 34 26 20 C38 12 48 20 50 30 C52 20 62 12 74 20 C94 34 90 62 50 88 Z"/>' },
  { id: "mountain", title: "Mountain", category: "streetwear", tags: ["outdoor", "nature", "streetwear"], path: '<path d="M6 82 L34 34 L50 58 L64 36 L94 82 Z"/>' },
  { id: "wave", title: "Wave", category: "minimal", tags: ["water", "wave", "minimal"], path: '<path d="M4 60 Q25 40 50 60 T96 60 V90 H4 Z"/>' },
  { id: "compass", title: "Compass", category: "trades", tags: ["direction", "travel", "outdoor"], path: '<circle cx="50" cy="50" r="40" fill="none" stroke-width="5" stroke="#171412"/><path d="M50 24 L58 50 L50 76 L42 50 Z"/>' },
  { id: "wrench-gear", title: "Wrench & Gear", category: "automotive", tags: ["mechanic", "trades", "automotive"], path: '<circle cx="38" cy="62" r="18" fill="none" stroke-width="6" stroke="#171412"/><path d="M60 20 L92 52 L82 62 L50 30 Z"/>' },
  { id: "coffee-cup", title: "Coffee Cup", category: "food-cafe", tags: ["cafe", "coffee", "food"], path: '<path d="M20 30 H68 V60 C68 78 54 88 44 88 C34 88 20 78 20 60 Z"/><path d="M68 38 H80 C88 38 88 58 80 58 H68" fill="none" stroke-width="6" stroke="#171412"/>' },
  { id: "graduation-cap", title: "Graduation Cap", category: "schools", tags: ["school", "grad", "education"], path: '<path d="M50 20 L92 38 L50 56 L8 38 Z"/><path d="M28 46 V66 C28 74 68 74 72 66 V46" fill="none" stroke-width="5" stroke="#171412"/>' },
  { id: "crown", title: "Crown", category: "streetwear", tags: ["crown", "royal", "streetwear"], path: '<path d="M10 40 L28 60 L50 24 L72 60 L90 40 L84 78 H16 Z"/>' },
  { id: "paw", title: "Paw Print", category: "sports-teams", tags: ["mascot", "animal", "team"], path: '<circle cx="30" cy="34" r="10"/><circle cx="70" cy="34" r="10"/><circle cx="18" cy="58" r="8"/><circle cx="82" cy="58" r="8"/><ellipse cx="50" cy="72" rx="24" ry="18"/>' },
  { id: "snowflake", title: "Snowflake", category: "events", tags: ["winter", "seasonal", "event"], path: '<g stroke="#171412" stroke-width="6" fill="none"><path d="M50 6 V94 M12 28 L88 72 M12 72 L88 28"/></g>' },
  { id: "banner-ribbon", title: "Ribbon Banner", category: "business", tags: ["ribbon", "label", "business"], path: '<path d="M6 30 H94 L84 50 L94 70 H6 L16 50 Z" fill="none" stroke-width="5" stroke="#171412"/>' },
];

const MAPLE_DESIGN_ASSETS: DesignAsset[] = MAPLE_GRAPHICS.map((g) => ({
  id: `maple-${g.id}`,
  provider: "maple",
  providerAssetId: g.id,
  title: g.title,
  type: "graphic",
  category: g.category,
  tags: g.tags,
  previewUrl: svgDataUrl(g.path),
  vectorAvailable: true,
  editableColors: true,
  licenseMetadata: "Maple Imprint — original mark, free to use on Maple Imprint orders.",
  licenseType: "maple-original",
  licenseUrl: null,
  sourceUrl: null,
  attributionRequired: false,
  trademarkRestrictions: null,
  approvedForCustomerUse: true,
  approvedForPhysicalPrint: true,
  reviewedAt: REVIEWED_AT,
  productionSource: svgDataUrl(g.path),
}));

const OPEN_SOURCE_DESIGN_ASSETS: DesignAsset[] = OPEN_SOURCE_ICONS.map((icon) => ({
  id: icon.id,
  provider: icon.provider,
  providerAssetId: icon.providerAssetId,
  title: icon.title,
  type: "icon",
  category: icon.category,
  tags: icon.tags,
  previewUrl: openSourceIconDataUrl(icon, "#171412"),
  vectorAvailable: true,
  editableColors: true,
  licenseMetadata: `${icon.providerLabel} — MIT license, no attribution required.`,
  licenseType: icon.licenseType,
  licenseUrl: icon.licenseUrl,
  sourceUrl: icon.sourceUrl,
  attributionRequired: false,
  trademarkRestrictions: null,
  approvedForCustomerUse: true,
  approvedForPhysicalPrint: true,
  reviewedAt: REVIEWED_AT,
  productionSource: openSourceIconDataUrl(icon, "#171412"),
}));

/** The full curated library every Studio surface (GraphicsPanel, templates.ts's
 *  resolveTemplateAssets) reads from — Maple-original marks plus the verified open-source icon
 *  set, every entry already `approvedForCustomerUse && approvedForPhysicalPrint`. Kept under the
 *  pre-existing `MAPLE_ASSETS`/`MapleAssetProvider` export names (call sites elsewhere in Studio
 *  already import these) even though the content is no longer Maple-only — renaming would touch
 *  several files for no behavioural benefit. */
export const MAPLE_ASSETS: DesignAsset[] = [...MAPLE_DESIGN_ASSETS, ...OPEN_SOURCE_DESIGN_ASSETS];

export const MapleAssetProvider: AssetProvider = {
  id: "maple-studio-library",
  name: "Maple Studio Library",
  async categories() {
    return [...new Set(MAPLE_ASSETS.map((a) => a.category))];
  },
  async search(query: string, category?: string) {
    const q = query.trim().toLowerCase();
    return MAPLE_ASSETS.filter((a) => {
      const matchesCategory = !category || category === "all" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
      return matchesCategory && matchesQuery;
    });
  },
  async getAsset(id: string) {
    return MAPLE_ASSETS.find((a) => a.id === id) ?? null;
  },
};

/** Recolors any asset in the curated library (Maple-original or open-source) — used by
 *  GraphicsPanel/Inspector's "Colour" control, since every mark here is otherwise fixed at its
 *  default #171412 fill. Keyed by the asset's globally-unique `id` (e.g. "tabler-briefcase"), not
 *  the bare providerAssetId — several packages share a providerAssetId like "briefcase", so only
 *  `id` (which already namespaces by provider) can look up the right one. */
export function recolorMapleAsset(id: string, fill: string): string | null {
  const maple = MAPLE_DESIGN_ASSETS.find((x) => x.id === id);
  if (maple) {
    const source = MAPLE_GRAPHICS.find((x) => `maple-${x.id}` === id);
    return source ? svgDataUrl(source.path, fill) : null;
  }
  const icon = OPEN_SOURCE_ICONS.find((x) => x.id === id);
  return icon ? openSourceIconDataUrl(icon, fill) : null;
}

export const ASSET_PROVIDERS: AssetProvider[] = [MapleAssetProvider];
