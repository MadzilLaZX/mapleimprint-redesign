import type { Metadata } from "next";
import { Clock, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { ContactTabs, type ContactTab } from "@/components/contact/ContactTabs";
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get a project quote, book an appointment, find our Ottawa location, or send a general question to Maple Imprint.",
};

const TAB_PARAMS: ContactTab[] = ["quote", "general", "location", "appointment"];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const requested = typeof params.type === "string" ? params.type : "";
  const initialTab: ContactTab = TAB_PARAMS.includes(requested as ContactTab)
    ? (requested as ContactTab)
    : "quote";

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Start a quote, or just ask a question"
        description="Business and bulk projects get a guided quote form below. Find our location, book an appointment, or switch to general inquiry."
      />

      <Section tone="canvas">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Location</p>
                  <p className="mt-1 text-sm text-muted">
                    {BUSINESS.addressLine1}, {BUSINESS_ADDRESS_ONE_LINE}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Phone</p>
                  <a href={BUSINESS.phoneHref} className="mt-1 block text-sm text-muted hover:text-ink-900">
                    {BUSINESS.phoneDisplay}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <EnvelopeSimple className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Email</p>
                  <a href={`mailto:${BUSINESS.email}`} className="mt-1 block text-sm text-muted hover:text-ink-900">
                    {BUSINESS.email}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-crimson" />
                <div>
                  <p className="font-display font-semibold text-ink-900">Hours</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">
                    {BUSINESS.hours.map((h) => (
                      <li key={h.days}>
                        {h.days}: {h.time}
                      </li>
                    ))}
                  </ul>
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
