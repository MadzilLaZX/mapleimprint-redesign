import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Custom Print Products",
  description:
    "Browse Maple Imprint's full catalogue: custom apparel, workwear, hats, business printing, signs, stickers, drinkware and promotional products.",
};

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Eight categories, one clear path to checkout"
        description="Every category supports instant customization for standard runs, and a guided quote for anything bigger or more specific."
      />

      <Section tone="canvas">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_CATEGORIES.map((cat, i) => (
            <Reveal key={cat.slug} delay={i * 0.05}>
              <Link
                href={`/products/${cat.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={`https://picsum.photos/seed/mi-${cat.slug}/800/600`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="img-brand object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-semibold text-ink-900">{cat.name}</h2>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted transition-colors group-hover:text-orange" weight="bold" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{cat.blurb}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {cat.subcategories.slice(0, 3).map((sub) => (
                      <li key={sub} className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-900/70">
                        {sub}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="white">
        <Container className="max-w-3xl text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              Not sure where to start?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
              Tell us what the order is for and we&apos;ll point you to the right products and decoration methods.
            </p>
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
