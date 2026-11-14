import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabaseAdmin";
import { SupabaseChitChatsQuoteStore } from "@/lib/checkout/chitChatsQuoteStore";

/**
 * The "executable, documented cleanup mechanism" docs/chit-chats-production-readiness.md's step 7
 * (and supabase/migrations/010_chit_chats_shipping_quotes.sql's own commented-out SQL) describes --
 * calls the real `deleteExpiredUnpurchased()` query against the `ChitChatsShippingQuote` table.
 *
 * NOT a live scheduler -- nothing calls this route automatically. It exists so a Vercel Cron entry
 * (or a manual admin action) has something real to hit once migration 010 is reviewed and applied;
 * adding that schedule is a `vercel.json` change, a separate, explicit activation step, not done
 * here. Until migration 010 is applied, calling this route will fail (the table doesn't exist) --
 * that's expected, not a bug to work around.
 *
 * Protected the same way every other /api/admin/* route is: src/proxy.ts's matcher requires a
 * valid staff session cookie before this handler ever runs -- no separate auth check needed here.
 */
export async function POST() {
  const supabaseAdmin = createAdminClient();
  const store = new SupabaseChitChatsQuoteStore(supabaseAdmin);

  let removed: number;
  try {
    removed = await store.deleteExpiredUnpurchased(new Date());
  } catch (err) {
    console.error("[admin] Chit Chats quote cleanup failed:", err);
    return NextResponse.json(
      { error: "Cleanup failed -- see server logs. If migration 010 hasn't been applied yet, this is expected." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, removed });
}
