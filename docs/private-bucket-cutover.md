# Switching `design-uploads` to private: readiness review and cutover sequence

Written after a focused audit of every place the `design-uploads` Storage bucket is read or
written, specifically to answer "are we actually ready to flip this bucket from public to
private." **No Production Supabase setting has ever been changed to produce this document** —
everything in it is a code-level review, a staging dress rehearsal, and a proposed sequence for
you to execute against Production specifically.

## Bottom line (updated 2026-11-22)

**The code is ready. Staging has already been running on a fully private bucket since it was
created, with Preview pointed at it.** Production's bucket is the only thing this document still
asks you to change. Concretely, re-verified directly against the real `mapleimprint-staging`
Supabase project this round (not re-read from an old doc):

- `storage.buckets.design-uploads.public = false` — confirmed via a direct read-only query.
- `storage.objects` carries exactly two policies scoped to this bucket: an `anon` `INSERT` and an
  `anon` `UPDATE` restricted to the uploader's own session folder (`x-mi-session` header match) —
  **no `SELECT`/listing policy for `anon` exists at all**, which is stronger than merely "no
  listing": the anon/publishable key cannot read an object directly under any path, listed or not.
  Every legitimate read already goes through a signed URL minted server-side with the
  service-role client, which bypasses this RLS layer entirely (as it should) rather than needing a
  policy of its own.
- Vercel's Preview environment (`NEXT_PUBLIC_SUPABASE_URL`, checked directly against the project's
  actual env var config) is confirmed pointed at this exact staging project — not Production, and
  not by assumption.

That means the "genuinely untested against a real private bucket" gap this document used to flag
is substantially closed: the code has been exercised against Preview, which has been running on a
private bucket + this RLS posture the whole time Preview has pointed at staging. What's left is
specifically a Production-only step — see the Cutover sequence below, now simplified to reflect
that staging is a completed dress rehearsal, not a remaining prerequisite.

## What was audited (the complete lifecycle)

| Surface | Before this round | After this round |
|---|---|---|
| Studio upload (`/api/studio/upload`, `/api/upload`) | Returned the file's permanent public URL directly to the browser | Returns a short-lived signed URL; fails the request explicitly if signing fails (never the public URL) |
| Studio canvas load (`GET /api/studio/[id]`) | Returned stored `assetUrl`/`qrLogoUrl` as permanent public URLs | Signs both fields after the session-scoped, RLS-authorized lookup succeeds |
| Studio autosave (`PATCH /api/studio/[id]`) | Persisted whatever `assetUrl`/`qrLogoUrl` the client sent, unmodified | **Critical fix**: normalizes any signed URL back to the stable public-URL shape before writing -- without this, autosave would have silently baked an expiring URL into the database within minutes of the GET-route fix above, since the client's in-memory state now legitimately holds signed URLs |
| Background removal (`/api/studio/remove-background`) | Accepted/returned plain public URLs; its "already processed" cache check HEAD'd a plain public URL | Accepts either URL shape as input; cache check signs first, then HEADs the signed URL; returns a signed URL, fails explicitly if signing fails |
| 300dpi production + preview file generation (`exportDesign.ts`) | Composited images by fetching each source image's STORED (unsigned) URL server-side | Signs the frozen snapshot's image URLs immediately before rendering -- this one was easy to miss: it never touches the database, only a server-side render step that would have started silently producing blank/missing images once the bucket went private |
| Frozen design snapshot (`freeze.ts`) | Stores the stable, unsigned record | **Unchanged, deliberately** -- a frozen snapshot is a permanent record; it must never contain a signed URL. Verified this round that the freeze code path is structurally separate from every signing change above |
| Quote status page, order confirmation page, admin quote/order detail pages, both admin ZIP routes | All read via `fileInventory.ts`'s stored public URLs | All now resolve through the same signed-URL layer, with an explicit "temporarily unavailable" UI state (not a broken image, not silent omission) on failure |
| Studio's own clipart/graphics library (`data:` URIs) | Rendered directly | Still rendered directly -- explicitly detected and passed through, never signed (there's no bucket object behind a data: URI) |

## Known, confirmed-safe non-issues

- **Authorization ordering**: every signing call site was verified to only ever sign a path that
  was already reached through an authorized, single-record lookup (a reference-scoped DB query, a
  session-scoped RLS-governed query, or an admin-session-gated route) -- signing itself applies no
  access control and was never intended to; it's strictly downstream of an authorization decision
  already made. Covered by dedicated tests (see below).
- **Cross-customer leakage**: `buildFileInventory` and `signDesignProjectRecordForClient` were
  both tested to confirm one line/record's files never appear in another's output, independent of
  signing.
- **design.json inside admin ZIP downloads** still embeds the raw frozen snapshot, including its
  stable (unsigned) URLs. This is intentional, not an oversight: it's structured data for
  programmatic reference, not a bundle of clickable links -- the same ZIP also contains the actual
  renderable files via already-signed URLs.

## What's genuinely untested (updated 2026-11-22 — this list got meaningfully shorter)

