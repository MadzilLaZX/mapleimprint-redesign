import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "Turnaround & Delivery",
  description: "What affects production time at Maple Imprint, and how rush and pickup options work.",
};

const factors = [
  {
    title: "Decoration method",
    detail: "Embroidery and multi-colour screen printing generally take longer to set up than DTF, DTG or sublimation.",
  },
  {
    title: "Quantity",
    detail: "Larger runs take longer to produce but often benefit from more efficient per-unit setup.",
  },
  {
    title: "Proof approval time",
    detail: "Production starts only after you approve a proof, so response time affects your overall timeline.",
  },
  {
    title: "Rush requests",
    detail: "Rush production is available on many products, shown with any cut-off time and additional fee at checkout.",
  },
];

export default function TurnaroundDeliveryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Turnaround & Delivery"
        description="A realistic view of what affects your timeline, shown again with real dates at checkout."
      />

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <div className="grid gap-8 sm:grid-cols-2">
            {factors.map((factor) => (
              <Reveal key={factor.title}>
                <h2 className="font-display text-lg font-semibold text-ink-900">{factor.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{factor.detail}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.15} className="mt-10 rounded-2xl bg-white p-6">
            <p className="text-sm leading-relaxed text-muted">
              Every product and quote shows an estimated production window plus your chosen delivery method, Ottawa pickup or shipping, before you pay. Estimates are confirmed, not implied, once your order or quote is placed.
            </p>
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
