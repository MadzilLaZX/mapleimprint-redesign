/** `fetch()` rejects with a `TypeError` specifically when the request never reaches a server at
 *  all (offline, DNS failure, connection refused) -- its message is a raw, technical string
 *  ("Failed to fetch" in Chrome, "NetworkError when attempting to fetch resource." in Firefox,
 *  "Load failed" in Safari) that means nothing to a customer who just lost their connection.
 *  Every deliberate error this codebase throws (`throw new Error("Enter a valid email address.")`,
 *  server-provided `json.error` strings, etc.) is a plain `Error`, never a `TypeError`, so this
 *  never swallows a real, customer-relevant message -- only the browser's own raw network-failure
 *  text, found live during UAT (QuoteWizard showed "Failed to fetch" verbatim when offline). */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "Couldn't reach the server. Check your internet connection and try again.";
  }
  return err instanceof Error ? err.message : fallback;
}
