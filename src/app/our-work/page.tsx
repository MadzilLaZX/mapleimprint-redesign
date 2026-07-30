import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { FinalCTA } from "@/components/home/FinalCTA";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Our Work",
  description: "A look at the materials, methods and finishing behind Maple Imprint orders.",
};

type Shot = { key: string; src: string; h: number; realPhoto?: boolean };

// CSS multi-column layout balances by height, not by source order, so the
// masonry is built as three explicit column stacks instead of one flat list
// — that's the only way to guarantee the two real photos land top-left and
// top-right rather than wherever the browser's balancing algorithm puts them.
const columns: Shot[][] = [
  [
    { key: "fabric-stack", src: "/images/our-work/fabric-stack.jpg", h: 467, realPhoto: true },
    { key: "craft-2", src: "https://picsum.photos/seed/craft-2/700/320", h: 320 },
    { key: "craft-3", src: "https://picsum.photos/seed/craft-3/700/340", h: 340 },
    { key: "ink-drop", src: "https://picsum.photos/seed/ink-drop/700/340", h: 340 },
  ],
  [
    { key: "weave-2", src: "https://picsum.photos/seed/weave-2/700/340", h: 340 },
    { key: "material-3", src: "https://picsum.photos/seed/material-3/700/420", h: 420 },
    { key: "material-5", src: "https://picsum.photos/seed/material-5/700/460", h: 460 },
    { key: "fabric-macro", src: "https://picsum.photos/seed/fabric-macro/700/420", h: 420 },
  ],
  [
    { key: "embroidery-thread", src: "/images/our-work/embroidery-thread.jpg", h: 467, realPhoto: true },
    { key: "screen-1", src: "https://picsum.photos/seed/screen-1/700/480", h: 480 },
    { key: "weave-3", src: "https://picsum.photos/seed/weave-3/700/380", h: 380 },
    { key: "vinyl-1", src: "https://picsum.photos/seed/vinyl-1/700/400", h: 400 },
  ],
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
                      className={cn("h-auto w-full object-cover", !shot.realPhoto && "img-brand")}
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
