import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"];

let authClient: InstanceType<typeof google.auth.JWT> | null = null;

/**
 * Service-account auth shared by Sheets (lead log) and Drive (file uploads).
 * One Google Cloud service account + one set of scopes covers both, so a
 * single credential pair (email + private key) is all the automation needs.
 * Returns null when the credentials aren't configured yet, so callers can
 * degrade gracefully rather than throwing.
 */
export function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  if (!authClient) {
    authClient = new google.auth.JWT({
      email,
      // Vercel/`.env` values can't hold real newlines, so the key is stored
      // with literal "\n" sequences and unescaped here.
      key: rawKey.replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });
  }
  return authClient;
}

export function isGoogleConfigured(): boolean {
  return getGoogleAuth() !== null;
}
