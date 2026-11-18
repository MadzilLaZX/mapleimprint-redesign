# Switching `design-uploads` to private: readiness review and cutover sequence

Written after a focused audit of every place the `design-uploads` Storage bucket is read or
written, specifically to answer "are we actually ready to flip this bucket from public to
private." **No Production Supabase setting was changed to produce this document** — everything
below is a code-level review plus a proposed sequence for you to execute.

## Bottom line

**The code is ready. The bucket has not been changed.** Every legitimate read path identified in
the audit below now goes through a short-lived signed URL with a fail-secure fallback (never a
permanent public URL on failure); every write path that could have silently corrupted stored data
with an expiring URL has been corrected. What's genuinely untested is listed in its own section —
none of it blocks starting the cutover sequence, but you should know about it going in.

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

## What's genuinely untested

- **No live Supabase connection exists in this environment** (see
  `docs/local-test-environment-setup.md`), so nothing above was run against a real bucket in
  either its public or private state. Every claim here is backed by unit tests against a fake
  Storage client plus careful code tracing, not a live end-to-end run.
- Whether the session-scoped (anon-key) client can call `createSignedUrl()` at all against this
  bucket's actual policies was deliberately avoided as a question: every signing call site in this
  round uses the service-role (admin) client specifically, so this was never exercised either way.
- The exact behavior of Supabase's Storage API once the bucket is actually private (error
  messages, whether `createSignedUrl` on a nonexistent object fails at sign-time or only at
  fetch-time) is inferred from documentation and defensive coding, not observed directly.

## Cutover sequence (you execute each step; verify before proceeding to the next)

1. **Deploy this round's code to Preview first**, not Production. Confirm the full customer
   journey still works end-to-end against Preview *while the bucket is still public* -- this
   proves the new signed-URL code path works correctly without yet depending on it for security
   (today, if signing silently failed somewhere missed by this audit, the old plain-URL behavior
   would no longer serve as a safety net -- catching that here, before the bucket changes, is the
   point of this step).
2. **Make the bucket private** in the Supabase dashboard (Storage → `design-uploads` → bucket
   settings). Do this during low-traffic hours if possible, since any in-flight request holding an
   old plain public URL will stop working the moment this flips.
3. **Immediately smoke-test**, in this order: Studio upload + canvas reload (own session), remove
   background, submit a quote with an attached file, view that quote's status page, view it as
   admin, download its ZIP. Each is a different code path from the table above -- this order
   checks them roughly in dependency order (earlier steps produce the data later steps read).
4. **Confirm no `storage.objects` policy permits listing** the bucket's contents to the anon role
   (Authentication → Policies, scoped to `storage.objects`, filtered to this bucket) -- this is
   the other half of "private" that a bucket-level public/private flag alone doesn't fully cover,
   flagged in last round's audit and still worth confirming directly once you're in the dashboard
   for this change anyway.
5. **Watch server logs** for `[storage] createSignedUrl failed` / `[storage] createSignedUrl
   threw` for the first hour or so -- these are the exact log lines every signing failure in this
   round's code emits, and are the fastest way to catch anything the audit above missed.

## Rollback

Switching the bucket back to public in the Supabase dashboard is the rollback -- the code
deployed in step 1 continues to work correctly against a public bucket too (that's exactly what
was verified in step 1), so no code rollback is required either direction. Nothing in this round's
changes is destructive or one-way.
