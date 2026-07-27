import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";

export function PolicyLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow="Policies" title={title} description={description} />
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <div className="flex items-start gap-3 rounded-2xl border border-crimson/20 bg-crimson/5 p-5">
            <WarningCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
            <p className="text-sm leading-relaxed text-ink-900/80">
              <span className="font-semibold text-ink-900">Draft, pending legal review.</span> This page outlines the
              intended structure and is not yet approved by Maple Imprint&apos;s legal advisor. It must be reviewed
              and finalized before the site launches.
            </p>
          </div>
          <div className="prose-policy mt-10 space-y-8">{children}</div>
        </Container>
      </Section>
    </>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}
