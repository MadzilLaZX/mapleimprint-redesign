import { getSupabase } from "./supabase";

function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Generates a reference number in the MI-YYYYMMDD-#### format, with the
 * sequence for a given day derived from how many inquiries already have
 * today's date prefix. Falls back to a random 4-digit suffix when Supabase
 * isn't configured, so submissions still succeed without a DB attached.
 */
export async function generateReference(): Promise<string> {
  const stamp = todayStamp();
  const prefix = `MI-${stamp}-`;

  const supabase = getSupabase();
  if (!supabase) {
    const fallback = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `${prefix}${fallback}`;
  }

  const { count, error } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .like("reference", `${prefix}%`);

  const sequence = error || count === null ? Math.floor(Math.random() * 10000) : count + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}
