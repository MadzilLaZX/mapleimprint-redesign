import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "Sizing Guide",
  description: "How to measure and choose the right fit across the brands Maple Imprint carries.",
};

const tips = [
  {
    title: "Measure a garment you already own",
    detail: "Chest, length and sleeve measurements are more reliable than a size label, especially across different brands.",
  },
  {
    title: "Check the product page's size chart",
    detail: "Brands vary in fit. Each product links to its own measurements rather than a single generic chart.",
  },
  {
    title: "Sizing between two sizes",
    detail: "For team and group orders, we can note a preferred fit direction (closer or looser) as part of your quote.",
  },
  {
    title: "Youth and performance fits",
    detail: "Youth sizing and performance fabrics often run differently than standard adult cuts. Product pages flag this explicitly.",
  },
];

export default function SizingGuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Sizing Guide"
        description="A quick reference for choosing the right fit before you order, especially for teams and groups."
      />

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {tips.map((tip) => (
              <Reveal key={tip.title}>
                <h2 className="font-display text-lg font-semibold text-ink-900">{tip.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{tip.detail}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
