# Payment idempotency: durable attempt state model (proposed, not yet live)

Written this round after tracing the full payment lifecycle in `src/app/api/checkout/pay/route.ts`
and `src/components/checkout/payment/SquarePaymentSection.tsx`. **Nothing in this document has
been wired into the live payment route** — the decision logic it's built on
(`src/lib/checkout/checkoutAttemptState.ts`) is written and tested in isolation, and the schema
change it needs (`supabase/migrations/011_checkout_attempt_id.sql`) is written but not applied.
Both require Square sandbox access to validate before going live, which this environment doesn't
have (see `docs/local-test-environment-setup.md`).

## The gap, traced precisely

`SquarePaymentSection.tsx` generates `idempotencyKey = crypto.randomUUID()` once per page load,
and **regenerates it on every failed attempt or network error** (lines ~114-123). This is
*necessary*, not a bug by itself: Square's Web Payments SDK tokens (`sourceId`) are single-use, so
every retry's tokenize() call produces a different `sourceId`, and Square rejects reusing an
idempotency key against a changed request body. So the key has to change.

The consequence, in `/api/checkout/pay/route.ts`: the server's only notion of "have I seen this
attempt before" is `PaymentAttempt.idempotencyKey`. Since that key is different on every retry,
**every retry that follows a failure or network error creates a brand new `MapleOrder` +
`MapleOrderLine` + `PaymentAttempt` + Square Order**, with zero connection to the previous attempt.

Concretely: if attempt #1 actually succeeds — Square charges the card, our server records
`PAID` — but the HTTP response is lost before reaching the browser (dropped connection, closed
tab, timeout), the customer sees a generic error, retries, and attempt #2 charges the card again.
Nothing in the current code detects that attempt #1 already succeeded, because attempt #2 has no
way to look it up — it has a different `idempotencyKey` and no shared identifier at all.

This is a narrow window (requires the request to succeed server-side AND the response to be lost
in transit), but it's a real one, and it's exactly the kind of gap that's invisible until a real
customer hits it.

## The proposed model

Add a second identifier, generated **once per checkout session and never regenerated on retry**
(unlike the Square idempotency key) — `checkoutAttemptId`. The client keeps this stable across
every `/api/checkout/pay` call for one checkout attempt (e.g. a `useRef` initialized once when the
payment section mounts, the same lifecycle `idempotencyKeyRef` already has, just without the
reset-on-failure behavior).

```ts
// Proposed addition to SquarePaymentSection.tsx — NOT applied this round.
const checkoutAttemptIdRef = useRef<string>(crypto.randomUUID());
// ... included in every POST body as `checkoutAttemptId`, alongside the per-attempt idempotencyKey.
// Unlike idempotencyKeyRef, this one is NEVER reassigned inside submitToken()'s catch/error paths.
```

Server-side, **before** doing anything else, `/api/checkout/pay` looks up an existing `MapleOrder`
by `checkoutAttemptId` (the new unique-when-not-null column from migration 011) and feeds the
result into `decideCheckoutAttemptAction()`:

| Existing order found? | Status | Action |
|---|---|---|
| No | — | `CREATE_NEW_ORDER` — today's behavior, unchanged |
| Yes | `PAID` | `ALREADY_PAID` — return success immediately, **never call Square again** |
| Yes | `PENDING_PAYMENT` / `PAYMENT_FAILED`, no `squareOrderId` | `REUSE_ORDER_NEW_SQUARE_ORDER` — reuse the same `MapleOrder` row, still need a fresh Square Order |
| Yes | `PENDING_PAYMENT` / `PAYMENT_FAILED`, has `squareOrderId` | `REUSE_ORDER_REUSE_SQUARE_ORDER` — reuse both; only a fresh `Payment` (new idempotency key, since the source token is necessarily fresh) needs to be attempted |
| Yes | `CANCELLED` | `REJECT_CANCELLED_ORDER` — never silently resurrected by a stale retry; customer must start a new checkout (a fresh page load mints a new `checkoutAttemptId`) |

This closes the realistic common case: a webhook typically arrives within seconds of a real Square
payment completing, independent of whether our own synchronous response reached the browser. By
checking the order's *current* DB status first, a retry that happens after the webhook has already
landed will see `PAID` and stop — no second charge, no second Square call at all.

## What this does NOT fully close

A retry that fires **faster than the webhook arrives** (a genuine race, not just a lost response)
could still see a non-`PAID` status and proceed to attempt a second payment. Fully closing that
needs one more layer: before creating a new `Payment` against an existing `squareOrderId`, query
Square directly (`listPayments({ orderId: squareOrderId })` or equivalent) to check whether a
payment already completed for that order. This is the next step once sandbox access exists — it
needs real verification of the exact Square SDK call shape and response handling, which isn't
something to guess at without being able to test it. Documented here as the known remaining gap,
not implemented.

## Why this wasn't wired into the live route this round

`/api/checkout/pay/route.ts` is the one place real money moves. Changing its control flow without
being able to run it against the Square sandbox (verify the reused-`squareOrderId` payment call
actually succeeds, verify `ALREADY_PAID` really does short-circuit correctly end-to-end, verify
the migration's partial unique index behaves as expected under concurrent requests) would mean
shipping payment-critical logic that's only been verified in isolation. The decision logic itself
(`checkoutAttemptState.test.ts`, 7 tests) is fully covered and ready to integrate; the DB lookup
and Square call sites around it are not written, specifically so nothing here can accidentally
change live payment behavior.

## Integration checklist (for whoever picks this up once sandbox access exists)

1. Apply migration 011 (adds `MapleOrder.checkoutAttemptId`, nullable, partial-unique).
2. Add `checkoutAttemptIdRef` to `SquarePaymentSection.tsx`, included in the POST body, never
   reset on retry.
3. In `/api/checkout/pay/route.ts`, before the existing `idempotencyKey`-based lookup: look up by
   `checkoutAttemptId`, call `decideCheckoutAttemptAction()`, and branch on its result as described
   above — `ALREADY_PAID` returns immediately; the `REUSE_*` cases skip the `MapleOrder`/
   `MapleOrderLine` insert and go straight to creating a `PaymentAttempt` + calling Square.
4. Test against Square sandbox specifically: trigger a lost-response scenario (e.g. by killing the
   connection after Square confirms but before the response is read) and confirm a retry returns
   `ALREADY_PAID` without a second charge appearing in the Square sandbox dashboard.
5. Only then consider the Square-side payment-status check described above, for the narrower race
   this model doesn't close on its own.
