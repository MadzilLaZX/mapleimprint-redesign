# Maple Imprint launch-readiness report

As of `checkout-square-payments` @ `2a7bbef` (last Preview-verified commit as of this writing).

## Verified working (tested, not assumed)

- Homepage, navigation, Shop grid, category pages, product pages.
- Custom Product Studio: drinkware 2D (flat wrap) + 3D (rotatable mug), apparel print-zone
  placement, layers, and pricing calculation -- all confirmed on live Preview.
- Cart and checkout: subtotal, shipping, tax, and total calculations all correct.
- Request a Quote: 7-step guided wizard loads and renders correctly.
- Square payment integration: SDK loads, card fields render, correct total shown. No real payment
  has been submitted at any point -- verified up to (not including) submission.
- Payment-consistency function (`mark_order_paid_and_sync_attempt`): atomic, restricted to
  `service_role` only (anon key confirmed blocked with a clean permission error, re-verified
  fresh), true concurrency-safe (two simultaneous calls for the same order always produce exactly
  one winner, verified against synthetic data).
- Admin authentication and order management: unauthenticated access correctly redirects to login;
  authenticated view shows all 3 real orders with correct statuses.
- Customer design/artwork persistence: zero broken references across all order/quote lines in the
  live database; zero frozen designs missing their snapshot; zero broken asset URLs.
- Mobile responsiveness: homepage and checkout both render cleanly at 390x844.
- Canada Post and GST/HST tax remain correctly inactive (`FreeShippingProvider` /
  `ZeroTaxProvider`), confirmed live on Preview.

## Blocked on external parties (not resolvable by further Claude work)

| Blocker | What's needed | Owner |
|---|---|---|
| S&S Activewear image access | Supplier response on Cloudflare 403 / PromoStandards Media Content access -- drafted request awaiting your send | S&S Activewear |
| Canada Post activation | Developer account + API credentials + ship-from address confirmation | You / Canada Post |
| GST/HST tax activation | Registration status confirmation from an accountant | You / accountant |
| Vercel API access for Claude | Dashboard-level reconnection -- currently works via manual dashboard actions only | You / Vercel |

## Blocked on a business decision (ready to execute the moment you decide)

| Decision | What happens if you approve | Document |
|---|---|---|
| Unpublish 13 orphaned products | `status`/`isPublished` flip to hidden; fully reversible; zero customer-facing data touched | `orphaned-products-before-after.md` |
| Apply migration 008 (weight columns) | Purely additive schema change; no data written until a separate backfill step also runs | `canada-post-activation-plan.md` |
| Regenerate `products.json` | Static catalogue picks up the SanMar description fix; needs a real `DATABASE_URL` | `regenerate-products-json.md` |
| `OWNER_NOTIFICATION_EMAIL` | Currently unset by deliberate prior decision -- confirm that's still intended before launch | `production-deployment-checklist.md` |

## The single largest customer-facing gap at today's state

If Production were promoted right now, the Shop grid's default view and most of the homepage
Featured Products rail would show "Image coming soon" for roughly 78% of the apparel catalogue
(every S&S-sourced product), because the supplier's CDN still blocks image requests. This is the
one item most worth resolving, or at minimum consciously accepting, before a real launch --
everything else in this report is either already working or waiting on a decision/credential that
doesn't block the site from functioning correctly in the meantime.

## Recommendation

Technically, the checkout/payment/order pipeline is solid and verified. The one thing standing
between "technically launchable" and "a good first impression" is the S&S image situation. The
rest of this document's blockers are real but lower-stakes (tax/shipping can stay in their
current safe, inactive state indefinitely without harming a launch; the orphaned products are
clutter, not a functional problem).
