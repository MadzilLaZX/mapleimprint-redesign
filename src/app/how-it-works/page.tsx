import type { Metadata } from "next";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/lib/constants";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How ordering works at Maple Imprint: instant customization for standard products, and a guided quote and proof workflow for bulk and business orders.",
};

const instantSteps = [
  {
    title: "Choose product, colour and size",
    detail: "Filter by category, use case or decoration method. Every card shows what's included before you click in.",
  },
  {
    title: "Customize or upload your artwork",
    detail: "Use the design studio or upload a print-ready file. We flag resolution or transparency issues immediately.",
  },
  {
    title: "Review your total and ETA",
    detail: "See an itemized price and an estimated production and delivery window before you add to cart.",
  },
  {
    title: "Checkout as a guest",
    detail: "No account required. Choose Ottawa pickup or shipping, and get a confirmation with next steps.",
  },
];

const quoteSteps = [
  {
    title: "Describe the project",
    detail: "Tell us the product type, approximate quantity and any budget range. Unsure? Choose \"mixed project\" or \"not sure yet.\"",
  },
  {
    title: "Upload files or request design help",
    detail: "Attach artwork and reference images. If you don't have final art yet, flag it and we'll follow up.",
  },
  {
    title: "Approve a scoped quote and proof",
    detail: "We confirm pricing, timeline and a digital proof. Nothing goes to production until you approve it.",
  },
  {
    title: "Pay and track production",
    detail: "Pay a deposit or invoice in full, then track status from approved through to ready for pickup or shipped.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Two workflows, so simple stays simple"
        description="Instant orders move fast because the product and pricing are predictable. Bulk and business orders get a real project workflow, including a proof you approve before anything prints."
      />

      <Section tone="canvas">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-crimson">Path one</span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
            Customize and buy
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {instantSteps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.05}>
              <span className="font-display text-4xl font-semibold text-orange/25">{i + 1}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.detail}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <Button href={PRIMARY_CTA.href} className="mt-10" showArrow>
            {PRIMARY_CTA.label}
          </Button>
        </Reveal>
      </Section>

      <Section tone="ink">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">Path two</span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-white md:text-4xl">
            Plan a bulk or business order
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {quoteSteps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.05}>
              <span className="font-display text-4xl font-semibold text-white/15">{i + 1}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{step.detail}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <Button href={SECONDARY_CTA.href} tone="dark" className="mt-10" showArrow>
            {SECONDARY_CTA.label}
          </Button>
        </Reveal>
      </Section>

      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              What stays the same either way
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "You see a digital proof before production starts",
                "Pricing states exactly what it includes",
                "You get a real production and delivery estimate",
                "A person, not just a ticket queue, is behind every order",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink-900/80">
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              If something goes wrong
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              If the design studio can&apos;t handle your file, or a product configuration fails, your work is saved automatically. You can switch to uploading artwork directly or request a quote, and reach a real person without losing what you&apos;ve already built.
            </p>
          </Reveal>
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
