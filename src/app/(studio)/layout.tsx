/** Studio's dedicated application shell. `/studio/[id]/page.tsx` already sets its own
 *  noindex metadata, so this layout doesn't duplicate it. Deliberately does NOT render Header/Footer/PageTransition
 *  — this is a separate route group from (site), so that marketing chrome is never part of this
 *  route's layout tree at all (not hidden with CSS, not conditionally skipped at render time).
 *  `h-dvh` (not `h-screen`/`100vh`) so mobile browser chrome showing/hiding the address bar can't
 *  push the bottom tool tray off-screen or create a phantom scrollbar. `overflow-hidden` here is
 *  the outermost guarantee that the page itself never scrolls — StudioClient is responsible for
 *  making sure nothing inside this box needs more than the space it's given; only its own internal
 *  panels (secondary tool panel, right inspector) get their own `overflow-y-auto`. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh w-full overflow-hidden bg-canvas">{children}</div>;
}
