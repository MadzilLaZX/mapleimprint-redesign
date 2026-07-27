import { Container } from "@/components/ui/Container";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const steps = [
  {
    n: "01",
    title: "Choose",
    detail: "Pick a product, colour and quantity from the catalogue.",
  },
  {
    n: "02",
    title: "Customize",
    detail: "Upload your artwork or build it in the design studio.",
  },
  {
    n: "03",
    title: "Approve",
    detail: "Review a digital proof. Nothing prints without your sign-off.",
  },
  {
    n: "04",
    title: "Receive",
    detail: "Track production, then pick up in Ottawa or have it shipped.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-canvas py-20 md:py-28 lg:py-32">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
              How it works
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Button href="/how-it-works" variant="secondary" tone="light" showArrow>
              Full process
            </Button>
          </Reveal>
        </div>

        <RevealGroup className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step) => (
            <RevealItem key={step.n} className="relative">
              <span className="font-display text-5xl font-semibold text-orange/25 md:text-6xl">
                {step.n}
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink-900">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[26ch] text-sm leading-relaxed text-muted">
                {step.detail}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
