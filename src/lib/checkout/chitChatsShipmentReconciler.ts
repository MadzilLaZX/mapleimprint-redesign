import type { ChitChatsShipmentReconciler } from "./chitChatsQuoteCoordinator.ts";
import type { ChitChatsPersistedQuoteKey } from "./chitChatsQuoteStore.ts";
import { chitChatsShipmentsUrl, chitChatsRequestHeaders } from "../server/chitChatsClient.ts";
import { mapChitChatsRateEntries, CHIT_CHATS_REQUEST_TIMEOUT_MS, type ChitChatsRateApiEntry } from "./chitChatsShippingProvider.ts";

// Real (non-stub) GET /clients/<id>/shipments?q=<fingerprint> lookup -- see
// chitChatsQuoteCoordinator.ts's header for why reconciliation exists at all (a presumed-crashed
// worker may have actually created a real shipment and just failed to report back; blindly
// retrying would create a duplicate) and docs/chit-chats-staging-validation.md's step 4 for
// exactly what about this mechanism is, and isn't, confirmed.
//
// DELIBERATELY ASYMMETRIC -- this is the one load-bearing design decision in this file:
//   - "true" (a matching shipment genuinely found): fully implemented below, real HTTP call, real
//     response parsing. Adopting a confirmed-existing shipment is always safe, regardless of how
//     reliable `q` turns out to be, because this file never trusts an empty or ambiguous result.
//   - "false" (confirmed absent, safe to create a new one): NEVER returned by this
//     implementation, on purpose. `q` is documented only as "full text searching of shipments by
//     id, to_name, or order_id" -- whether it reliably finds an exact match for a 64-character
//     high-entropy SHA-256 hex fingerprint (vs. tokenizing it and missing it, or matching too
//     broadly) has never been confirmed against a real account: no staging credentials exist in
//     this codebase, and a prior read-only probe against staging.chitchats.com returned 404. A
//     false "false" here -- claiming absence when the shipment actually exists -- would let the
//     coordinator create a brand-new external shipment, the exact duplicate this whole mechanism
//     exists to prevent. An unconfirmed shortcut is not worth that risk, so every outcome other
//     than a clean, exact, singular match falls through to "unknown" -- the coordinator's own
//     existing conservative default (see unknownReconciler in chitChatsQuoteCoordinator.ts),
//     which surfaces a clear, retryable error instead of guessing.
// Once docs/chit-chats-staging-validation.md's step 4 is actually run against a real account and
// zero-result reliability is confirmed, teaching this function to also return "false" on a
// genuinely empty result is a small, isolated change here -- not a redesign.
//
// NOT wired as ChitChatsQuoteCoordinator's default reconciler (that remains unknownReconciler) --
// exported so a caller can opt in once CHIT_CHATS_* credentials exist, consistent with this
// codebase's established "build it, test it against mocks, wire it in as an explicit later step"
// pattern (see SupabaseChitChatsQuoteStore's own header for the same pattern applied to the quote
// store).
//
// SECOND VERIFICATION LAYER (destination fields, not just order_id): even though `order_id` is a
// 64-char SHA-256 fingerprint -- astronomically unlikely to collide by chance -- this additionally
// cross-checks the matched shipment's `to_name`/`to_address_1`/`to_city`/`to_province_code`/
// `to_postal_code`/`to_country_code` (all present on GET /shipments list items, confirmed against
// the live OpenAPI spec) against the ORIGINAL request's own address, which the quote key always
// carries in full by the time a fingerprint exists (ChitChatsShippingProvider.getOptions() already
// requires name/addressLine1/city before ever computing one -- see assertFullChitChatsAddress()).
// This guards against a scenario an order_id match alone can't: Chit Chats' own `q` search
// returning a shipment whose order_id happens to equal this fingerprint for some reason unrelated
// to this request (a replay, a data issue on their side) but whose actual destination doesn't
// match what this request is trying to confirm. A mismatch here is treated exactly like any other
// unconfirmed case -- "unknown", never a hard failure -- since it's an extra safety check layered
// on top of the order_id match, not a new way to positively prove anything.

