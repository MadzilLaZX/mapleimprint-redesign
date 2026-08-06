import Link from "next/link";
import { ArrowRight, Drop, Printer, StackSimple, Target } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { PRINT_METHODS } from "@/lib/constants";

const icons = {
  "dtf-dtg": Drop,
  sublimation: StackSimple,
  "large-format": Printer,
  "laser-engraving": Target,
};

export function PrintMethodsPreview() {
  return (
    <section className="bg-white py-20 md:py-28 lg:py-32">
      <Container>
        <Reveal className="max-w-xl">
          <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
            Four ways we decorate
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Every product page lists which methods it supports and why one might suit your job better than another.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {PRINT_METHODS.map((method) => {
            const Icon = icons[method.slug as keyof typeof icons];
            return (
              <RevealItem key={method.slug}>
                <Link href={`/print-methods#${method.slug}`} className="group block">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-canvas">
                    <Icon className="size-6 text-crimson" weight="duotone" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-ink-900">
                    {method.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{method.blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange opacity-0 transition-opacity group-hover:opacity-100">
                    Learn more <ArrowRight className="size-3.5" weight="bold" />
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </Container>
    </section>
  );
}
