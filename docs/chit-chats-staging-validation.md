# Chit Chats staging validation procedure

Not run this round — no staging credentials exist in this codebase, and this is explicitly a
"prepare, don't execute" task. This is the exact sequence someone with a Chit Chats account should
run once staging credentials and explicit test authorization exist, to validate the assumptions
`chitChatsShippingProvider.ts` / `chitChatsQuoteCoordinator.ts` are built on before any Production
activation.

## 0. Prerequisites

- A Chit Chats account with API access enabled (Settings > Developer > API Access Tokens).
- The account's **Client ID** (every endpoint is scoped under `/clients/<CLIENT_ID>/`).
- Confirm whether `https://staging.chitchats.com` uses the **same** token/client ID as production,
  or its own — **this is not documented** (see Finding 1 below). Test this first; if staging
  requires separate credentials, generate them from the staging site's own Settings page, not
  production's.

## 1. Authenticate (read-only sanity check)

```
curl -s -H "Authorization: $ACCESS_TOKEN" \
  https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments?limit=1
```

Expect: `200` with a (possibly empty) `shipments` array. A `401` means the token/client ID pair is
wrong, or staging genuinely needs separate credentials from production (see Finding 1).

## 2. Create an unpurchased draft shipment

```
curl -s -X POST -H "Authorization: $ACCESS_TOKEN" -H "Content-Type: application/json" \
  https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments \
  -d '{
    "name": "Test Recipient",
    "address_1": "123 Test St",
    "city": "Toronto",
    "province_code": "ON",
    "postal_code": "M5V 2T6",
    "country_code": "CA",
    "value": "10.00",
    "value_currency": "cad",
    "package_type": "parcel",
    "weight_unit": "lb",
    "weight": "1.0",
    "size_unit": "in",
    "size_x": "10", "size_y": "10", "size_z": "10",
    "description": "Staging validation test parcel",
    "postage_type": "unknown",
    "order_id": "staging-validation-test-001"
  }'
```

Verify:
- `201 Created`, response `status` is `"pending"` (per the docs: *"Shipment is in the process of
  being created by the client"*).
- `postage_label_png_url` / `_pdf_url` / `_zpl_url` are `null` — confirms no postage has been
  purchased by this call alone.
- `order_id` in the response echoes back exactly `"staging-validation-test-001"`.
- **Record the returned shipment `id`** for steps 4-6.

This is also where `ChitChatsShippingProvider`'s real (non-stub) rate fetcher implementation would
set `order_id` to the quote's fingerprint (`buildQuoteFingerprint()`) — confirm the field accepts
an arbitrary string of that length/shape (a 64-character hex SHA-256 digest) without truncation or
rejection.

## 3. Confirm real rates were returned

Check the same response's `rates` array. Verify each entry has at minimum `postage_type`,
`postage_description`, `delivery_time_description`, and `purchase_amount` (the customer-facing
price `ChitChatsShippingProvider` maps into a `ShippingOption`). Confirm `purchase_amount` is a
sane dollar string for a 1 lb domestic parcel (sanity check, not a strict assertion).

## 4. Look up the shipment by `order_id` (the reconciliation mechanism)

```
curl -s -H "Authorization: $ACCESS_TOKEN" \
  "https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments?q=staging-validation-test-001"
```

**This is the step that determines whether `ChitChatsQuoteCoordinator`'s reconciliation hook can
ever move past its current default "unknown" answer.** The docs document `q` as *"Full text
searching of shipments by id, to_name, or order_id"* — confirmed to exist, but its real matching
behavior against a long, high-entropy string (our fingerprint is a 64-char SHA-256 hex digest, not
a short human-typed order number) is **not confirmed**. Specifically check:
- Does `q=<the exact order_id>` return exactly one result (the shipment from step 2), or does full-
  text tokenization break on a 64-char hex string (e.g. splitting it into substrings and matching
  too broadly, or not matching at all)?
- Does a **prefix** of the fingerprint (e.g. the first 16-32 hex characters) match more reliably if
  the full string doesn't? If so, that's the adjustment to make before implementing a real
  reconciler — truncate the fingerprint used as `order_id`, not the one used as the database key.
- Repeat with a second, unrelated shipment's `order_id` present in the account to confirm `q`
  doesn't return false positives across different orders.

If this works cleanly: `chitChatsQuoteCoordinator.ts`'s reconciler can be implemented for real,
replacing the conservative default. If it does not reliably disambiguate, the recommended fallback
is below (see "If order_id lookup proves unreliable").

## 5. Refresh the draft shipment

```
curl -s -X PATCH -H "Authorization: $ACCESS_TOKEN" -H "Content-Type: application/json" \
  https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments/$SHIPMENT_ID/refresh \
  -d '{"weight_unit": "lb", "weight": "1.5"}'
```

Verify: `200`, the shipment's `weight` is updated, `rates` reflects the new weight (should be
somewhat higher than step 3's quote). Confirm this does NOT purchase postage (`postage_label_*_url`
still `null`).

## 6. Delete the unpurchased draft shipment

```
curl -s -X DELETE -H "Authorization: $ACCESS_TOKEN" \
  https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments/$SHIPMENT_ID
```

Verify: `204 No Content`. Then confirm it's actually gone:

```
curl -s -H "Authorization: $ACCESS_TOKEN" \
  https://staging.chitchats.com/api/v1/clients/$CLIENT_ID/shipments/$SHIPMENT_ID
```

Expect `404`.

## 7. Confirm no charge occurred

Check the Chit Chats staging account's own billing/credits page (or, per their docs, add test
credits via the `4242 4242 4242 4242` test card) before and after steps 2-6 — balance must be
unchanged. No step above ever calls `PATCH /shipments/{id}/buy`, which is the only endpoint that
purchases postage — deliberately not exercised by this procedure or by any code in this repo.

## Findings from documentation review (this round)

1. **Staging credential process is not documented separately from production.** Confirm empirically
   at step 1 whether the same token/client ID pair works on both hosts, or whether staging needs
   its own.
2. **`order_id` IS searchable** via the `q` full-text parameter on `GET /shipments` (*"Full text
   searching of shipments by id, to_name, or order_id"*) — this is a real, confirmed mechanism,
   stronger than this engagement's earlier assumption that no such lookup existed. Its reliability
   against a long hex fingerprint specifically is the open question step 4 above resolves.
3. **No explicit "purchased" flag** exists in the shipment schema beyond `status` transitioning to
   `"ready"` and the postage label URLs populating — both documented as consequences of purchase,
   not duplicated as a dedicated boolean. `purchasePostageForQuote()` in this codebase relies on its
   own `MapleOrder`/`ChitChatsShippingQuote.purchasedAt` column for this, not a Chit Chats field, so
   this doesn't block anything already built.

## If `order_id` lookup proves unreliable

Fall back to a **manual-intervention, no-automatic-recovery** policy: on a stale/possibly-crashed
claim, always return the conservative "unknown" result (already this codebase's default) rather
than guessing. The practical cost is that a crashed worker's fingerprint stays blocked until its
full quote TTL (10 minutes) naturally expires and the row is cleaned up — a customer retrying
within that window gets a clear "try again shortly" error (already implemented), not a duplicate
shipment. This is already the safe behavior `chitChatsQuoteCoordinator.ts` falls back to today; no
code change would be needed to adopt this permanently if step 4 above doesn't pan out.
