import { isKnownUnreliableImageHost } from "@/lib/shopQuery";

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
 *
 * ALSO proactively skips the real image attempt for a host already CONFIRMED to reject embedded
 * requests (shopQuery.ts's `isKnownUnreliableImageHost` -- same list `sortByImageReliability`
 * uses). Added 2026-11-22: with 98% of the generated catalogue now on one of those two confirmed-
 * blocked hosts, waiting for `next/image`'s `onError` to fire (a real DNS+TLS+403 round trip) on
 * nearly every product image was pure wasted load time with a predictable outcome -- this isn't
 * skipping a *maybe*, it's not bothering to repeat a request already known to fail. Doesn't touch
 * how the request would be made if attempted, doesn't change anything for a host not on that
 * list, and the moment a host is resolved (removed from that list, or `resolveHostedImage()`
 * starts returning a real rehosted URL) it's indistinguishable from any other real photo again,
 * no code change needed here.
 */
export function shouldShowImageFallback(src: string | null | undefined, failed: boolean): boolean {
  return !src || failed || isKnownUnreliableImageHost(src);
}
