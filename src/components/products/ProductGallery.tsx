"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ImageBroken } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { CatalogueProduct } from "@/lib/products";

export function ProductGallery({
  product,
  selectedColour,
}: {
  product: CatalogueProduct;
  selectedColour: string;
}) {
  const reduce = useReducedMotion();
  // House products (banners/cards/flyers) have no colour concept at all — colours: [], so
  // defaultColourFor() returns "" — which is different from "this colour has no photo" and
  // shouldn't trigger the "showing another colourway" disclosure below.
  const hasColour = selectedColour !== "";
  const imagesForColour = hasColour ? product.images.filter((img) => img.colourName === selectedColour) : product.images;
  // ~1.2% of colour/product pairs have no matching supplier photo — fall back to the product's
  // default images rather than showing nothing, but say so, rather than silently showing what
  // looks like (but isn't) the selected colour.
  const gallery = imagesForColour.length > 0 ? imagesForColour : product.images;
  const usingFallback = hasColour && imagesForColour.length === 0 && product.images.length > 0;

  // Reset to the first image when the colour changes: keyed by selectedColour at the call site
  // (see ProductDetail.tsx) so this component remounts on colour change, which is what actually
  // resets `index` here — not a useState-in-effect sync.
  const [index, setIndex] = useState(0);

  // Tracks which image URLs have failed to load (e.g. a blocked supplier CDN request, see
  // next.config.ts's own note on S&S Activewear's Cloudflare 403) so this gracefully falls back
  // to the same "Image coming soon" placeholder ProductCard.tsx/FeaturedProducts.tsx already use
  // elsewhere on the site, instead of a broken-image icon on the actual product page -- the one
  // place a customer is deciding whether to buy. Keyed by URL (a Set, not a single boolean)
  // because the hero image and several thumbnails are independent <Image> elements that can each
  // fail or succeed on their own.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const markFailed = (url: string) => setFailedUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  // Warm the browser cache for every colour's primary photo shortly after the page settles, so
  // switching colours feels instant. Capped and low-priority — this is a handful of already-
  // compressed CDN thumbnails, not hundreds of full-size images.
  useEffect(() => {
    const primaryByColour = new Map<string, string>();
    for (const img of product.images) {
      if (img.colourName && !primaryByColour.has(img.colourName)) primaryByColour.set(img.colourName, img.url);
    }
    const urls = [...primaryByColour.values()].slice(0, 10);
    const timer = setTimeout(() => {
      for (const url of urls) {
        const preload = new window.Image();
        preload.src = url;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [product.images]);

  const current = gallery[index] ?? gallery[0];

  return (
    <div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-white">
        {current && !failedUrls.has(current.url) ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.url}
              initial={reduce ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={current.url}
                alt={hasColour ? `${product.name} in ${selectedColour}` : product.name}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                className="object-cover"
                onError={() => markFailed(current.url)}
              />
            </motion.div>
          </AnimatePresence>
        ) : current ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas text-muted">
            <ImageBroken className="size-8" weight="light" />
            <span className="text-xs">Image coming soon</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No image yet</div>
        )}
      </div>

      {usingFallback && (
        <p className="mt-2 text-xs text-muted">
          Photo not available in {selectedColour} yet — showing another colourway for reference.
        </p>
      )}

      {gallery.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {gallery.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1} of ${product.name}${img.colourName ? ` in ${img.colourName}` : ""}`}
              aria-current={i === index}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg bg-white ring-2 transition-colors",
                i === index ? "ring-ink-950" : "ring-transparent hover:ring-sand",
              )}
            >
              {failedUrls.has(img.url) ? (
                <div className="flex h-full w-full items-center justify-center bg-canvas text-muted">
                  <ImageBroken className="size-4" weight="light" />
                </div>
              ) : (
                <Image src={img.url} alt="" fill sizes="120px" priority={i < 4} className="object-cover" onError={() => markFailed(img.url)} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
