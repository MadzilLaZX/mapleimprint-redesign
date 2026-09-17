// Second AssetProvider (see assetProviders.ts's top comment: "Adding either later means writing
// one more class implementing AssetProvider — nothing in the Studio UI or DesignTemplate model
// changes"). Backed by a curated subset of three MIT-licensed open icon sets — Tabler Icons,
// Heroicons, and Bootstrap Icons — extracted once at build time into OPEN_ICONS (see
// openIcons.generated.ts) and baked fully offline, same as MAPLE_GRAPHICS. No network calls, no
// API keys, no runtime dependency on the source npm packages (those were only needed to read raw
// SVG source while generating the registry; they are not imported here).
//
// No brand/trademark logos are included — every icon is a generic shape (tools, sports balls,
// food, weather, arrows, hearts, etc.), never a company or social-platform mark.
import type { AssetProvider, DesignAsset } from "./assetProviders";
import { OPEN_ICONS } from "./openIcons.generated";

// Tabler/Heroicons ship stroke-based icons (fill:none, stroke:currentColor); Bootstrap Icons ships
// fill-based icons (fill:currentColor). Each OPEN_ICONS entry records its own `mode`/`viewBox` so
// this single renderer can recolor either kind consistently, mirroring svgDataUrl()'s convention
// in assetProviders.ts.
function openIconDataUrl(icon: (typeof OPEN_ICONS)[number], fill = "#171412"): string {
  const presentation =
    icon.mode === "stroke"
      ? `fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
      : `fill="${fill}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ${presentation}>${icon.inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const OPEN_ICON_ASSETS: DesignAsset[] = OPEN_ICONS.map((icon) => ({
  id: `openicon-${icon.id}`,
  provider: "open-icons",
  providerAssetId: icon.id,
  title: icon.title,
  type: "icon",
  category: icon.category,
  tags: icon.tags,
  previewUrl: openIconDataUrl(icon),
  vectorAvailable: true,
  editableColors: true,
  licenseMetadata: icon.license,
  productionSource: openIconDataUrl(icon),
}));

export const OpenIconProvider: AssetProvider = {
  id: "open-icons",
  name: "Open Icons",
  async categories() {
    return [...new Set(OPEN_ICONS.map((icon) => icon.category))];
  },
  async search(query: string, category?: string) {
    const q = query.trim().toLowerCase();
    return OPEN_ICON_ASSETS.filter((a) => {
      const matchesCategory = !category || category === "all" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
      return matchesCategory && matchesQuery;
    });
  },
  async getAsset(id: string) {
    return OPEN_ICON_ASSETS.find((a) => a.id === id) ?? null;
  },
};

/** Recolors an open-icon SVG data URL — mirrors recolorMapleAsset() for parity if a future
 *  palette-driven template wants to bake one of these icons at a specific fill, the same way
 *  templates.ts does for Maple graphics today. */
export function recolorOpenIconAsset(providerAssetId: string, fill: string): string | null {
  const icon = OPEN_ICONS.find((x) => x.id === providerAssetId);
  return icon ? openIconDataUrl(icon, fill) : null;
}
