/**
 * The one piece of real decision logic behind ProductImage.tsx's "show the real photo, or the
 * styled fallback" behavior -- extracted into its own plain .ts module specifically so it has a
 * regression test at all. ProductImage.tsx itself is a .tsx file (real JSX), and this project's
 * test runner (plain `node --test` with a type-stripping-only loader, no JSX/bundler transform)
 * cannot load `.tsx` files under any circumstance -- confirmed directly (`ERR_UNKNOWN_FILE_EXTENSION`
 * for the extension itself, independent of whether the file contains JSX) -- so no `.tsx`
 * component in this codebase has ever had an automated test. This file exists so the actual
 * branching condition is still covered, even though the rendered markup itself isn't -- see
 * productImageFallback.test.ts, and ProductImage.tsx's own header for how this was manually
 * verified against a real dev server instead.
 */
export function shouldShowImageFallback(src: string | null | undefined, failed: boolean): boolean {
  return !src || failed;
}
