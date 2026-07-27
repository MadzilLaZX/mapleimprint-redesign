import { cn } from "@/lib/cn";

type Tone = "canvas" | "white" | "ink";

const toneClasses: Record<Tone, string> = {
  canvas: "bg-canvas text-ink-900",
  white: "bg-white text-ink-900",
  ink: "bg-ink-950 text-white",
};

export function Section({
  id,
  tone = "canvas",
  className,
  containerClassName,
  children,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("py-20 md:py-28 lg:py-32", toneClasses[tone], className)}>
      <div className={cn("mx-auto w-full max-w-7xl px-6 lg:px-8", containerClassName)}>
        {children}
      </div>
    </section>
  );
}
