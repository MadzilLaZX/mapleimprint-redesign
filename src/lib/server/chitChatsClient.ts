// Chit Chats has no official SDK (unlike Square) -- it's a plain REST API, so this is just the
// URL/header plumbing a real fetch-based implementation needs, mirroring squareClient.ts's "throw
// clearly if a required env var is missing" pattern. No network call happens anywhere in this
// file. Used by chitChatsShippingProvider.ts's real (non-stub) rate fetcher and
// chitChatsShipmentReconciler.ts's real reconciliation lookup -- both of those files are exercised
// directly by `node --test` (chitChatsShippingProvider.test.ts, chitChatsRateFetcher.test.ts,
// chitChatsShipmentReconciler.test.ts), so this file deliberately does NOT `import "server-only"`
// like squareClient.ts/supabaseAdmin.ts do (those are only ever imported from Next.js API routes,
// never from a test-covered module) -- that import throws under plain Node outside a Next.js
// build, which would break every test that transitively imports this file. The real safety net
// against leaking CHIT_CHATS_API_ACCESS_TOKEN to a client bundle is that Next.js only inlines
// `process.env.NEXT_PUBLIC_*` values into client code; this file reads no NEXT_PUBLIC_-prefixed
// variable, so the token is never present in client-side output regardless of this import.
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
