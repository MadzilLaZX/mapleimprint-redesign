// Single source of truth for "which colour/image represents this product" — every surface that
// used to guess independently (shop card, category/subcategory listing grid, the product page's
// initial colour, Surprise Me's cart line) now calls one of these two functions instead of reading
// `product.colours[0]` or `product.images[0]` inline. Those two arrays are NOT guaranteed to agree
// with each other or with anything a customer actually saw: neither S&S nor SanMar's connector
// ever populates a real "this is the primary colourway" signal (catalogue-engine's
// ProductImage.sortOrder is always 0 for every row from every supplier — confirmed by grep, not
// assumed), so each array's first element just reflects whatever order sync happened to insert
// rows in. That's how a shop card could show White while the product page it links to opened on
// Black for the exact same product record — not a routing bug, a same-record default-colour bug.
// See PROJECT_NOTES.md's "card/product colour mismatch" entry for the incident writeup.

import type { CatalogueProduct, ProductImage } from "./products";

/** The canonical colour for a product when nothing else (an explicit customer choice) overrides
 *  it. Deterministic and reproducible purely from the exported data — the alphabetically-first
 *  colour that actually has a photo — rather than "whichever row a supplier sync inserted first."
 *  Falls back to the alphabetically-first colour with no photo, then to colours[0], only if a
 *  product genuinely has zero photographed colours at all. */
export function defaultColourFor(product: CatalogueProduct): string {
  if (product.colours.length === 0) return "";
  const photographed = new Set(
    product.images.map((img) => img.colourName).filter((c): c is string => Boolean(c)),
  );
  const withPhoto = product.colours.filter((c) => photographed.has(c));
  const pool = withPhoto.length > 0 ? withPhoto : product.colours;
  return [...pool].sort((a, b) => a.localeCompare(b))[0];
}

/** The single image that represents a given product+colour combination. Prefers an exact
 *  colour+view match; falls back to any photo of that colour, then to the product's canonical
 *  default colour's photo, then to the first image of any kind — but never silently claims a
 *  colour match it doesn't have (callers that need to know whether they got a real match should
 *  compare `result?.colourName` against the colour they asked for, same as ProductGallery already
 *  does for its own "showing another colourway for reference" disclosure). */
export function heroImageFor(
  product: CatalogueProduct,
  colourName: string,
  imageType: string = "front",
): ProductImage | null {
  const forColour = product.images.filter((img) => img.colourName === colourName);
  if (forColour.length > 0) {
    return forColour.find((img) => img.imageType === imageType) ?? forColour[0];
  }
  const defaultColour = defaultColourFor(product);
  if (defaultColour && defaultColour !== colourName) {
    const forDefault = product.images.filter((img) => img.colourName === defaultColour);
    if (forDefault.length > 0) {
      return forDefault.find((img) => img.imageType === imageType) ?? forDefault[0];
    }
  }
  return product.images[0] ?? null;
}
