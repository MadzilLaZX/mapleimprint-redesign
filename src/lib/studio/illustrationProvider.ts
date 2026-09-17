// Third AssetProvider (see assetProviders.ts's top comment: "Adding either later means writing
// one more class implementing AssetProvider — nothing in the Studio UI or DesignTemplate model
// changes"). A small, hand-curated set of illustrations from four independently license-verified
// CC0/public-domain sources — Openclipart, PublicDomainVectors.org, and Open Peeps (Pablo
// Stanley, CC0) — extracted once and baked fully offline into ILLUSTRATIONS (see
// illustrations.generated.ts), same as MAPLE_GRAPHICS/OPEN_ICONS. No network calls, no API keys,
// no runtime dependency on any of the source sites.
//
// Humaaans was researched as a candidate too (the brief's other suggested "mix-and-match people"
// library) but was deliberately left out: independent checks this session turned up sources
// describing it as "free for commercial use" without a clear, unambiguous CC0 grant, which fails
// this registry's CC0/public-domain-only bar. See illustrationProvider's caller (GraphicsPanel)
// and the session report for the full per-source license rationale.
//
// No brand/trademark content, and no whole business-card layouts even though a couple of source
// items originated on Openclipart's business-card-template pages — this app is apparel-only, so
// only generic, individually-placeable elements (a flourish, a seal) were kept from those pages.
import type { AssetProvider, DesignAsset } from "./assetProviders";
import { ILLUSTRATIONS } from "./illustrations.generated";

// "fixed" entries are real, multi-color (or intentionally single-color) source artwork — colors
// are embedded exactly as authored and the `fill` parameter is ignored (not recolorable, mirrors
// editableColors: false below). "mono" entries are original flat marks that follow the same
// convention as MAPLE_GRAPHICS' svgDataUrl(): root `fill` cascades to any child that doesn't set
// its own, and a hardcoded "#171412" stroke gets swapped so "Colour" recolors the whole mark.
function illustrationDataUrl(item: (typeof ILLUSTRATIONS)[number], fill = "#171412"): string {
  if (item.colorMode === "fixed") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewBox}" fill="none">${item.inner}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  const recoloured = fill === "#171412" ? item.inner : item.inner.replaceAll("#171412", fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${item.viewBox}" fill="${fill}">${recoloured}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const ILLUSTRATION_ASSETS: DesignAsset[] = ILLUSTRATIONS.map((item) => ({
  id: `illustration-${item.id}`,
  provider: "illustrations",
  providerAssetId: item.id,
  title: item.title,
  type: "graphic",
  category: item.category,
  tags: item.tags,
  previewUrl: illustrationDataUrl(item),
  vectorAvailable: true,
  editableColors: item.colorMode === "mono",
  licenseMetadata: item.license,
  productionSource: illustrationDataUrl(item),
}));

export const IllustrationProvider: AssetProvider = {
  id: "illustrations",
  name: "Illustrations",
  async categories() {
    return [...new Set(ILLUSTRATIONS.map((item) => item.category))];
  },
  async search(query: string, category?: string) {
    const q = query.trim().toLowerCase();
    return ILLUSTRATION_ASSETS.filter((a) => {
      const matchesCategory = !category || category === "all" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q));
      return matchesCategory && matchesQuery;
    });
  },
  async getAsset(id: string) {
    return ILLUSTRATION_ASSETS.find((a) => a.id === id) ?? null;
  },
};

/** Recolors a "mono" illustration's SVG data URL — mirrors recolorMapleAsset()/recolorOpenIconAsset()
 *  for parity. Returns null for "fixed" (real, multi-color source artwork) illustrations, which
 *  aren't recolorable — same reasoning as editableColors: false on their DesignAsset entries. */
export function recolorIllustrationAsset(providerAssetId: string, fill: string): string | null {
  const item = ILLUSTRATIONS.find((x) => x.id === providerAssetId);
  if (!item || item.colorMode !== "mono") return null;
  return illustrationDataUrl(item, fill);
}
