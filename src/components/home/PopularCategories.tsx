"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const picks = [
  {
    name: "Staff polos",
    tag: "Popular for teams",
    href: "/products/workwear-uniforms",
    image: "/images/popular/staff-polos.jpg",
  },
  {
    name: "Custom hoodies",
    tag: "Ottawa favourite",
    href: "/products/custom-apparel",
    image: "/images/popular/custom-hoodies.jpg",
  },
  {
    name: "Event banners",
    tag: "Ready in days",
    href: "/products/signs-banners",
    image: "/images/popular/event-banners.jpg",
  },
  {
    name: "Business cards",
    tag: "Small runs welcome",
    href: "/products/business-printing",
    image: "/images/popular/business-cards.jpg",
  },
  {
    name: "Custom tumblers",
    tag: "Great for gifts",
    href: "/products/drinkware",
    image: "https://picsum.photos/seed/mi-tumbler/700/900",
    brandTone: true,
  },
  {
    name: "Die-cut stickers",
    tag: "No minimum",
    href: "/products/stickers-labels",
    image: "https://picsum.photos/seed/mi-sticker/700/900",
    brandTone: true,
  },
];

export function PopularCategories() {
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

  function scrollByAmount(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const showRightArrow = canScrollRight;
  const showLeftArrow = !canScrollRight && canScrollLeft;

  return (
    <section className="bg-white py-20 md:py-28 lg:py-32">
      <Container className="max-w-none px-0">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 md:flex-row md:items-end lg:px-8">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
              Popular right now
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              A rotating look at what Ottawa is ordering most. Every item can be customized and priced instantly.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="relative mt-10">
            <div
              ref={railRef}
              className="flex gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] snap-x snap-mandatory lg:px-8 [&::-webkit-scrollbar]:hidden"
            >
              {picks.map((pick) => (
                <Link
                  key={pick.name}
                  href={pick.href}
                  className="group relative w-[76%] shrink-0 snap-start overflow-hidden rounded-[24px] sm:w-[45%] lg:w-[29%]"
                >
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={pick.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 29vw, (min-width: 640px) 45vw, 76vw"
                      className={`object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105 ${pick.brandTone ? "img-brand" : ""}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink-900">
                      {pick.tag}
                    </span>
                    <p className="mt-3 font-display text-lg font-semibold text-white">{pick.name}</p>
                  </div>
                </Link>
              ))}
            </div>

            <AnimatePresence>
              {showRightArrow && (
                <motion.button
                  key="rail-right"
                  type="button"
                  aria-label="Scroll to see more"
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
              {showLeftArrow && (
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
        </Reveal>
      </Container>
    </section>
  );
}
