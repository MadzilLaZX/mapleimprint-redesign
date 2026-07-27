import type { Metadata } from "next";
import { Clock, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { ContactTabs } from "@/components/contact/ContactTabs";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get a project quote or send a general question to Maple Imprint in Ottawa.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialTab = params.type === "general" ? "general" : "quote";

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Start a quote, or just ask a question"
        description="Business and bulk projects get a guided quote form below. For anything else, switch to general inquiry."
      />

      <Section tone="canvas">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Location</p>
                  <p className="mt-1 text-sm text-muted">Ottawa, Ontario, Canada</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Phone</p>
                  <a href="tel:+16135550142" className="mt-1 block text-sm text-muted hover:text-ink-900">
                    (613) 555-0142
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <EnvelopeSimple className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Email</p>
                  <a href="mailto:hello@mapleimprint.ca" className="mt-1 block text-sm text-muted hover:text-ink-900">
                    hello@mapleimprint.ca
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Hours</p>
                  <p className="mt-1 text-sm text-muted">Monday to Friday, 9am to 5pm</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ContactTabs initialTab={initialTab} />
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
