import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";

export const metadata: Metadata = {
  title: "Our Work",
  description: "A look at the materials, methods and finishing behind Maple Imprint orders.",
};

const shots = [
  { seed: "texture-a", h: 460 },
  { seed: "weave-2", h: 340 },
  { seed: "signage-1", h: 400 },
  { seed: "screen-1", h: 480 },
  { seed: "craft-2", h: 320 },
  { seed: "material-3", h: 420 },
  { seed: "weave-3", h: 380 },
  { seed: "craft-3", h: 340 },
  { seed: "material-5", h: 460 },
  { seed: "vinyl-1", h: 400 },
  { seed: "ink-drop", h: 340 },
  { seed: "fabric-macro", h: 420 },
];

export default function OurWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Materials, methods and finishing"
        description="Real client galleries, before/after artwork and verified reviews land here as orders are photographed and approved for use. For now, this page shows the craft behind the catalogue."
      />

      <Section tone="canvas">
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {shots.map((shot, i) => (
            <Reveal key={shot.seed} delay={(i % 6) * 0.04} className="mb-4 break-inside-avoid">
              <div className="overflow-hidden rounded-3xl">
                <Image
                  src={`https://picsum.photos/seed/${shot.seed}/700/${shot.h}`}
                  alt=""
                  width={700}
                  height={shot.h}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="img-brand h-auto w-full object-cover"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
