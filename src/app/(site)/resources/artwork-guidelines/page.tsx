import type { Metadata } from "next";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "Artwork Guidelines",
  description: "File formats, resolution, transparency and safe print area guidance for Maple Imprint orders.",
};

const goodPractices = [
  "Vector files (AI, EPS, PDF, SVG) for logos and line art",
  "300 DPI or higher at final print size for raster images",
  "Transparent background (PNG) when the design isn't a full rectangle",
  "Text converted to outlines or embedded fonts",
];

const commonIssues = [
  "Low-resolution images stretched beyond their native size",
  "Thin lines or small text that won't hold up in print or stitching",
  "Colour modes set to RGB when a print method needs CMYK",
  "Artwork placed outside the safe print area for the product",
];

export default function ArtworkGuidelinesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Artwork Guidelines"
        description="What we need from your file to keep your order moving without delays."
      />

      <Section tone="canvas">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              What works best
            </h2>
            <ul className="mt-6 space-y-4">
              {goodPractices.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink-900/80">
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              What we&apos;ll flag before checkout
            </h2>
            <ul className="mt-6 space-y-4">
              {commonIssues.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ink-900/80">
                  <WarningCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <Section tone="white">
        <Container className="max-w-2xl">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              Not sure if your file is ready?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Upload it in the design studio or attach it to a quote request. We&apos;ll tell you exactly what needs fixing, and offer paid or included cleanup depending on the job, before anything goes to production.
            </p>
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
