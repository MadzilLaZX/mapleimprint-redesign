import { countReferencesWithPrefix } from "./sheets";

function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Generates a reference number in the MI-YYYYMMDD-#### format, with the
 * sequence for a given day derived from how many existing rows in the
 * "Leads" sheet already have today's date prefix. Falls back to a random
 * 4-digit suffix when Google Sheets isn't configured, so submissions still
 * succeed without a spreadsheet attached.
 */
export async function generateReference(): Promise<string> {
  const stamp = todayStamp();
  const prefix = `MI-${stamp}-`;

  const count = await countReferencesWithPrefix(prefix);
  const sequence = count === null ? Math.floor(Math.random() * 10000) : count + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}
