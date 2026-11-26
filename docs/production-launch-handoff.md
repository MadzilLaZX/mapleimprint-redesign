# Production launch handoff — owner action list

Written 2026-11-26 at `checkout-square-payments` (commit `b1b4728`), after staging UAT passed and
the Square Canadian postal-code question was closed out. This is a **short, prioritized action
list** for the business owner — for full technical detail behind any item, see
`docs/production-launch-runbook.md` (the technical reference) and
`docs/owner-handoff-checklist.md` (the detailed packaging-measurement and supplier-outreach
instructions). Nothing here repeats what those already cover in depth.

**Nothing in this document has been executed.** No Production setting, credential, or data has
been touched to produce it.

---

## How to read this

Each blocker below has the same four lines:
- **Needed:** the exact information or action required.
- **Who:** who provides it (always you, the owner, or your accountant/supplier — never something
  the development team can decide alone).
- **Dev team does:** what happens once you provide it — usually small and fast.
- **Verified by:** how you'll know it actually worked.

---

## 1. Production Supabase access — do this first

**Needed:** Confirm which Supabase project is the real Production backing store, and add its
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel's Production environment
variables. (A service-role key is already set for Production; these two public values are the
confirmed gap.)
**Who:** You (whoever holds Supabase account/dashboard access). This item was previously paused
pending your authorization — not investigated further in this round, per your instruction.
**Dev team does:** Nothing until these values exist — this is pure configuration, not code. Once
set, every Supabase-dependent Production feature (checkout, Studio, quotes, admin) starts working
automatically.
**Verified by:** Load the Production homepage and a product page; confirm no "X is not set" error
in Vercel's runtime logs.

**Why first:** almost every other item below depends on Production's Supabase project actually
working — testing anything else first would just hit the same wall.

---

## 2. Canadian tax registration — can start in parallel with #1

**Needed:** Confirm with your accountant whether Maple Imprint is GST/HST-registered (and
separately, QST-registered if you plan to sell to Quebec). The 13% Ontario HST *rate* is already
correctly coded — this is purely the registration/authorization question.
**Who:** You + your accountant.
**Dev team does:** Once confirmed, flips one line of code (`taxProvider.ts`'s Production branch)
as its own small, reviewed change — not bundled into anything else.
**Verified by:** A test order's tax line matches what your accountant expects for that province.

**If you'd rather launch sooner:** Production can launch charging **$0 tax** as a deliberate,
honest interim state (already how the code behaves by default) while this is sorted — see the
"Two launch paths" note near the bottom.

---

## 3. Chit Chats packaging measurements + shipping-origin address — can start in parallel with #1–2

**Needed:** (a) Measure at least one real shipping box (full step-by-step in
`docs/owner-handoff-checklist.md` §1 — just a tape measure and a kitchen scale). (b) Decide
whether the Chit Chats account's on-file return address should match the website's published
Ottawa address, and update whichever one is wrong.
**Who:** You (physical measurement + a login to the Chit Chats dashboard — no API exposes this,
confirmed).
**Dev team does:** Adds your measurements as one data entry (no new code), then does the one
deliberate code change that turns on real Chit Chats rates in Production.
**Verified by:** A test cart quote for that exact product shows a real, non-placeholder shipping
rate instead of "Request a Shipping Quote."

**If you'd rather launch sooner:** Production can launch with **free/flat shipping** as a
deliberate interim state while this is sorted — see "Two launch paths" below.

---

## 4. Production private artwork storage — depends on #1

**Needed:** Flip the `design-uploads` Supabase Storage bucket from public to private, in the
Supabase dashboard. The code side is already finished and already dress-rehearsed on staging
(running privately there since it was created) — this is a one-click setting change plus an
immediate smoke test.
**Who:** You (Supabase dashboard access to the confirmed Production project from #1).
**Dev team does:** Nothing further — already done. Available to walk through the smoke-test steps
with you live if wanted (Studio upload/reload, submit a quote with a file, view as admin, download
its ZIP).
**Verified by:** Those four smoke-test steps all still work right after the flip.

---

## 5. Production Square configuration — independent, can run anytime

**Needed:** In the Vercel dashboard, confirm `NEXT_PUBLIC_SQUARE_ENVIRONMENT` for Production is
actually set to `production` (not `sandbox`) — the key exists, its value hasn't been read or
changed by this engagement. Separately, confirm in Square's own dashboard that the webhook
subscription URL matches Production's `SQUARE_WEBHOOK_NOTIFICATION_URL` exactly and is subscribed
to payment/order events.
**Who:** You (Vercel + Square dashboard access).
**Dev team does:** Nothing — pure configuration confirmation, no code involved.
**Verified by:** The one real payment test in #6 below (this is what that test is actually
checking).

---

## 6. Real Canadian-card payment + refund verification — do this last, after #1, #4, #5

**Needed:** You (or someone you designate) place one real order, with a real card, for a small
refundable amount, through each fulfillment path you're launching with (at minimum Ottawa pickup).
**Who:** You. This is the one step in the entire launch sequence that touches real money — it
needs your deliberate, in-the-moment approval, not a standing authorization.
**Dev team does:** Available to watch logs/webhook delivery alongside you in real time if wanted.
**Verified by:** The amount actually charged matches the order total exactly; the order
confirmation page and email both show correct figures; the webhook fires and is recorded; the
uploaded artwork is retrievable from the now-private bucket; **and — the specific thing this
round's investigation flagged — your real card's billing postal code is accepted correctly by
Square's payment form** (confirmed Sandbox can't test this at all; a real Canadian card in live
mode is the only way). Then refund the test charge through the Square dashboard.

