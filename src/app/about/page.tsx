import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "About",
  description: "Maple Imprint is an Ottawa custom printing company built around clear pricing, real proofs and honest turnaround.",
};

const commitments = [
  {
    title: "State the price and what it includes",
    detail: "Every product says exactly what's covered by the base price and what changes it. If we can't calculate it accurately, we say so instead of guessing.",
  },
  {
    title: "Approve before we produce",
    detail: "Nothing goes to print or stitch until you've seen and approved a digital proof.",
  },
  {
    title: "Keep Ottawa production local",
    detail: "Work is made and finished locally, with pickup available alongside shipping.",
  },
  {
    title: "Answer with a real person",
    detail: "Quotes and support questions go to staff who can actually change an order, not a scripted queue.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="An Ottawa print shop built around clarity"
        description="Maple Imprint exists to make a genuinely complicated purchase, custom printing, feel simple, honest and controlled from the first click to delivery."
      />

      <Section tone="canvas">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
            <Image
              src="/images/about.jpg"
              alt="Maple Imprint branded apparel, drinkware and print materials in the shop"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              Why we split the catalogue into two paths
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              A single T-shirt and a 200-piece uniform order aren&apos;t the same job. Forcing both through one checkout either overcomplicates the simple order or under-serves the complex one. So we built two: an instant path for predictable products, and a guided quote and proof workflow for anything bigger, mixed or time-sensitive.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Both paths share the same rule: you see a proof and a real price before you commit to production.
            </p>
          </Reveal>
        </div>
      </Section>

      <Section tone="white">
        <Reveal className="max-w-xl">
          <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
            What we hold ourselves to
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {commitments.map((item) => (
            <Reveal key={item.title}>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                <div>
                  <h3 className="font-display font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="ink">
        <Container className="max-w-2xl text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-white md:text-3xl">
              Based in Ottawa, working with the whole region
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              From single custom pieces to multi-location corporate programs, our production runs out of Ottawa with pickup available on site alongside shipping across Canada.
            </p>
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
