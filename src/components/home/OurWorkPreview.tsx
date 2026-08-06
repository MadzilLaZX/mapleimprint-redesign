import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

const shots = [
  { key: "laser-engraving-action", src: "/images/our-work/laser-engraving-action.jpg", h: 420 },
  { key: "fabric-stack", src: "/images/our-work/fabric-stack.jpg", h: 320 },
  { key: "embroidery-thread", src: "/images/our-work/embroidery-thread.jpg", h: 360 },
  { key: "dtf-dtg-printing", src: "/images/our-work/dtf-dtg-printing.jpg", h: 440 },
  { key: "sublimation-process", src: "/images/our-work/sublimation-process.jpg", h: 300 },
  { key: "premium-metal-card", src: "/images/our-work/premium-metal-card.jpg", h: 380 },
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
              <div key={shot.key} className="relative mb-4 break-inside-avoid overflow-hidden rounded-3xl">
                <Image
                  src={shot.src}
                  alt=""
                  width={700}
                  height={shot.h}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="h-auto w-full object-cover"
                />
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
