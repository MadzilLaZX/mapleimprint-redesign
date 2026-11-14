# Supabase integration-test procedure for migration 010

Not run this round — migration 010 is not applied anywhere, including the live
`maple-imprint-catalogue` project. This is the procedure to validate
`SupabaseChitChatsQuoteStore` (`src/lib/checkout/chitChatsQuoteStore.ts`) against a **real**
Postgres/PostgREST instance before trusting it in Production, without touching the live database.

## Isolated test environment: availability checked this round

Two genuinely isolated options exist; neither was used without your explicit go-ahead, since both
have real-world footprint outside this repo:

1. **Local Supabase CLI + Docker** (fully free, zero cloud-account risk, nothing persists outside
   your machine). **Not currently installed** — `supabase` CLI and `docker` were both checked and
   are absent from this machine. Setup:
   ```
   npm install -g supabase
   supabase init
   supabase start          # starts a local Postgres + PostgREST + Auth stack in Docker
   supabase db push supabase/migrations/010_chit_chats_shipping_quotes.sql
   RUN_LIVE_PAYMENT_INTEGRATION_TESTS=1 SUPABASE_SERVICE_ROLE_KEY=<printed-by-supabase-start> \
     node --test src/lib/checkout/chitChatsQuoteStore.integration.test.ts
   ```
   (the test file currently points at the live project's URL — point it at
   `http://localhost:54321` for this local run, or parameterize the URL via an env var if this
   becomes a repeated workflow). This is the recommended path: fully isolated, free, and the
   closest thing to "real Postgres" without any account-level action at all.

2. **A new, separate Supabase cloud project** in your existing organization — technically
   available (your account already has precedent for this: a project named
   `velor-marketing-ai-rls-test` exists, suggesting this exact pattern — a throwaway project for
   isolated RLS/behavior testing — has been used before). **Not created this round**: provisioning
   a new cloud project is a real action against your account (and depending on your plan, may have
   a cost), so it needs your explicit confirmation before I'd create one, same as any other
   external-account action. If you'd like this, say so and I'll check the project-creation cost for
   your organization first (Supabase's own tooling requires confirming cost before creating), then
   create it, apply migration 010 there, and run the real test suite against it.

Given neither was available/authorized this round, what follows is the procedure to run once
either exists — the test file itself (`chitChatsQuoteStore.integration.test.ts`) is already written
and ready; only the target database needs to exist.

## What the existing integration test file already covers

Six tests, all skipped by default (`{ skip: !hasCredentials }`), covering exactly the areas this
round asked to validate:

| Area | Test |
|---|---|
| Atomic claims | `claimOrInspect() + the real UNIQUE constraint: a second claim for the same fingerprint never inserts a second row` |
| Concurrent requests | Same test — asserts the real DB row count stays at 1 after two concurrent claim attempts |
| Compare-and-swap takeover | `takeOver() against a real, genuinely-stale pending row succeeds and resets it for a new owner` |
| CAS rejection | `fill() with the WRONG ownerToken is rejected by the real CAS UPDATE -- the row is left untouched` |
| Cleanup safeguards | `deleteExpiredUnpurchased() against the real table removes an expired, non-leased row but never a purchased one` |
| Access control | `real RLS: the anon key cannot read ChitChatsShippingQuote rows at all` |

Lease expiration and stale-owner rejection are covered logically by the `takeOver()` test above
(it specifically constructs an expired-lease row and recovers it) and by the CAS-rejection test
(a wrong token is the stale-owner case). No additional test file is needed — these are the right
tests; they just need a real target to run against.

## What specifically needs confirming once a target exists (beyond "does it pass")

1. **`takeOver()`'s two-separate-UPDATE approach** (see that method's own code comment) — confirm
   both conditional UPDATEs behave as expected against real PostgREST, since the combined
   OR/AND filter syntax was deliberately avoided without live verification.
2. **`.upsert(..., { onConflict: "quoteFingerprint", ignoreDuplicates: true })`** — confirm this
   compiles to a real `INSERT ... ON CONFLICT ("quoteFingerprint") DO NOTHING` and that a
   conflicting insert returns no row (so `claimOrInspect()`'s `if (inserted)` check behaves as
   coded) rather than, e.g., returning the existing row by default.
