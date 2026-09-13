import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRODUCT_CATEGORIES, PRIMARY_CTA, SECONDARY_CTA, SOLUTIONS } from "@/lib/constants";
import { SOLUTION_DETAILS } from "@/lib/solutionDetails";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ solution: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ solution: string }>;
}): Promise<Metadata> {
  const { solution } = await params;
  const s = SOLUTIONS.find((item) => item.slug === solution);
  if (!s) return {};
  return { title: s.name, description: s.blurb };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ solution: string }>;
}) {
  const { solution } = await params;
  const s = SOLUTIONS.find((item) => item.slug === solution);
  if (!s) notFound();
  const detail = SOLUTION_DETAILS[s.slug];
  const categories = PRODUCT_CATEGORIES.filter((c) => detail.categories.includes(c.slug));

  return (
    <>
      <PageHeader eyebrow="Solutions" title={s.name} description={s.blurb} />

      <Section tone="canvas">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
            <Image
              src={s.cover}
              alt=""
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              {detail.headline}
            </h2>
            <ul className="mt-7 space-y-4">
              {detail.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink-900/80">
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button href={SECONDARY_CTA.href} showArrow>
                {SECONDARY_CTA.label}
              </Button>
              <Button href={PRIMARY_CTA.href} variant="secondary" tone="light">
                {PRIMARY_CTA.label}
              </Button>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="white">
        <Reveal className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
            Relevant categories
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {categories.map((cat) => (
            <Reveal key={cat.slug}>
              <Link href={`/products/${cat.slug}`} className="group block rounded-2xl bg-canvas p-6">
                <p className="font-display font-semibold text-ink-900 group-hover:text-orange">{cat.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{cat.blurb}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
