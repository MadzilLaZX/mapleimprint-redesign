import { Section } from "@/components/ui/Section";

export default function ShopLoading() {
  return (
    <>
      <div className="animate-pulse bg-ink-950 pt-16 pb-14 lg:pt-20 lg:pb-16">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
          <div className="h-3 w-16 rounded bg-white/10" />
          <div className="mt-4 h-10 w-64 rounded bg-white/10" />
        </div>
      </div>
      <Section tone="canvas">
        <div className="flex animate-pulse flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-28 rounded-full bg-sand" />
          ))}
        </div>
        <div className="mt-4 grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-white">
              <div className="aspect-[4/5] w-full bg-sand" />
              <div className="space-y-2 p-4">
                <div className="h-2.5 w-16 rounded bg-sand" />
                <div className="h-4 w-full rounded bg-sand" />
                <div className="h-4 w-2/3 rounded bg-sand" />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