interface ChitChatsShipmentSummary {
  id?: string;
  order_id?: string;
  rates?: ChitChatsRateApiEntry[];
  to_name?: string;
  to_address_1?: string;
  to_city?: string;
  to_province_code?: string;
  to_postal_code?: string;
  to_country_code?: string;
}

/** Case/whitespace-insensitive comparison -- Chit Chats may normalize casing (e.g. postal codes,
 *  province codes) differently than how this codebase stores them; an honest match shouldn't fail
 *  over "ON" vs "on" or incidental surrounding whitespace. */
function normalizedEquals(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True only if every destination field this codebase can check actually matches. Any field
 *  Chit Chats didn't return (undefined) counts as a mismatch, not a free pass -- a partial
 *  response is not grounds for extra trust. */
function destinationMatches(shipment: ChitChatsShipmentSummary, key: ChitChatsPersistedQuoteKey): boolean {
  const { address } = key;
  return (
    normalizedEquals(shipment.to_name, address.name) &&
    normalizedEquals(shipment.to_address_1, address.addressLine1) &&
    normalizedEquals(shipment.to_city, address.city) &&
    normalizedEquals(shipment.to_province_code, address.province) &&
    normalizedEquals(shipment.to_postal_code, address.postalCode) &&
    normalizedEquals(shipment.to_country_code, address.country)
  );
}

export const chitChatsOrderIdReconciler: ChitChatsShipmentReconciler = async (fingerprint, key) => {
  let url: string;
  let headers: Record<string, string>;
  try {
    url = `${chitChatsShipmentsUrl()}?q=${encodeURIComponent(fingerprint)}`;
    headers = chitChatsRequestHeaders();
  } catch {
    return { outcome: "unknown" }; // credentials not configured in this environment
  }

  let response: Response;
  try {
    // Same bounded timeout as fetchChitChatsRates -- a stalled lookup must never hang the
    // coordinator's claim/wait/takeover loop indefinitely.
    response = await fetch(url, { headers, signal: AbortSignal.timeout(CHIT_CHATS_REQUEST_TIMEOUT_MS) });
  } catch {
    return { outcome: "unknown" }; // network failure or timeout -- cannot confirm either way
  }
  if (!response.ok) return { outcome: "unknown" };

  // GET /shipments returns a bare JSON array -- CONFIRMED against the live OpenAPI spec's own
  // response schema, 2026-11-15, NOT `{ shipments: [...] }` as an earlier round assumed (never
  // verified against the actual response schema, only prose examples). That earlier assumption
  // would have made `data.shipments` always `undefined`, so every real lookup would have silently
  // found zero matches regardless of whether a shipment actually existed.
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { outcome: "unknown" };
  }
  const shipments: ChitChatsShipmentSummary[] = Array.isArray(data) ? data : [];

  // Exact-match filter on `order_id` -- `q` is a full-text search, not an exact filter, so this
  // client-side check guards against the tokenized/partial-match false positives the staging
  // validation doc specifically flags as unconfirmed for a long hex string.
  const exactMatches = shipments.filter(
    (s): s is ChitChatsShipmentSummary & { id: string; order_id: string } =>
      s.order_id === fingerprint && typeof s.id === "string",
  );
  // Zero matches: could mean "genuinely doesn't exist" OR "search missed it" -- cannot
  // disambiguate, so this does NOT return "false" (see header). More than one: an unexpectedly
  // ambiguous result that should never happen for a 64-char fingerprint; treated the same way
  // rather than guessing which match (if any) is the right one.
  if (exactMatches.length !== 1) return { outcome: "unknown" };

  // Second verification layer -- see this file's header. A match on order_id alone is not
  // sufficient; the destination on file for the matched shipment must also agree with what this
  // request is actually trying to confirm.
  if (!destinationMatches(exactMatches[0], key)) return { outcome: "unknown" };

  const rates = mapChitChatsRateEntries(exactMatches[0].rates ?? []);
  // A found shipment with no usable rates (e.g. this listing endpoint doesn't echo `rates` for
  // every entry -- unconfirmed either way) can't be adopted; "unknown" lets the coordinator fall
  // back to its existing safe error rather than filling the quote with an empty rate list.
  if (rates.length === 0) return { outcome: "unknown" };

  return { outcome: true, rates, chitChatsShipmentId: exactMatches[0].id };
};
