import type { Metadata } from "next";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRINT_METHODS } from "@/lib/constants";
import { PRINT_METHOD_DETAILS } from "@/lib/printMethodDetails";

export const metadata: Metadata = {
  title: "Print Methods",
  description:
    "DTF and DTG, sublimation, large format printing and laser engraving explained in plain language, with guidance on which method suits which job.",
};

export default function PrintMethodsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Print methods"
        title="Four ways we decorate, explained honestly"
        description="Every product page states which methods it supports. This page explains why one might suit your job better than another."
      />

      {PRINT_METHODS.map((method, i) => {
        const detail = PRINT_METHOD_DETAILS[method.slug];
        return (
          <Section key={method.slug} id={method.slug} tone={i % 2 === 0 ? "canvas" : "white"}>
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <Reveal>
                <h2 className="font-display text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
                  {method.name}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted">{method.blurb}</p>
                <p className="mt-6 text-sm font-semibold text-ink-900">Best for</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{detail.bestFor}</p>
              </Reveal>
              <Reveal delay={0.1}>
                <ul className="space-y-4">
                  {detail.considerations.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-ink-900/80">
                      <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                      {point}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </Section>
        );
      })}

      <FinalCTA />
    </>
  );
}
