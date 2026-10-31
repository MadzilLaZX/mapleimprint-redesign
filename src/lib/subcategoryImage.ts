import { existsSync, readdirSync } from "fs";
import path from "path";

const SUBCATEGORY_IMAGES_DIR = path.join(process.cwd(), "public", "images", "products", "subcategories");

/** Resolves a subcategory listing-tile photo. Falls back to another real photo already shot for
 *  that category when this specific subcategory doesn't have one yet, rather than linking to a
 *  file that doesn't exist (which 400s through Next/Image's optimizer and shows a broken image to
 *  every visitor). Returns null only when the category has no photography at all yet — callers
 *  should render a non-photo placeholder tile in that case instead of an <Image>. */
export function resolveSubcategoryImage(categorySlug: string, subcategorySlug: string): string | null {
  const dir = path.join(SUBCATEGORY_IMAGES_DIR, categorySlug);
  const exact = `${subcategorySlug}.jpg`;
  if (existsSync(path.join(dir, exact))) {
    return `/images/products/subcategories/${categorySlug}/${exact}`;
  }
  if (!existsSync(dir)) return null;
  const fallback = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".jpg"));
  return fallback ? `/images/products/subcategories/${categorySlug}/${fallback}` : null;
}
