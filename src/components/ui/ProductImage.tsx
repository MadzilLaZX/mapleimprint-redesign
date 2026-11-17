"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageBroken } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { shouldShowImageFallback } from "@/components/ui/productImageFallback";

export interface ProductImageProps {
  /** Null/undefined means "no photo exists for this item at all" -- shows the same fallback as a
   *  genuinely failed load, never a separate "no image" state that looks different. */
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Applied to the real <Image> only (object-cover/contain, hover transforms, etc.). */
  className?: string;
  /** Applied to the fallback wrapper only -- defaults to bg-canvas, matching every existing
   *  usage site-wide; override only if a specific card needs a different fallback background. */
  fallbackClassName?: string;
  /** Icon size class for the fallback state -- defaults to a medium card-sized icon; pass a
   *  smaller one (e.g. "size-4") for small thumbnails (cart lines, gallery strips). */
  iconClassName?: string;
  /** Set false for small thumbnails where "Image coming soon" text would overflow/crowd the
   *  layout -- the icon alone is still a clear, intentional fallback, never a raw broken-image
   *  icon or empty box. */
  showLabel?: boolean;
}

/**
 * The one shared "show a real product photo, or a clearly-intentional placeholder, never a raw
 * broken-image icon / bare alt text / empty box" component for the whole site. Fills its nearest
 * positioned ancestor exactly like next/image's own `fill` prop (because that's what it renders
 * under the hood) -- drop it inside any existing `relative aspect-[...] overflow-hidden`
 * container without changing that container's markup.
 *
 * WHY THIS EXISTS: several surfaces across the site (the Shop grid, the homepage carousel, the
 * product detail gallery, cart, checkout) had each independently hand-rolled the identical
 * onError/useState pattern -- and at least one real surface (the category/subcategory product
 * listing pages) had NO fallback at all, so a blocked supplier image (see next.config.ts's own
 * note on S&S Activewear's CDN) rendered the browser's raw broken-image icon with the alt text
 * exposed next to it, and in some layouts an oversized empty box, instead of a styled
 * placeholder. Centralizing this means every one of those surfaces now behaves identically, and
 * any future product-image surface gets the correct behavior by construction rather than by
 * remembering to copy the pattern again.
 *
 * Never hides a product or substitutes a different, misleading photo -- a missing/failed image
 * always shows the same honest "Image coming soon" (or icon-only, for small thumbnails), never a
 * generic stock photo standing in for the real item.
 *
 * TESTING NOTE: the fallback-vs-real-image decision is deliberately delegated to
 * `shouldShowImageFallback()` (productImageFallback.ts) and tested there -- this .tsx file itself
 * cannot be loaded by this project's `node --test` runner at all (confirmed: it rejects the
 * `.tsx` extension outright, independent of JSX content), so the actual rendered markup for this
 * component is verified manually against a real dev server instead, not by an automated test.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  fallbackClassName,
  iconClassName = "size-8",
  showLabel = true,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  // The `|| !src` repeats part of shouldShowImageFallback()'s own condition -- deliberately, so
  // TypeScript can narrow `src` to a definite `string` below without a non-null assertion. The
  // shared function is still the single source of truth for the actual decision (and what's
  // under test); this is just satisfying the type checker for the one branch where `src` must be
  // real.
  if (shouldShowImageFallback(src, failed) || !src) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas text-muted", fallbackClassName)}>
        <ImageBroken className={iconClassName} weight="light" />
        {showLabel && <span className="text-xs">Image coming soon</span>}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
