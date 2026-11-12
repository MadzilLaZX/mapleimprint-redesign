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
