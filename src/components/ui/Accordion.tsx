"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export type AccordionEntry = {
  question: string;
  answer: string;
};

export function Accordion({
  items,
  tone = "light",
  className,
}: {
  items: AccordionEntry[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const borderColor = tone === "dark" ? "border-white/10" : "border-sand";
  const textColor = tone === "dark" ? "text-white" : "text-ink-900";
  const mutedColor = tone === "dark" ? "text-white/60" : "text-muted";

  return (
    <div className={cn("divide-y", borderColor, className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className={cn("border-t first:border-t-0", borderColor)}>
            <h3>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full items-center justify-between gap-4 py-5 text-left font-display text-base font-semibold",
                  textColor,
                )}
              >
                {item.question}
                <CaretDown
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-300",
                    isOpen && "rotate-180",
                    tone === "dark" ? "text-white/60" : "text-muted",
                  )}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className={cn("max-w-2xl pb-5 text-sm leading-relaxed", mutedColor)}>
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
