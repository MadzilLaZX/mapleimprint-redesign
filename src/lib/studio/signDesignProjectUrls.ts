import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignProjectRecord } from "./types";
import { DESIGN_UPLOADS_BUCKET } from "./supabaseClient";
import { resolveSecureAssetUrl } from "@/lib/server/signedStorageUrl";

/** Produces a COPY of `record` with every `assetUrl`/`qrLogoUrl` on every object replaced by a
 *  fresh signed URL (or null -- see resolveSecureAssetUrl's fail-secure contract -- a data: URI
 *  clipart reference passes through unchanged, same as fileInventory.ts).
 *
 *  AUTHORIZATION: must ONLY be called on a record that was ALREADY loaded through the real,
 *  session-scoped, RLS-governed client (createStudioClient) -- i.e. after
 *  loadDesignProjectRecord() has already confirmed the requesting session owns this project. This
 *  function itself is given the admin client specifically to perform the signing (not to look up
 *  the project), and only ever signs paths that were already present on an already-authorized
 *  record -- it never accepts or looks up anything by an arbitrary id. See GET /api/studio/[id]
 *  for the real call site and the ordering this depends on.
 *
 *  CRITICAL -- do NOT call this inside loadDesignProjectRecord() itself, or anywhere upstream of
 *  freeze.ts's own use of that function: a frozen designSnapshot is a PERMANENT record (read back
 *  by priceCartItem.ts, fileInventory.ts, the admin file inventory, months or years later) and
 *  must keep storing the original, stable, unsigned URLs -- a signed URL's ~10 minute expiry
 *  baked into permanently-stored JSON would go dead almost immediately. This transform belongs
 *  ONLY on the response sent to the browser for live editing, never on anything written to the
 *  database. */
export async function signDesignProjectRecordForClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  record: DesignProjectRecord,
): Promise<DesignProjectRecord> {
  const cache = new Map<string, Promise<string | null>>();
  const sides = await Promise.all(
    record.sides.map(async (side) => ({
      ...side,
      objects: await Promise.all(
        side.objects.map(async (obj) => ({
          ...obj,
          assetUrl: await resolveSecureAssetUrl(supabaseAdmin, cache, DESIGN_UPLOADS_BUCKET, obj.assetUrl),
          qrLogoUrl: await resolveSecureAssetUrl(supabaseAdmin, cache, DESIGN_UPLOADS_BUCKET, obj.qrLogoUrl),
        })),
      ),
    })),
  );
  return { ...record, sides };
}
