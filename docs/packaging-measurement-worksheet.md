# Packaging measurement worksheet

Fill this in with a tape measure and a scale — one sheet per box/mailer you actually use to ship a
customer order. Nothing on this sheet is used until you (or whoever enters the data) copies it
into `src/lib/checkout/packagingProfiles.ts`. No measurement here is invented or estimated by the
system — every blank below must come from a real box in your hands.

## How to measure (do this once per box style)

1. Pack the product the way you'd normally ship it (folded shirt in its mailer, mug in its gift
   box with the usual cushioning, etc.) and seal it like a real shipment.
2. **Outer dimensions**: lay it flat/upright as it would travel. Measure length × width with a
   tape measure in inches, and the sealed thickness/height. Round UP to the nearest 1/4 inch —
   carriers rate on the outside of the box, and a box measured slightly small under-quotes the
   real cost.
3. **Empty weight**: weigh the box/mailer itself, empty, with any padding/tissue/insert it always
   ships with — no product inside. Use a kitchen or shipping scale; switch it to pounds, or divide
   grams by 454.
4. **Max units per package**: physically test how many of that product fit in this exact box
   without forcing it or exceeding what you'd actually ship in one parcel. A whole number, never a
   guess.
5. **Max weight cap**: a safety ceiling for this box — if the count above would still be
   impractically heavy for this box/mailer, this number should come in below the count-based
   limit, not above it.

---

## Worksheet — T-shirt / light apparel (poly mailer)

| Field | Your measurement |
|---|---|
| Box/mailer description | _______________________________ |
| Outer length (in) | _______ |
| Outer width (in) | _______ |
| Outer height / thickness (in) | _______ |
| Empty weight (lb) | _______ |
| Max shirts per mailer | _______ |
| Max weight cap (lb) | _______ |
| Measured by | _______________________________ |
| Date measured | _______________________________ |

## Worksheet — Hoodie / heavier clothing (box or reinforced mailer)

| Field | Your measurement |
|---|---|
| Box/mailer description | _______________________________ |
| Outer length (in) | _______ |
| Outer width (in) | _______ |
| Outer height / thickness (in) | _______ |
| Empty weight (lb) | _______ |
| Max hoodies per box | _______ |
| Max weight cap (lb) | _______ |
| Measured by | _______________________________ |
| Date measured | _______________________________ |

## Worksheet — Mug (rigid box, real cushioning — never a poly mailer)

| Field | Your measurement |
|---|---|
| Box description | _______________________________ |
| Outer length (in) | _______ |
| Outer width (in) | _______ |
| Outer height (in) | _______ |
| Empty weight (lb, box + insert, no mug) | _______ |
| Max mugs per box (usually 1, unless a specific multi-mug box) | _______ |
| Max weight cap (lb) | _______ |
| Measured by | _______________________________ |
| Date measured | _______________________________ |

## Worksheet — Tumbler (rigid box, taller than a mug box)

| Field | Your measurement |
|---|---|
| Box description | _______________________________ |
| Outer length (in) | _______ |
| Outer width (in) | _______ |
| Outer height (in) | _______ |
| Empty weight (lb) | _______ |
| Max tumblers per box | _______ |
| Max weight cap (lb) | _______ |
| Measured by | _______________________________ |
| Date measured | _______________________________ |

## Worksheet — blank (copy for any other product category)

| Field | Your measurement |
|---|---|
| Product category | _______________________________ |
| Box/mailer description | _______________________________ |
| Outer length (in) | _______ |
| Outer width (in) | _______ |
| Outer height / thickness (in) | _______ |
| Empty weight (lb) | _______ |
| Max units per package | _______ |
| Max weight cap (lb) | _______ |
| Measured by | _______________________________ |
| Date measured | _______________________________ |

---

## After filling in a sheet

1. Open `src/lib/checkout/packagingProfiles.ts`.
2. Add one entry to `PACKAGING_PROFILES` using the numbers from your sheet (that file's own header
   comment has a ready-to-copy template per category — fill in the real numbers, delete the
   `/* MEASURE ME */` markers).
3. Add one entry to `PRODUCT_PACKAGING_ASSIGNMENTS` mapping the real product to that profile.
4. Run `npm test` — a dedicated check (`packagingProfiles.test.ts`'s "LIVE GATE" tests) will
   automatically verify every number you entered is a real, positive, sane value before anything
   else happens. If a field was left blank or mistyped as `0`, the test will fail and name the
   exact field — nothing silently reaches a real customer quote with a placeholder value still in
   it.

This is intentionally a one-way gate: a box that fails validation behaves exactly like no box
existing at all (the order routes to a manual "Request a Shipping Quote," never a fabricated or
zero-dimension rate).

---

## Cost validation (do this once, right after your first profile goes live)

The $300 free-shipping threshold is a fixed dollar amount — it does NOT look at how much the real
carrier rate actually costs. A heavier or bulkier order that still qualifies (e.g. several hoodies
totalling $310) gets its real shipping cost absorbed by Maple in full, however much that turns out
to be. There is no second, separate cap on the absorbed cost today — only the unit/weight limits
you set on each box profile above indirectly control how large an order can ever reach this path.

**Once your first profile is live and quoting real rates** (see
`docs/chit-chats-real-rate-test-plan.md`), note the real quoted cost here for a sanity check before
trusting the $300 number at scale:

| Product / profile | Order subtotal tested | Real quoted shipping rate | Destination used | Notes |
|---|---|---|---|---|
| _______________ | $_______ | $_______ | _______________ | _______________ |
| _______________ | $_______ | $_______ | _______________ | _______________ |

If a realistic order near $300–350 is quoting a shipping cost that eats an uncomfortable chunk of
that order's margin, that's a signal to revisit either the $300 threshold itself or the
`maxUnitsPerPackage`/`maxWeightLbPerPackage` caps on that profile — both are business decisions,
not something the code will flag or cap on its own.
