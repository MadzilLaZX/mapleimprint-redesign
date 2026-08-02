import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { PRODUCT_CATEGORIES, PRINT_METHODS, SECONDARY_CTA } from "@/lib/constants";
import { slugify } from "@/lib/slugify";

const methodsByCategory: Record<string, string[]> = {
  "custom-apparel": ["screen-printing", "embroidery", "dtf-dtg"],
  "workwear-uniforms": ["embroidery", "screen-printing"],
  "hats-accessories": ["embroidery", "dtf-dtg"],
  "business-printing": ["large-format"],
  "signs-banners": ["large-format"],
  "stickers-labels": ["large-format", "dtf-dtg"],
  drinkware: ["sublimation"],
  "gifts-promo": ["sublimation", "large-format"],
};

export function generateStaticParams() {
  return PRODUCT_CATEGORIES.map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = PRODUCT_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: cat.name,
    description: `${cat.blurb} Instant customization for standard runs, guided quotes for bulk and business orders.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = PRODUCT_CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const methods = (methodsByCategory[cat.slug] ?? []).map((slug) =>
    PRINT_METHODS.find((m) => m.slug === slug),
  ).filter(Boolean);

  const faqItems = [
    {
      question: `Is there a minimum quantity for ${cat.name.toLowerCase()}?`,
      answer:
        "Most items in this category have no minimum for instant orders. Bulk pricing tiers apply automatically as quantity increases, and any method-specific minimum is shown before checkout.",
    },
    {
      question: "How is this category priced?",
      answer:
        "Each product page states exactly what the base price includes and what changes it, such as decoration method, print locations or rush timing. If accurate live pricing isn't possible for a configuration, we mark it quote required instead of guessing.",
    },
    {
      question: "What if I need this for a larger group or event?",
      answer:
        "Use the quote flow to describe quantities, sizing and a deadline. You'll get a scoped quote and a single proof to approve before production.",
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Products" title={cat.name} description={cat.blurb} />

      <div className="bg-canvas pt-10 md:pt-14">
        <Container>
          <Reveal className="relative aspect-[21/9] w-full overflow-hidden rounded-[28px]">
            <Image src={cat.cover} alt="" fill sizes="100vw" priority className="object-cover" />
          </Reveal>
        </Container>
      </div>

      <Section tone="canvas">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
            Browse by subcategory
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cat.subcategories.map((sub, i) => (
            <Reveal key={sub} delay={i * 0.04}>
              <div className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl">
                <Image
                  src={`/images/products/subcategories/${cat.slug}/${slugify(sub)}.jpg`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent" />
                <p className="relative p-3 text-sm font-semibold text-white">{sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {methods.length > 0 && (
        <Section tone="white">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              Decoration methods for this category
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Available at checkout, with pricing and turnaround shown per method.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {methods.map((method) => (
              <Reveal key={method!.slug}>
                <Link
                  href={`/print-methods#${method!.slug}`}
                  className="group flex items-start gap-3 rounded-2xl bg-canvas p-5"
                >
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-crimson" weight="fill" />
                  <div>
                    <p className="font-display font-semibold text-ink-900">{method!.name}</p>
                    <p className="mt-1 text-sm leading-snug text-muted">{method!.blurb}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <Section tone="ink">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-white md:text-3xl">
              Ordering {cat.name.toLowerCase()} for a team or event?
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65">
              Send us quantities, sizing and a deadline. We&apos;ll scope a quote and hold one proof approval across the whole run.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Button href={SECONDARY_CTA.href} tone="dark" showArrow>
              {SECONDARY_CTA.label}
            </Button>
          </Reveal>
        </div>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
              {cat.name} FAQ
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-6">
            <Accordion items={faqItems} tone="light" />
          </Reveal>
        </Container>
      </Section>

      <FinalCTA />
    </>
  );
}
