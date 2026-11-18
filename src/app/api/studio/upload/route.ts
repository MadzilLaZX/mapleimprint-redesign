import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STUDIO_SESSION_COOKIE } from "@/lib/studio/session";
import { saveUpload, isSaveUploadError } from "@/lib/uploads/saveUpload";
import { getSignedAssetUrl } from "@/lib/server/signedStorageUrl";
import { createAdminClient } from "@/lib/server/supabaseAdmin";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Missing Studio session. Reload the page and try again." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const result = await saveUpload({ sessionToken, file, category: "studio-image", mirrorToDrive: false });
  if (isSaveUploadError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // The file is already safely stored at this point (saveUpload succeeded) -- signing is only
  // about what URL the browser gets back for IMMEDIATE canvas rendering. The uploader's own
  // session just wrote this exact file, so there's no authorization question here (own fresh
  // upload, not a lookup of someone else's) -- the admin client is used purely for the signing
  // call itself, same as every other call site. Per signedStorageUrl.ts's fail-secure contract:
  // on failure, return an error rather than the file's permanent public URL -- the customer sees
  // this as "upload failed, try again" even though the bytes are safely stored, which is the
  // honest state (we can't show it right now) rather than a silently less-protected URL.
  const url = await getSignedAssetUrl(createAdminClient(), result.storageBucket, result.storagePath);
  if (!url) {
    return NextResponse.json({ error: "Your file was saved, but we couldn't prepare it for preview. Please try again." }, { status: 502 });
  }

  // `url` kept as the primary field for every existing caller that only reads it; `assetId` is
  // additive so Studio can start threading it onto DesignObjectRecord.assetId.
  return NextResponse.json({ url, assetId: result.assetId });
}
