// Server-side validation for POST /api/quote -- the wizard (QuoteWizard.tsx) already checks these
// client-side, but that route itself had no equivalent server-side checks beyond "name and email
// are non-empty strings" before this file existed. Extracted as pure, directly testable functions
// rather than left as inline route logic, matching this codebase's convention for every other
// checkout-boundary validator (validatePostalCode, resolvePackaging, etc.).

/** Same pattern QuoteWizard.tsx's own client-side check already uses -- re-checked server-side so
 *  a direct/malformed POST can't write an unreachable email straight into QuoteRequest.contactEmail. */
export function isValidQuoteEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

/** The real UI (CartProvider.updateQuantity) always clamps to a positive integer before a
 *  quantity ever reaches this API -- this exists only to stop a direct/malformed POST from
 *  writing a zero/negative/non-integer quantity into QuoteRequestLine. Returns null (never a
 *  clearly-wrong number) for anything that isn't a real positive integer, including the
 *  already-valid case of "not provided at all" (undefined). */
export function safeQuoteLineQuantity(quantity: unknown): number | null {
  return typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}
