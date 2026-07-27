import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

const shots = [
  { seed: "texture-a", h: 420 },
  { seed: "weave-2", h: 320 },
  { seed: "signage-1", h: 360 },
  { seed: "screen-1", h: 440 },
  { seed: "craft-2", h: 300 },
  { seed: "material-3", h: 380 },
];

export function OurWorkPreview() {
  return (
    <section className="bg-canvas py-20 md:py-28 lg:py-32">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
              The materials behind every order
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              A closer look at the fabrics, finishes and small details that go into each piece.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Button href="/our-work" variant="secondary" tone="light" showArrow>
              View all work
            </Button>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="mt-12 columns-2 gap-4 lg:columns-3">
            {shots.map((shot) => (
              <div key={shot.seed} className="relative mb-4 break-inside-avoid overflow-hidden rounded-3xl">
                <Image
                  src={`https://picsum.photos/seed/${shot.seed}/700/${shot.h}`}
                  alt=""
                  width={700}
                  height={shot.h}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="img-brand h-auto w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-maple-gradient mix-blend-soft-light opacity-40" />
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
