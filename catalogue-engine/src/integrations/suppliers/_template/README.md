# Building a real supplier connector

This is the step-by-step for turning `TemplateConnector.ts` into a working connector once a
supplier grants API/account access (SanMar or S&S first, per the architecture doc).

## 0. Before writing any code

- [ ] Get the API/feed documentation link from the supplier (ask their support/account rep if it
      isn't obvious in the wholesale portal).
- [ ] Confirm what kind of integration it actually is: REST API, SOAP, a scheduled CSV/XML feed
      (FTP or download link), or something else. The steps below assume a REST API — a file-feed
      connector follows the same contract but replaces HTTP calls with a file-parsing step.
- [ ] Confirm rate limits, pagination behavior, and authentication method (static key vs. OAuth).
- [ ] Confirm what currency prices are returned in.
- [ ] Confirm whether product images can legally be downloaded/redistributed under the wholesale
      account's terms (architecture doc §"Image Integration Strategy") — a technical question and
      a legal/business question, don't skip the second one.

## 1. Copy the template

```bash
mkdir src/integrations/suppliers/<supplier-code>
cp src/integrations/suppliers/_template/TemplateConnector.ts src/integrations/suppliers/<supplier-code>/<SupplierName>Connector.ts
```

Use the exact `code` value already seeded in the `Supplier` table (`sanmar`, `ss_activewear`,
`joto`, `conde`) for `supplierCode`.

## 2. Fill in one method at a time, in this order

1. **`authenticate()`** — get this working first and prove it with a throwaway script before
   touching anything else. If it's a static API key, this can be nearly a no-op; if it's
   OAuth-style, cache the token and its expiry on the instance.
2. **`healthCheck()`** — the simplest real call you can make (fetch account info, or one known
   product). This becomes your fastest feedback loop for "is auth actually working."
3. **`fetchProductCatalogue()`** — the most important method. Map the supplier's native field
   names into `RawSupplierProduct`/`RawSupplierVariant`/`RawSupplierImage` from `../contract.ts`.
   This is the **only** place in the codebase that should ever read a field like `styleID` or
   `partNumber` — if you find yourself doing that anywhere else, the abstraction has leaked.
4. **`fetchInventory()` / `fetchPricing()`** — check the docs for a batch endpoint before looping
   over variant ids one at a time; a real catalogue has thousands of variants and one-by-one calls
   will hit rate limits immediately.
5. **`checkLiveAvailability()`** — keep this fast and narrow (single SKU). This is the one method
   called synchronously during checkout, not from a background job.
6. Leave `submitOrder()`/`getShipmentStatus()` throwing `NotImplementedError` — that's Phase 8
   territory, well after catalogue/pricing/inventory sync is proven.

## 3. Test it against the real pattern already proven with the mock connector

`test/orchestrator.integration.test.ts` and `test/dedup-review-queue.integration.test.ts` already
prove the sync pipeline works end-to-end using `MockConnector`. Once your real connector's
`fetchProductCatalogue()`/`fetchPricing()` work, write the equivalent test with your real
connector substituted for `MockConnector` — the rest of the pipeline (`runPriceSync`, dedup
matcher, safety-stop thresholds) needs zero changes.

Start with a **small, controlled import** — a handful of known SKUs, not the full catalogue —
and manually compare the result against what you see in the supplier's own portal before trusting
a full sync.

## 4. Wire in credentials safely

- Store the real API key/token in an environment variable (`.env`, git-ignored) locally, and in a
  proper secrets manager in any real deployment — never in code, never in `Supplier.credentialsRef`
  directly (that column is a *pointer* to where the secret lives, not the secret itself).
- Update the `Supplier` row's `integrationType` and `integrationStatus` once the connector is live.

## 5. Confirm before expanding scope

- [ ] Product count roughly matches what you see in the supplier's portal.
- [ ] A handful of prices/images spot-checked manually match.
- [ ] Inventory numbers are plausible (not all zero, not obviously stale).
- [ ] A deliberately-bad scenario (e.g. temporarily revoke the API key) produces a `failed` sync
      job with a clear `errorSummary`, not a silent hang or a crash.

Only after all of that should a full catalogue sync be scheduled.
