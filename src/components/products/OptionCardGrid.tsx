"use client";

import { cn } from "@/lib/cn";

export interface OptionCardGridItem {
  value: string;
  label: string;
  sublabel?: string;
  /** Pre-formatted, e.g. "+$18.00" or "From $6.99" — callers decide the framing. */
  priceDelta?: string;
  disabled?: boolean;
  /** Shown on a disabled card instead of the price, e.g. "Incompatible" — mirrors VistaPrint's
   *  pattern of showing every option and explaining why it can't be picked right now, rather than
   *  silently removing it from the list. */
  disabledReason?: string;
}

/** A clickable grid of option cards — used for banner Size/Material and card/flyer Stock. Shared
 *  because all three are the same shape (a set of mutually-exclusive named choices, some carrying
 *  a price, some gated by other selections) rather than three near-identical `<select>` replacements. */
export function OptionCardGrid({
  options,
  selected,
  onSelect,
}: {
  options: OptionCardGridItem[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onSelect(option.value)}
            title={option.disabled ? option.disabledReason : undefined}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              isSelected
                ? "border-transparent bg-ink-950 text-white"
                : "border-sand bg-white text-ink-900/80 hover:border-ink-950/25",
            )}
          >
            <span className="block font-medium">{option.label}</span>
            {option.sublabel && (
              <span className={cn("block text-xs", isSelected ? "text-white/70" : "text-ink-900/50")}>
                {option.sublabel}
              </span>
            )}
            {option.disabled && option.disabledReason ? (
              <span className="mt-0.5 block text-xs text-ink-900/50">{option.disabledReason}</span>
            ) : option.priceDelta ? (
              <span className={cn("mt-0.5 block text-xs", isSelected ? "text-white/70" : "text-ink-900/50")}>
                {option.priceDelta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
