import { Container } from "@/components/ui/Container";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="bg-ink-950 pt-16 pb-14 text-white lg:pt-20 lg:pb-16">
      <Container>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">{eyebrow}</p>
        )}
        <h1 className={`max-w-2xl font-display text-4xl font-medium tracking-tight md:text-5xl ${eyebrow ? "mt-3" : ""}`}>
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65">{description}</p>
        )}
      </Container>
    </section>
  );
}
