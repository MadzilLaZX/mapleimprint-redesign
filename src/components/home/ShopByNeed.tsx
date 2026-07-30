import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

const spans: Record<string, string> = {
  "custom-apparel": "md:col-span-2 md:row-span-2",
  "workwear-uniforms": "md:col-span-2",
};

export function ShopByNeed() {
  return (
    <section className="bg-canvas py-20 md:py-28 lg:py-32">
      <Container>
        <Reveal className="max-w-xl">
          <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
            Shop by what you need
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Eight categories cover the full catalogue. Pick one to see products, decoration methods and honest pricing.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[13rem] md:grid-flow-row-dense">
          {PRODUCT_CATEGORIES.map((cat, i) => (
            <Reveal key={cat.slug} delay={i * 0.04} className={spans[cat.slug]}>
              <Link
                href={`/products/${cat.slug}`}
                className="group relative flex h-56 w-full flex-col justify-end overflow-hidden rounded-[28px] md:h-full"
              >
                <Image
                  src={cat.cover}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/25 to-transparent" />
                <div className="relative flex items-end justify-between gap-3 p-5">
                  <div>
                    <p className="font-display text-lg font-semibold text-white md:text-xl">
                      {cat.name}
                    </p>
                    <p className="mt-1 max-w-[26ch] text-sm leading-snug text-white/70">
                      {cat.blurb}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="size-5 shrink-0 text-white/80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    weight="bold"
                  />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
