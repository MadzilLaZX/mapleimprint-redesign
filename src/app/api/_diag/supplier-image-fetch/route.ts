import { NextResponse } from "next/server";

// TEMPORARY diagnostic route — not linked from anywhere in the UI. Checks whether this server's
// own outbound fetch (distinct from Next's Image Optimization pipeline, which is separately
// blocked by a Vercel quota issue right now) can still reach supplier CDNs that block direct
// browser/automation requests via Cloudflare. Delete once the investigation this supports is
// resolved — see HANDOFF.md.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !/^https:\/\/(cdn\.ssactivewear\.com|media\.sanmarcanada\.com)\//.test(url)) {
    return NextResponse.json({ error: "missing or disallowed url param" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    const buf = await res.arrayBuffer();
    return NextResponse.json({
      status: res.status,
      contentType: res.headers.get("content-type"),
      cfRay: res.headers.get("cf-ray"),
      bytes: buf.byteLength,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
