import "server-only";

// Chit Chats has no official SDK (unlike Square) -- it's a plain REST API, so this is just the
// URL/header plumbing a real fetch-based implementation needs, mirroring squareClient.ts's "throw
// clearly if a required env var is missing" pattern. No network call happens anywhere in this
// file. None of these functions are called from any live code path today --
// chitChatsShippingProvider.ts's rate fetcher is still a throwing stub (fetchChitChatsRates) that
// doesn't use this client yet; building the real fetch implementation is the next step once
// credentials exist and docs/chit-chats-staging-validation.md's procedure has been run.
//
// Authorization header format: Chit Chats' own docs show
//   curl -s -H "Authorization: $ACCESS_TOKEN" ...
// without stating whether a "Bearer " prefix is expected or the raw token is sent as-is. This
// client sends the raw token (matching the documented example literally) -- confirm this is
// correct at docs/chit-chats-staging-validation.md's step 1 before relying on it; if a real
// account requires a Bearer prefix, this is the one place to add it.

export function chitChatsBaseUrl(): string {
  return process.env.CHIT_CHATS_ENVIRONMENT === "production" ? "https://chitchats.com" : "https://staging.chitchats.com";
}

export function chitChatsClientId(): string {
  const id = process.env.CHIT_CHATS_CLIENT_ID;
  if (!id) throw new Error("CHIT_CHATS_CLIENT_ID is not set.");
  return id;
}

export function chitChatsAuthHeader(): string {
  const token = process.env.CHIT_CHATS_API_ACCESS_TOKEN;
  if (!token) throw new Error("CHIT_CHATS_API_ACCESS_TOKEN is not set.");
  return token;
}

/** Every Chit Chats endpoint is scoped under /clients/<CLIENT_ID>/ -- this builds that base path
 *  once so a real implementation doesn't repeat the client-ID-in-URL pattern at every call site. */
export function chitChatsClientBaseUrl(): string {
  return `${chitChatsBaseUrl()}/api/v1/clients/${chitChatsClientId()}`;
}

export function chitChatsShipmentsUrl(): string {
  return `${chitChatsClientBaseUrl()}/shipments`;
}

export function chitChatsShipmentUrl(shipmentId: string): string {
  return `${chitChatsClientBaseUrl()}/shipments/${shipmentId}`;
}

export function chitChatsShipmentRefreshUrl(shipmentId: string): string {
  return `${chitChatsShipmentUrl(shipmentId)}/refresh`;
}

export function chitChatsShipmentBuyUrl(shipmentId: string): string {
  return `${chitChatsShipmentUrl(shipmentId)}/buy`;
}

/** The exact headers a real fetch() call needs -- Content-Type only matters for POST/PATCH bodies,
 *  harmless to include on GET/DELETE too. */
export function chitChatsRequestHeaders(): Record<string, string> {
  return {
    Authorization: chitChatsAuthHeader(),
    "Content-Type": "application/json",
  };
}
