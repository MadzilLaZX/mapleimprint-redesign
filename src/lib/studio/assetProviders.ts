// Normalized graphics-asset model (Section 11, "Asset Provider Abstraction"). Studio's Graphics
// panel talks only to this interface, never to a vendor SDK/response shape directly — the same
// principle as SupplierConnector in catalogue-engine. Today exactly one provider is registered:
// MapleAssetProvider, a small set of Maple-owned, hand-built SVG marks (simple geometric icons —
// no photography, no third-party stock). Vexels/Noun Project were researched as candidates and
// deliberately NOT integrated (see PROJECT_NOTES.md's "Studio V2" entry): Vexels has no self-serve
// API and its license doesn't clearly authorize this exact use, Noun Project was scoped as a later
// secondary option. Adding either later means writing one more class implementing AssetProvider —
// nothing in the Studio UI or DesignTemplate model changes.

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
  /** Whether the customer can recolor this asset in Studio (true for our flat single-path marks). */
  editableColors: boolean;
  licenseMetadata: string;
  /** What actually gets embedded into the DesignObject when placed — for the Maple provider this
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

function svgDataUrl(inner: string, fill = "#171412"): string {
  // A few marks (laurel, compass, snowflake, banner) hardcode their stroke colour rather than
  // inheriting the root `fill` — swap those too so "Colour" recolors the whole mark consistently.
  const recoloured = fill === "#171412" ? inner : inner.replaceAll("#171412", fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${fill}">${recoloured}</svg>`;
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

export const MAPLE_ASSETS: DesignAsset[] = MAPLE_GRAPHICS.map((g) => ({
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
  productionSource: svgDataUrl(g.path),
}));

export const MapleAssetProvider: AssetProvider = {
  id: "maple",
  name: "Maple",
  async categories() {
    return [...new Set(MAPLE_GRAPHICS.map((g) => g.category))];
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

/** Recolors a Maple graphic's SVG data URL — used by GraphicsPanel/inspector "Colour" control
 *  since the flat single-path marks above are otherwise fixed at their #171412 default fill. */
export function recolorMapleAsset(providerAssetId: string, fill: string): string | null {
  const g = MAPLE_GRAPHICS.find((x) => x.id === providerAssetId);
  return g ? svgDataUrl(g.path, fill) : null;
}

export const ASSET_PROVIDERS: AssetProvider[] = [MapleAssetProvider];
