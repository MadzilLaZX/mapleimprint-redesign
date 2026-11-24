"use client";

import { useEffect, useRef } from "react";

function trapFocus(panel: HTMLDivElement | null, onCloseRef: { current: () => void }) {
  function focusableElements(): HTMLElement[] {
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }

  const previouslyFocused = document.activeElement as HTMLElement | null;
  (focusableElements()[0] ?? panel)?.focus();

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    const elements = focusableElements();
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Capture phase so this reliably wins over any unrelated page-level key handler.
  document.addEventListener("keydown", handleKeyDown, true);
  return () => {
    document.removeEventListener("keydown", handleKeyDown, true);
    previouslyFocused?.focus();
  };
}

/** Standard WAI-ARIA Dialog (Modal) keyboard/focus behavior, for every hand-rolled `fixed inset-0`
 *  overlay in this codebase that is itself a separately mounted/unmounted component (SizeGuidePanel,
 *  SurpriseMePanel, CropModal) -- there's no shared Dialog/Modal component, so each overlay wires
 *  this in directly rather than duplicating the same focus-trap/Escape/focus-return logic.
 *
 *  Returns a ref for the panel's CONTENT element (the white card, not the full-screen backdrop
 *  div) -- callers must also set `role="dialog"` `aria-modal="true"` and `tabIndex={-1}` on that
 *  same element, and `aria-labelledby` pointing at the panel's own heading id.
 *
 *  On mount: focus moves to the panel's first focusable descendant (or the panel itself as a
 *  fallback, via the required tabIndex={-1}). Escape calls onClose. Tab/Shift+Tab are trapped
 *  within the panel. On unmount: focus returns to whatever had it before the panel opened. */
export function useModalA11y(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Ref writes belong in an effect, not render (react-hooks/refs) -- no deps array, so this runs
  // after every render and always carries the latest onClose into the keydown handler below,
  // without needing to re-run trapFocus's own mount/unmount effect on every onClose change.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => trapFocus(panelRef.current, onCloseRef), []);

  return panelRef;
}

/** Same behavior as useModalA11y, for a modal that is JSX conditionally rendered INSIDE an
 *  always-mounted parent (e.g. StudioClient's QR review/shared-edit modals) rather than a
 *  separately mounted component -- `useModalA11y`'s mount-once effect would only ever run once
 *  for the parent's whole lifetime, never re-arming when the modal reopens. This variant re-runs
 *  setup/teardown every time `isOpen` toggles instead. Must still be called unconditionally (every
 *  render, not inside an `if`/`&&`) per the rules of hooks -- only the internal effect is
 *  conditional on `isOpen`. */
export function useModalA11yWhen(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    return trapFocus(panelRef.current, onCloseRef);
  }, [isOpen]);

  return panelRef;
}
