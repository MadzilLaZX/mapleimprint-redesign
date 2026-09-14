// One shared motion vocabulary, reused everywhere instead of each component picking its own
// duration/ease — this is what section 20/21 of the "post-approval transition" brief asks for.
// The ease is the SAME curve already used throughout the app (PageTransition.tsx, ProductCard,
// ProductGallery's `--ease-premium` CSS variable) rather than a second, nearly-identical curve —
// visually equivalent to the brief's suggested cubic-bezier(0.22,1,0.36,1), and "reuse what's
// already in the project" is the explicit instruction when an equivalent exists.
export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

/** Seconds, not ms — Framer Motion's `transition.duration` takes seconds. Ranges from the brief:
 *  micro interactions 120-180ms, button/control state 150-220ms, panels/drawers 180-260ms, route
 *  content 200-300ms, major mode transitions 220-320ms. */
export const DURATION = {
  micro: 0.15,
  control: 0.18,
  panel: 0.22,
  route: 0.25,
  mode: 0.28,
} as const;
