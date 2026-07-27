import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonTone = "light" | "dark";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold tracking-tight transition-transform duration-200 ease-[var(--ease-premium)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

const variants: Record<ButtonVariant, Record<ButtonTone, string>> = {
  primary: {
    light:
      "bg-maple-gradient text-ink-950 shadow-[0_14px_40px_-16px_rgba(255,106,0,0.65)] hover:shadow-[0_18px_48px_-14px_rgba(255,106,0,0.75)]",
    dark: "bg-maple-gradient text-ink-950 shadow-[0_14px_40px_-16px_rgba(255,106,0,0.55)] hover:shadow-[0_18px_48px_-14px_rgba(255,106,0,0.7)]",
  },
  secondary: {
    light:
      "border border-ink-950/15 text-ink-900 hover:bg-ink-950/5",
    dark: "border border-white/25 text-white hover:bg-white/10",
  },
  ghost: {
    light: "text-ink-900 hover:text-orange px-2 py-1",
    dark: "text-white hover:text-gold px-2 py-1",
  },
};

export function Button({
  href,
  children,
  variant = "primary",
  tone = "light",
  className,
  showArrow = false,
  type,
  onClick,
  disabled = false,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  className?: string;
  showArrow?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const classes = cn(base, variants[variant][tone], disabled && "cursor-not-allowed opacity-50", className);
  const content = (
    <>
      {children}
      {showArrow && <ArrowRight className="size-4" weight="bold" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick} aria-disabled={disabled}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type ?? "button"} className={classes} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