3. **`.delete({ count: "exact" })`** on `deleteExpiredUnpurchased()` — confirm the PostgREST count
   header is actually returned and parsed correctly by the JS client version in `package.json`.
4. Run the **existing in-memory-fake-based test suites**
   (`chitChatsQuoteStore.test.ts`, `chitChatsQuoteCoordinator.test.ts`) side-by-side and confirm
   their expectations match the real database's behavior exactly — any divergence means the fake
   needs correcting, not the real implementation, since the fake was hand-written to mirror the
   intended real semantics rather than observed from a real database this round.

## Confirmed limitation

No isolated test environment was exercised this round. Everything in
`chitChatsQuoteStore.ts`/`chitChatsQuoteCoordinator.ts` beyond what's listed as "verified" in
`docs/chit-chats-production-readiness.md` is validated only against the hand-written in-memory
fake, not real Postgres/PostgREST — a meaningfully different thing from "tested," since the fake
can only be as correct as my own understanding of PostgREST's behavior, which is unverified here.

## Migration 010 deployment checklist (once you decide to apply it)

Written this round, not executed — applying any migration requires your explicit approval, per
standing instructions. In dependency order:

1. **Run this doc's integration-test procedure against an isolated target first** (local Supabase
   CLI + Docker, or an explicitly-approved throwaway cloud project — see "Isolated test
   environment" above) and resolve every item in "What specifically needs confirming" above.
   Applying directly to the live `maple-imprint-catalogue` project without this step means finding
   out about a PostgREST behavior mismatch (if any) in Production instead of in an isolated one.
2. **Apply migration 010 to the live project** (`supabase db push` or the Supabase dashboard's SQL
   editor, whichever this project's existing migration-application process uses — migrations
   001-009 are already live, so there's an established precedent to follow, not a new process to
   invent).
3. **Verify immediately after applying, before any code change depends on it**:
   - `ChitChatsShippingQuote` table exists with RLS enabled and zero policies (deny-all) — same
     verification pattern already used for `MapleOrder`/`PaymentAttempt` (see
     `production-deployment-checklist.md`'s existing RLS checks).
   - The new `chit_chats_quote_purchased_implies_ready` check constraint and the
     `ChitChatsShippingQuote_cleanup_idx` partial index are both present (`\d
     "ChitChatsShippingQuote"` in `psql`, or the Supabase dashboard's table editor).
4. **Only then**, construct a real `SupabaseChitChatsQuoteStore` + `ChitChatsQuoteCoordinator` and
   wire them into `ChitChatsShippingProvider` as `shippingProvider.ts`'s live export (step 6 in
   `chit-chats-production-readiness.md`'s "Minimum remaining engineering work") — applying the
   migration does not itself activate anything; the table existing and the code reading from it
   are two separate, independently-approvable steps.
5. **Optionally**, add a Vercel Cron entry calling the already-built (not yet scheduled)
   `POST /api/admin/chit-chats-quotes/cleanup` route — a separate, small activation step, not
   required for the table or the quote-coordinator to function correctly in the meantime (an
   unapplied cleanup job just means expired rows accumulate until it's added, not that anything
   breaks).

### Rollback

Migration 010 is purely additive — one new table, two indexes, RLS enablement, no change to any
existing table/column/data. Rollback is a clean removal, never a restore-from-backup scenario,
matching every other migration's rollback note in `production-deployment-checklist.md`:

```sql
drop table if exists "ChitChatsShippingQuote";
```

Safe to run at any point **as long as `shippingProvider.ts`'s live export is still
`FreeShippingProvider`** (true today) — nothing reads from this table yet. If step 4 above has
already happened (a real `ChitChatsShippingProvider` is live), rolling back the table first would
break every in-flight shipping quote request; roll back the code (revert `shippingProvider.ts`'s
export to `FreeShippingProvider`) before dropping the table, same "code rollback before schema
rollback" order as any other active-dependency rollback.
