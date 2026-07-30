import { cn } from "@/lib/cn";

export function Container({
  className,
  children,
  wide = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** Use a wider cap for chrome (like the header) that needs more room than content sections. */
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full px-6 lg:px-8", wide ? "max-w-[1680px]" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}
