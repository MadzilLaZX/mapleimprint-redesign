"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CaretLeft, CaretRight, ImageBroken } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { formatUnitPrice } from "@/lib/pricing/formatUnitPrice";
import type { ShopProduct } from "@/lib/shopProducts";

const CARD_WIDTH = "w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[29%] xl:w-[23%]";

// Resolved server-side by the parent (see homepageFeatured.ts) and passed in — that resolution
// touches the filesystem (subcategory image fallback lookups), which can only run on the server;
// this component only renders the already-resolved list.
export function FeaturedProducts({ products }: { products: ShopProduct[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (products.length === 0) return null;

  function scrollByAmount(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <section className="bg-white py-20 md:py-28 lg:py-32">
      <Container className="max-w-none px-0">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Reveal className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
              Explore what we print
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Apparel, drinkware, print and promotional products — ready to make yours.
            </p>
          </Reveal>
        </div>

        <div className="relative mt-10">
          {/* Edge fades signal more content off-screen — hidden once the rail is scrolled that
              direction, same scroll-state the arrows already track, no extra listener. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 lg:w-16 ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 lg:w-16 ${canScrollRight ? "opacity-100" : "opacity-0"}`}
          />

          <RevealGroup stagger={0.045}>
            <div
              ref={railRef}
              className="flex gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] snap-x snap-proximity lg:px-8 [&::-webkit-scrollbar]:hidden"
            >
              {products.map((product, i) => (
                <RevealItem key={product.id} className={CARD_WIDTH}>
                  <FeaturedProductCard product={product} priority={i < 4} reduce={!!reduce} onPrefetch={() => router.prefetch(product.href)} />
                </RevealItem>
              ))}

              <RevealItem className={CARD_WIDTH}>
                <Link
                  href="/shop"
                  className="group flex aspect-[4/5] w-full flex-col items-start justify-end overflow-hidden rounded-2xl bg-ink-950 p-6"
                >
                  <span className="text-gradient font-display text-lg font-semibold">Explore the full collection</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-transform duration-200 ease-[var(--ease-premium)] group-hover:translate-x-0.5">
                    Explore All Products
                    <ArrowRight className="size-3.5" weight="bold" />
                  </span>
                </Link>
              </RevealItem>
            </div>
          </RevealGroup>

          <AnimatePresence>
            {canScrollRight && (
              <motion.button
                key="rail-right"
                type="button"
                aria-label="Scroll to see more products"
                onClick={() => scrollByAmount(1)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-900 shadow-lg transition-transform hover:scale-105 sm:flex lg:right-8"
              >
                <CaretRight className="size-5" weight="bold" />
              </motion.button>
            )}
            {!canScrollRight && canScrollLeft && (
              <motion.button
                key="rail-left"
                type="button"
                aria-label="Scroll back"
                onClick={() => scrollByAmount(-1)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-900 shadow-lg transition-transform hover:scale-105 sm:flex lg:left-8"
              >
                <CaretLeft className="size-5" weight="bold" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

function FeaturedProductCard({
  product,
  priority,
  reduce,
  onPrefetch,
}: {
  product: ShopProduct;
  priority: boolean;
  reduce: boolean;
  onPrefetch: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link href={product.href} onMouseEnter={onPrefetch} onFocus={onPrefetch} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-sand">
        {product.image && !imageFailed ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 23vw, (min-width: 1024px) 29vw, (min-width: 640px) 46vw, 82vw"
            priority={priority}
            onError={() => setImageFailed(true)}
            className={`object-cover transition-transform duration-200 ease-[var(--ease-premium)] ${reduce ? "" : "group-hover:scale-[1.02] group-hover:-translate-y-1"}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
            <ImageBroken className="size-8" weight="light" />
            <span className="text-xs">Image coming soon</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{product.categoryName}</p>
      <h3 className="mt-1 line-clamp-2 font-display font-semibold text-ink-900">{product.name}</h3>
      <p className="mt-1 text-sm font-semibold text-ink-900">
        {product.startingPrice !== null ? (
          <>
            From {formatUnitPrice(product.startingPrice)}
            <span className="font-normal text-muted"> / {product.priceUnit}</span>
          </>
        ) : (
          <span className="font-normal text-muted">Quote required</span>
        )}
      </p>
      <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 transition-transform duration-200 ease-[var(--ease-premium)] group-hover:translate-x-0.5">
        View Product
        <ArrowRight className="size-3.5" weight="bold" />
      </span>
    </Link>
  );
}