---

## 7. Supplier image permissions — independent, lowest priority, not a checkout blocker

**Needed:** Send the two pre-drafted outreach emails to SanMar and S&S Activewear (full text in
`docs/owner-handoff-checklist.md` §2) asking permission to display/rehost their product photos.
**Who:** You (whoever holds each wholesale account).
**Dev team does:** Nothing until a supplier responds — the website already handles missing photos
honestly today (a styled placeholder with the real product name, never a broken image or a fake
photo), so this doesn't block launch at all.
**Verified by:** Real product photos start appearing for that supplier's items once permission is
granted and images are added.

---

## Dependencies at a glance

```
1 (Supabase access) ──┬──> 4 (private bucket)
                       └──> 6 (real-card test)
2 (tax)  ─────────────────> 6 (real-card test, if testing real tax)
3 (packaging+origin) ─────> 6 (real-card test, if testing real shipping)
5 (Square config)    ─────> 6 (real-card test)
7 (supplier images)   ─ independent of everything, anytime
```

Items 1, 2, 3, 5, and 7 can all start **today, in parallel** — none of them block each other.
Item 4 needs item 1 done first. Item 6 is always last, and needs 1, 4, and 5 done; it only needs
2 and/or 3 done if you want to test real tax and/or real shipping in that same payment (see below).

## Two launch paths (your choice, not a technical constraint)

**Path A — launch sooner, with honest interim limits:** Resolve 1, 4, 5 and run the real-card
test (#6) while tax stays $0 and shipping stays free/flat. Both are deliberate, safe, already-
coded defaults — not bugs. Activate real tax (#2) and real shipping (#3) later, each as its own
small, separate, reviewed change, whenever you're ready.

**Path B — launch once everything is real:** Resolve all of 1–5 first, then run #6 once to verify
the complete, final experience in one pass.

Neither path is "more correct" — it's a business timing decision.

## Go / no-go checklist for enabling real customer checkout

- [ ] Production `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, pointed at the
      confirmed real Production project
- [ ] `NEXT_PUBLIC_SQUARE_ENVIRONMENT` confirmed `production` in the Vercel dashboard
- [ ] Square's Production webhook subscription URL confirmed matching
- [ ] `design-uploads` bucket flipped to private + smoke-tested
- [ ] Tax posture is a deliberate choice (real HST confirmed registered, or knowingly $0 for now)
- [ ] Shipping posture is a deliberate choice (real Chit Chats rate active, or knowingly free/flat
      for now)
- [ ] One real, refunded Canadian-card payment completed and verified (§6) — including that the
      card's billing postal code was accepted correctly
- [ ] `OWNER_NOTIFICATION_EMAIL` decision made (a real address, or knowingly left unset)

**All eight checked → ready to announce launch.** Any unchecked box is a known, named gap, not a
surprise — you decide if it's acceptable to launch with that gap open (e.g. no owner-alert emails
yet) or whether it blocks you specifically.

## Remaining risk if you launch today, unchanged

Production would currently fail closed on the missing Supabase env vars (item 1) before any
customer could complete anything — this is "loud and safe," not "silent and wrong": the app
refuses rather than serving broken pages. Once item 1 is fixed, Production would correctly serve
real customers with $0 tax and free shipping (by design, not accident) until items 2/3 are
resolved.
