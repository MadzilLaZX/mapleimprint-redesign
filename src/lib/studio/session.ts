// Anonymous Studio session identity — a random, unguessable token that scopes a customer's design
// drafts via RLS (see supabaseClient.ts). Stored as a plain (non-httpOnly) cookie, not
// localStorage, specifically so it rides along automatically with requests to this app's own
// /api/studio/* routes without every call needing to thread it manually.

const COOKIE_NAME = "mi-session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getOrCreateClientSessionToken(): string {
  const existing = readCookie(COOKIE_NAME);
  if (existing) return existing;
  const token = crypto.randomUUID();
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  return token;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export { COOKIE_NAME as STUDIO_SESSION_COOKIE };
