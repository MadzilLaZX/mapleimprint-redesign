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

type Shot = { key: string; src: string; h: number };

// CSS multi-column layout balances by cumulative height, not by source order,
// so the masonry is built as three explicit column stacks instead of one flat
// list — that's the only reliable way to control exactly which photo lands
// in which column.
const columns: Shot[][] = [
  [
    { key: "fabric-stack", src: "/images/our-work/fabric-stack.jpg", h: 467 },
    { key: "catalogue-laser-spread", src: "/images/our-work/catalogue-laser-spread.jpg", h: 467 },
    { key: "hoodie-flatlay", src: "/images/our-work/hoodie-flatlay.jpg", h: 467 },
    { key: "laser-engraving-action", src: "/images/our-work/laser-engraving-action.jpg", h: 373 },
  ],
  [
    { key: "premium-metal-card", src: "/images/our-work/premium-metal-card.jpg", h: 467 },
    { key: "cutting-board-trophy", src: "/images/our-work/cutting-board-trophy.jpg", h: 467 },
    { key: "mug-plaque-array", src: "/images/our-work/mug-plaque-array.jpg", h: 467 },
    { key: "printer-apparel-catalogue", src: "/images/our-work/printer-apparel-catalogue.jpg", h: 373 },
  ],
  [
    { key: "embroidery-thread", src: "/images/our-work/embroidery-thread.jpg", h: 467 },
    { key: "tumbler-cap-box", src: "/images/our-work/tumbler-cap-box.jpg", h: 467 },
    { key: "bottle-notebook-pen", src: "/images/our-work/bottle-notebook-pen.jpg", h: 467 },
    { key: "hoodie-tote-cap-mug", src: "/images/our-work/hoodie-tote-cap-mug.jpg", h: 467 },
  ],
];

export default function OurWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Materials, methods and finishing"
        description="A closer look at the products, materials and finishing behind every order. Real client project galleries and verified reviews will join this page as jobs are completed and approved for use."
      />

      <Section tone="canvas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-4">
              {column.map((shot, i) => (
                <Reveal key={shot.key} delay={(i % 4) * 0.04 + colIndex * 0.02}>
                  <div className="overflow-hidden rounded-3xl">
                    <Image
                      src={shot.src}
                      alt=""
                      width={700}
                      height={shot.h}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="h-auto w-full object-cover"
                    />
                  </div>
                </Reveal>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <FinalCTA />
    </>
  );
}
