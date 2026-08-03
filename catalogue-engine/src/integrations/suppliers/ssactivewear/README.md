# S&S Activewear Canada connector — verification log

Written 2026-08-02, after building and testing this connector against the LIVE API using
MapleImprint's real dealer account (account C05087, obtained by enabling "Integrations
(API/Promostandards)" under My Account → Manage Web Users → Manage Permissions, then reading the
key from My Account → API Key → Show).

This is not generic documentation — every claim below was checked with a real `curl` call during
this session. If S&S changes their API later, re-verify rather than trusting this file blindly.

## Auth

HTTP Basic Auth. Username = account number (`C05087`), password = the API key. Both Canadian
(`api-ca.ssactivewear.com`) and US (`api.ssactivewear.com`) endpoints exist; MapleImprint is a
Canadian dealer, so this connector only targets `api-ca.ssactivewear.com/v2`.

## Confirmed working

- `GET /v2/categories/` — full category list, ~35KB, fast. Used for `healthCheck`/`authenticate`.
- `GET /v2/styles/` — full style catalogue, ~1092 styles total, ~35KB with no field filtering
  quirks observed on this smaller endpoint.
- `GET /v2/products/?style=12618` — SKU-level rows for one style. Confirmed field shape (see
  sample below).
- `GET /v2/products/?style=12618,16029` — **comma-separated batching works**, confirmed returns
  rows for both styles in one call.
- Rate limit: 60 requests/minute (from S&S's own marketing page; not independently pushed to the
  limit, so treat that number as a ceiling, not a target).

## Confirmed NOT working (important — do not re-attempt without a reason)

- `GET /v2/products/?sku=B12253503` → returned **HTTP 200 with the entire ~80MB catalogue**, not
  a filtered result. The `sku` param is silently ignored.
- `GET /v2/products/?skuid=4884344` → same behaviour, full catalogue, ignored param.
- `GET /v2/products/?nonsenseparam=xyz` → same behaviour. Confirms `/products/` has exactly one
  working filter: `style=`. Anything else is ignored, not rejected — there's no error to catch,
  it just silently returns everything, which is dangerous if you're not expecting it.
- `fields=` query param on `/products/` did **not** reliably restrict returned fields — some
  requested fields were dropped, some unrequested fields still appeared. Do not rely on it to
  shrink payloads; always parse the full row shape.

## Sample verified response shape (products endpoint, one row)

```json
{
  "sku": "B12253503",
  "gtin": "00197611827093",
  "skuID_Master": 4884344,
  "styleID": 12618,
  "brandName": "Adidas",
  "styleName": "A2009",
  "colorName": "Black",
  "sizeName": "S",
  "mapPrice": 110.00,
  "retailPrice": 110.00,
  "piecePrice": 65.00,
  "customerPrice": 65.00,
  "qty": 292,
  "colorFrontImage": "Images/Color/115711_f_fm.jpg",
  "colorBackImage": "Images/Color/115711_b_fm.jpg",
  "colorSwatchImage": "Images/ColorSwatch/38918_fm.jpg",
  "warehouses": [
    { "warehouseAbbr": "BC", "qty": 134, "closeout": false },
    { "warehouseAbbr": "ON", "qty": 158, "closeout": false }
  ]
}
```

`customerPrice` was used as `wholesaleCost` because it's account-specific (this dealer's actual
negotiated cost), distinct from `mapPrice`/`retailPrice` which are supplier-set list prices. In
this one sample they happened to be equal to `piecePrice`/`dozenPrice`/`casePrice`/`salePrice` —
that may not hold for every product; `customerPrice` is still the right field because it's the
one tied to *this* account rather than a generic list price.

## Images

Relative paths like `Images/Color/115711_f_fm.jpg` are served from `https://cdn.ssactivewear.com/`
— confirmed with a direct `curl -o /dev/null` returning HTTP 200.

## What this connector does NOT do yet

- **Order placement** (`submitOrder`) — the endpoint exists (`POST /v2/orders/`, referenced in
  S&S's own docs pages) but was never called, because a real call places a real order on
  MapleImprint's live account. Throws `NotImplementedError`. Whoever picks this up should test
  against a throwaway low-cost item first, not a real customer order.
- **Shipment tracking** (`getShipmentStatus`) — same reasoning, untested, throws
  `NotImplementedError`.
- **Single-SKU lookup without a styleID** — genuinely not possible with this API as it exists
  today (see "Confirmed NOT working" above). `checkLiveAvailability` requires the caller to pass
  the composite `{styleID}:{sku}` id (same string produced as `supplierVariantId` during a
  catalogue sync), not a bare SKU.

## Category mapping (`baseCategory` -> site productType)

Pulled the full live `/styles/` list and counted every distinct `baseCategory` value
(2026-08-02/03) — this is the real, complete distribution, not a guess:

| baseCategory | count | mapped to |
|---|---|---|
| Outerwear | 197 | `jacket` |
| T-Shirts - Premium | 162 | `t_shirt` |
| Polos | 153 | `polo` |
| Knits & Layering | 115 | *(not mapped — no clean fit to a site subcategory)* |
| Headwear | 100 | `headwear` (split into caps/beanies by product name at export time) |
| Wovens | 71 | *(not mapped — no clean fit)* |
| T-Shirts - Long Sleeve | 61 | `t_shirt` |
| Fleece - Premium - Hood | 59 | `hoodie` |
| Bottoms | 48 | *(not mapped — no site subcategory for this)* |
| Bags | 43 | `bag` |
| Fleece - Premium - Crew | 37 | `crewneck` |
| Accessories | 16 | *(not mapped — too vague, no site subcategory)* |
| Fleece - Core - Hood | 13 | `hoodie` |
| T-Shirts - Core | 10 | `t_shirt` |
| Fleece - Core - Crew | 6 | `crewneck` |
| Office Use | 1 | *(not mapped — irrelevant)* |

See `catalogue-engine/scripts/route-map.mjs` for where this becomes an actual site
category/subcategory, and the mapping table in `SSActivewearConnector.ts`
(`BASE_CATEGORY_TO_PRODUCT_TYPE`) for where the raw string becomes a `productType`.

## Credentials

Live in `catalogue-engine/.env` (git-ignored), not in this file. See that file's comments for
which env vars hold what.