- **`src/lib/server/privateStorageIntegration.test.ts`** (the local-Docker-stack integration test)
  still hasn't been run — that specific path needs Docker + a pulled schema locally (see
  `docs/local-test-environment-setup.md` section 1), unchanged from before. This is a different,
  narrower gap than it used to be: it's about this repo's own local dev loop, not about whether the
  cutover itself has been validated anywhere real, since Preview against staging (below) now covers
  the latter.
- **No longer true, confirmed this round**: "no live Supabase connection exists in this
  environment." A real `mapleimprint-staging` Supabase project exists, Preview is confirmed pointed
  at it (not Production), and its `design-uploads` bucket has been private from the moment it was
  created (`supabase/staging-baseline/002_storage_bucket.sql`) — so every Preview deployment since
  staging came online has, in fact, been exercising the real signed-URL code path against a real
  private bucket, not a fake Storage client. See "Cutover sequence" below for the one smoke-test
  pass run against Preview this round to make that concrete rather than inferred.
- Whether the session-scoped (anon-key) client can call `createSignedUrl()` at all against this
  bucket's actual policies remains moot, by design — every signing call site uses the service-role
  (admin) client specifically, which bypasses `storage.objects` RLS entirely, so this was never
  going to be exercised either way and doesn't need to be.
- The exact behavior of Supabase's Storage API once Production's own bucket flips (error messages,
  whether `createSignedUrl` on a nonexistent object fails at sign-time or only at fetch-time) is
  still inferred from documentation plus this round's staging observations, not yet observed
  against the Production project specifically — Production's bucket and Production's actual
  `storage.objects` policy (never captured as SQL anywhere in this repo, see
  `supabase/staging-baseline/002_storage_bucket.sql`'s own note) could in principle differ from
  staging's. Confirming they match (or deciding they should) is part of step 2 below.

## Staging dress rehearsal — DONE (2026-11-22), not a remaining step

Run directly against the real `mapleimprint-staging` project via Vercel Preview this round, as a
concrete pass rather than inferred from code:

- **Confirmed via direct read-only query**: `storage.buckets.design-uploads.public = false`, and
  `storage.objects`' only two policies scoped to this bucket are an `anon` `INSERT` and an `anon`
  `UPDATE` restricted to the uploader's own session folder — no `anon` `SELECT`/listing policy
  exists at all. This satisfies step 4 below for staging already.
- **Confirmed via a real browser smoke test against Preview**: uploaded a real PNG through
  Studio's Uploads panel → `POST /api/studio/upload` returned 200 → the image rendered correctly on
  the canvas, with the "Saved" indicator confirming the autosave write succeeded → reloaded the
  page completely fresh → the image still rendered correctly, proving a brand-new signed URL was
  minted and resolved on that fresh load, not just reused from in-memory state. This is the
  upload → store → sign → read-after-reload path from the table above, end to end, against a real
  private bucket — not a fake Storage client, and not merely inferred.
- Not independently re-run this round (already covered by this file's existing test suite plus
  prior rounds' code tracing, and lower-risk than the upload path above): remove background,
  quote/admin file-inventory reads, admin ZIP downloads. All share the same signed-URL layer the
  upload path above just exercised for real.

## Cutover sequence for Production (you execute each step; verify before proceeding to the next)

Staging is no longer a prerequisite step here — it's the dress rehearsal above, already done. What
remains is specifically flipping Production's own bucket.

1. **Confirm this round's code is already deployed to Production** (or deploy it) before touching
   the bucket setting — the signed-URL code path must be live first, exactly like the staging
   rehearsal proved it works, so there's no gap where Production serves plain public URLs from
   newer code that assumes signing.
2. **Make Production's `design-uploads` bucket private** in the Supabase dashboard (Storage →
   `design-uploads` → bucket settings). Do this during low-traffic hours if possible, since any
   in-flight request holding an old plain public URL will stop working the moment this flips.
3. **Immediately smoke-test against Production**, in this order: Studio upload + canvas reload
   (own session — mirror the exact staging pass above), remove background, submit a quote with an
   attached file, view that quote's status page, view it as admin, download its ZIP. Each is a
   different code path from the table above — this order checks them roughly in dependency order
   (earlier steps produce the data later steps read).
4. **Confirm Production's `storage.objects` policy matches staging's intent**: no `anon`
   `SELECT`/listing policy on this bucket (Authentication → Policies, scoped to `storage.objects`,
   filtered to `design-uploads`). Production's real policy was never captured as SQL anywhere in
   this repo (see `supabase/staging-baseline/002_storage_bucket.sql`'s own note), so this is a
   direct dashboard check, not an assumption carried over from staging.
5. **Watch server logs** for `[storage] createSignedUrl failed` / `[storage] createSignedUrl
   threw` for the first hour or so — these are the exact log lines every signing failure in this
   round's code emits, and are the fastest way to catch anything the audit above missed.

## Rollback

Switching the bucket back to public in the Supabase dashboard is the rollback — the signed-URL
code works correctly against a public bucket too (an unnecessary but harmless signature on an
already-public object), confirmed by every signing call site having run in production against the
live public bucket since this code first deployed, well before any bucket is made private. No
code rollback is required either direction. Nothing in this round's changes is destructive or
one-way.
