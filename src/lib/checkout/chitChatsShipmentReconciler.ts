import type { ChitChatsShipmentReconciler } from "./chitChatsQuoteCoordinator.ts";
import { chitChatsShipmentsUrl, chitChatsRequestHeaders } from "../server/chitChatsClient.ts";
import { mapChitChatsRateEntries, type ChitChatsRateApiEntry } from "./chitChatsShippingProvider.ts";

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

interface ChitChatsShipmentSummary {
  id?: string;
  order_id?: string;
  rates?: ChitChatsRateApiEntry[];
}

interface ChitChatsShipmentsListResponse {
  shipments?: ChitChatsShipmentSummary[];
}

export const chitChatsOrderIdReconciler: ChitChatsShipmentReconciler = async (fingerprint) => {
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
    response = await fetch(url, { headers });
  } catch {
    return { outcome: "unknown" }; // network failure -- cannot confirm either way
  }
  if (!response.ok) return { outcome: "unknown" };

  let data: ChitChatsShipmentsListResponse;
  try {
    data = (await response.json()) as ChitChatsShipmentsListResponse;
  } catch {
    return { outcome: "unknown" };
  }

  // Exact-match filter on `order_id` -- `q` is a full-text search, not an exact filter, so this
  // client-side check guards against the tokenized/partial-match false positives the staging
  // validation doc specifically flags as unconfirmed for a long hex string.
  const exactMatches = (data.shipments ?? []).filter(
    (s): s is ChitChatsShipmentSummary & { id: string; order_id: string } =>
      s.order_id === fingerprint && typeof s.id === "string",
  );
  // Zero matches: could mean "genuinely doesn't exist" OR "search missed it" -- cannot
  // disambiguate, so this does NOT return "false" (see header). More than one: an unexpectedly
  // ambiguous result that should never happen for a 64-char fingerprint; treated the same way
  // rather than guessing which match (if any) is the right one.
  if (exactMatches.length !== 1) return { outcome: "unknown" };

  const rates = mapChitChatsRateEntries(exactMatches[0].rates ?? []);
  // A found shipment with no usable rates (e.g. this listing endpoint doesn't echo `rates` for
  // every entry -- unconfirmed either way) can't be adopted; "unknown" lets the coordinator fall
  // back to its existing safe error rather than filling the quote with an empty rate list.
  if (rates.length === 0) return { outcome: "unknown" };

  return { outcome: true, rates, chitChatsShipmentId: exactMatches[0].id };
};
