import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Palette, Ruler, Scissors, Truck } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { FULL_FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Guides on artwork preparation, sizing, print methods, quantity planning and turnaround, plus answers to common questions.",
};

const guides = [
  {
    icon: Scissors,
    title: "Artwork Guidelines",
    detail: "File formats, resolution, transparency and safe print areas.",
    href: "/resources/artwork-guidelines",
  },
  {
    icon: Ruler,
    title: "Sizing Guide",
    detail: "How to measure and choose the right fit across brands.",
    href: "/resources/sizing-guide",
  },
  {
    icon: Palette,
    title: "Print Method Comparison",
    detail: "Screen printing, embroidery, DTF/DTG and sublimation, compared.",
    href: "/print-methods",
  },
  {
    icon: Truck,
    title: "Turnaround & Delivery",
    detail: "What affects production time, and how rush options work.",
    href: "/resources/turnaround-delivery",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Everything you need before you order"
        description="Practical guides on artwork, sizing and turnaround, plus the questions customers ask most."
      />

      <Section tone="canvas">
        <RevealGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <RevealItem key={guide.title}>
              <Link href={guide.href} className="group block h-full rounded-2xl bg-white p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-canvas">
                  <guide.icon className="size-5 text-crimson" weight="duotone" />
                </span>
                <h2 className="mt-4 font-display font-semibold text-ink-900">{guide.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{guide.detail}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange opacity-0 transition-opacity group-hover:opacity-100">
                  Read guide <ArrowRight className="size-3.5" weight="bold" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section id="faq" tone="white">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
              Frequently asked questions
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <Accordion items={[...FULL_FAQ]} tone="light" />
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
