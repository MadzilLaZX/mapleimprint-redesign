"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

/** Collapsible panel beside the tool rail (Section 1/2). Fixed width on desktop so the canvas never
 *  gets crushed; a full-height overlay on mobile so it doesn't fight the canvas for space. */
export function SecondaryPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      <motion.div
        key="secondary-panel"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        // Bottom sheet above the fixed tool rail on mobile (Section 28); a normal static side
        // panel next to the rail at lg+.
        className="fixed inset-x-0 bottom-14 z-20 flex max-h-[55vh] w-full flex-col rounded-t-3xl border border-sand bg-white shadow-2xl lg:static lg:z-auto lg:h-auto lg:max-h-none lg:w-72 lg:rounded-none lg:border-b-0 lg:border-l-0 lg:border-t-0 lg:shadow-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sand px-4 py-3">
          <p className="font-display text-sm font-semibold text-ink-900">{title}</p>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-900/60 transition-colors hover:bg-canvas hover:text-ink-900"
          >
            <X className="size-4" weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </AnimatePresence>
  );
}
