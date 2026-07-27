import { Container } from "@/components/ui/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { HOME_FAQ } from "@/lib/faq";

export function FAQPreview() {
  return (
    <section id="faq" className="bg-canvas py-20 md:py-28 lg:py-32">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
            Common questions
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
            The answers customers ask for most before their first order.
          </p>
          <Button href="/resources#faq" variant="secondary" tone="light" className="mt-8" showArrow>
            Read the full FAQ
          </Button>
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion items={[...HOME_FAQ]} tone="light" />
        </Reveal>
      </Container>
    </section>
  );
}
