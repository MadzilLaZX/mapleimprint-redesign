"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
const DURATION = 0.24;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const [displayed, setDisplayed] = useState(children);
  const [displayedPath, setDisplayedPath] = useState(pathname);
  const [phase, setPhase] = useState<"idle" | "exiting">("idle");

  // Derived-state-from-props pattern (adjust during render, not in an effect):
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (pathname !== displayedPath && phase === "idle") {
    if (reduce) {
      setDisplayed(children);
      setDisplayedPath(pathname);
    } else {
      setPhase("exiting");
    }
  }

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={phase === "exiting" ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
      transition={{ duration: DURATION, ease: EASE }}
      onAnimationComplete={() => {
        if (phase === "exiting") {
          setDisplayed(children);
          setDisplayedPath(pathname);
          setPhase("idle");
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
          }
        }
      }}
    >
      {displayed}
    </motion.div>
  );
}
