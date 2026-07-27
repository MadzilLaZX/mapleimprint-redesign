import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { SOLUTIONS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "Ottawa print solutions for businesses, teams and schools, events and fundraisers, creators, corporate merchandise and bulk orders.",
};

export default function SolutionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Solutions"
        title="Built around why you're ordering, not just what"
        description="Every solution page maps a use case to the right products, decoration methods and order workflow."
      />

      <Section tone="canvas">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.05}>
              <Link href={`/solutions/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={`https://picsum.photos/seed/mi-solution-${s.slug}/800/500`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="img-brand object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-semibold text-ink-900">{s.name}</h2>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted transition-colors group-hover:text-orange" weight="bold" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.blurb}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
