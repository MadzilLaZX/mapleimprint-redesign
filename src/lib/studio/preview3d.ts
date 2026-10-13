import type { ProductFamily } from "@/lib/studio/productDecorationProfile";
import type { DrinkwareKind } from "@/lib/houseProducts/pricing/drinkware";

// Families that render on real garment photography (front/back are an actual photo, not a flat
// schematic) — a rotatable 3D box/plane doesn't fit that mental model the way it does for a print
// piece, and there's no real-world "this garment as a box" shape to show anyway. Every other
// family (mug, business-card, postcard, flyer, poster, banner, sticker, accessory) gets the 2D/3D
// toggle: mug via the vessel-aware Mug3DPreview, everything else via the generic Flat3DPreview.
// Shared between StudioClient (the editing canvas) and ReviewPanel (the approval screen) so both
// surfaces agree on which families get a 3D toggle at all.
export const FAMILIES_WITHOUT_3D: ProductFamily[] = ["tee", "hoodie", "joggers", "headwear"];

// Every drinkware subcategory shares the "mug" family/print-area (see productDecorationProfile's
// familyFor), but the 3D preview needs to know which actual vessel it's rendering — this mirrors
// the same subcategorySlug set familyFor checks against, mapped onto DrinkwareConfigurator's
// DrinkwareKind. Falls back to "mug" for anything unrecognized rather than guessing.
export function drinkwareKindFor(subcategorySlug: string): DrinkwareKind {
  switch (subcategorySlug) {
    case "tumblers": return "tumbler";
    case "bottles": return "water-bottle";
    case "glassware": return "pint-glass";
    default: return "mug";
  }
}
