import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { PRIMARY_CTA, SECONDARY_CTA } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-ink-950 py-24 text-white md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-maple-gradient opacity-15 blur-[160px]"
      />
      <Container className="relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Let&rsquo;s print your story.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/65">
            Start a single custom order today, or tell us about a bigger project and get a scoped quote.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button href={PRIMARY_CTA.href} tone="dark" showArrow>
              {PRIMARY_CTA.label}
            </Button>
            <Button href={SECONDARY_CTA.href} variant="secondary" tone="dark">
              {SECONDARY_CTA.label}
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
