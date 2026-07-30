import Image from "next/image";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

const points = [
  "One account for recurring uniform and merchandise orders",
  "Volume pricing with unit and total shown together",
  "A dedicated contact instead of a support queue",
  "Invoice-ready paperwork for procurement and finance",
];

export function BusinessSolutions() {
  return (
    <section className="bg-ink-950 py-20 text-white md:py-28 lg:py-32">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative order-2 aspect-[4/3] overflow-hidden rounded-[28px] lg:order-1">
            <Image
              src="/images/solutions/business-solutions.jpg"
              alt="Maple Imprint branded apparel, drinkware and print materials laid out in the shop"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </Reveal>

          <Reveal delay={0.1} className="order-1 lg:order-2">
            <h2 className="max-w-md text-3xl font-medium tracking-tight md:text-4xl">
              Built for the businesses that order more than once
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/65">
              Uniforms, signage and promotional merchandise for teams that need consistency, not a one-off order.
            </p>
            <ul className="mt-8 space-y-4">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-white/80">
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-orange" weight="fill" />
                  {point}
                </li>
              ))}
            </ul>
            <Button href="/solutions/businesses" tone="dark" className="mt-9" showArrow>
              Explore business solutions
            </Button>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
