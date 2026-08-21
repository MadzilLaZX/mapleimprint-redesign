"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const imagesForColour = product.images.filter((img) => img.colourName === selectedColour);
  // ~1.2% of colour/product pairs have no matching supplier photo — fall back to the product's
  // default images rather than showing nothing, but say so, rather than silently showing what
  // looks like (but isn't) the selected colour.
  const gallery = imagesForColour.length > 0 ? imagesForColour : product.images;
  const usingFallback = imagesForColour.length === 0 && product.images.length > 0;

  // Reset to the first image when the colour changes: keyed by selectedColour at the call site
  // (see ProductDetail.tsx) so this component remounts on colour change, which is what actually
  // resets `index` here — not a useState-in-effect sync.
  const [index, setIndex] = useState(0);

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
        {current ? (
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
                alt={`${product.name} in ${selectedColour}`}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
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
              <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
