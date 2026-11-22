/** Extracted from QuoteWizard.tsx specifically so this has a regression test -- that file is a
 *  .tsx component and this project's `node --test` runner can't load .tsx files at all (same
 *  established reason productImageFallback.ts and shippingQuoteRequestMessage.ts were split out). */

export type ProjectType =
  | "apparel"
  | "uniforms"
  | "print"
  | "signs"
  | "stickers"
  | "promo"
  | "mixed"
  | "unsure";

/** The minimal shape this module needs from a cart-handoff line -- avoids importing
 *  CartProvider.tsx's full QuoteCartHandoff type just for this one field. */
export interface CategorizedLine {
  categorySlug: string;
}

/** Maps a cart-handoff line's real categorySlug to the closest project-type option, for
 *  pre-selecting QuoteWizard's step 1 when a customer arrives already carrying real cart/design
 *  context (Studio's drinkware "Approve & Request a Quote", or the cart page's "Get a Quote").
 *  Only the unambiguous cases are mapped -- anything not listed stays unmapped (`null`) rather
 *  than guessing, since a wrong pre-selection is worse than none; the customer still sees and can
 *  change whatever gets pre-selected on step 1, this never skips that step. */
export const CATEGORY_TO_PROJECT_TYPE: Partial<Record<string, ProjectType>> = {
  "custom-apparel": "apparel",
  "workwear-uniforms": "uniforms",
  "business-printing": "print",
  "signs-banners": "signs",
  "stickers-labels": "stickers",
  drinkware: "promo",
  "gifts-promo": "promo",
};

export function projectTypeForHandoff(lines: CategorizedLine[]): ProjectType | null {
  const distinctCategories = [...new Set(lines.map((l) => l.categorySlug))];
  if (distinctCategories.length === 0) return null;
  if (distinctCategories.length > 1) return "mixed";
  return CATEGORY_TO_PROJECT_TYPE[distinctCategories[0]] ?? null;
}
