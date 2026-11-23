// Explicit .ts extension -- required for plain `node --test` (this file's own test imports it
// directly), matching the convention already used throughout this package. A type-only import
// cycle already existed in the other direction (chitChatsShippingProvider.ts imports this file's
// *types*); importing the real class here is safe since that existing import is `import type`,
// erased entirely at compile time -- there is no runtime circular dependency.
import { ChitChatsShippingProvider } from "./chitChatsShippingProvider.ts";
import { ChitChatsQuoteCoordinator } from "./chitChatsQuoteCoordinator.ts";
import { SupabaseChitChatsQuoteStore } from "./chitChatsQuoteStore.ts";
import { createAdminClient } from "@/lib/server/supabaseAdmin";

export interface ShippingAddressInput {
  province: string;
  country: string;
  postalCode: string;
  /** Optional -- today's /api/checkout/quote only collects province/country/postalCode (a
   *  lightweight pre-address-entry preview), while /api/checkout/pay has the full delivery
   *  address by the time it runs. These extra fields exist so a richer provider (e.g.
   *  ChitChatsShippingProvider, which needs a full street address to request a real quote) can
   *  use the SAME shared interface rather than a parallel one -- it validates their presence
   *  itself and fails clearly (ShippingRateUnavailableError) when they're missing, rather than
   *  this type silently promising data that isn't always there. */
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
}

export interface ShippingOption {
  id: string;
  label: string;
  cents: number;
}

/** The minimal per-line shape a shipping quote needs -- a subset of PricedCartLine, so this
 *  module doesn't need to import checkout's full cart-line type just to read these fields. */
export interface ShippingQuoteLine {
  unitWeightLb: number | null;
  quantity: number;
  /** Stable catalogue identifier (see packagingProfiles.ts's `buildProductId()`), for looking up
   *  a real, owner-measured packaging profile. Optional -- existing callers/tests that don't
   *  supply it behave exactly as before (ChitChatsShippingProvider treats a missing id on any
   *  line the same as "packaging can't be determined for this cart," never a crash). Null for a
   *  line whose underlying catalogue product can no longer be resolved (e.g. a CUSTOM design
   *  frozen against a product since removed) -- same "unknown, don't guess" meaning as null. */
  productId?: string | null;
}

// subtotalCents is accepted (not yet used by FreeShippingProvider) so a real carrier provider can
// implement this same interface directly -- activating one becomes swapping the export below, not
// a signature change propagated through every call site. `lines` was added alongside
// unitWeightLb landing on PricedCartLine -- a real provider needs per-line weight to call
// estimateParcelWeightLb(); FreeShippingProvider ignores both.
export interface ShippingQuoteProvider {
  getOptions(address: ShippingAddressInput, subtotalCents: number, lines: ShippingQuoteLine[]): Promise<ShippingOption[]>;
}

/**
 * Production-only placeholder — see `resolveShippingProvider` below for why Production stays here
 * while Preview/dev run the real `ChitChatsShippingProvider`. Ships EVERY order free, with NO
 * threshold, NO weight/value cap, and NO destination check beyond what `ShippingAddressInput`
 * itself requires. That is NOT the same thing as "free shipping" being Maple's approved policy —
 * the owner confirmed a narrower one on 2026-11-12 (standard delivery free only on eligible
 * Canadian orders over $300, after a real carrier rate confirms serviceability; see
 * `chitChatsShippingProvider.ts`'s header and `FREE_SHIPPING_THRESHOLD_CENTS`) and approved
 * (2026-11-22) implementing it for real in Preview — this class is deliberately NOT that
 * implementation, it's what Production keeps using until a separate, deliberate decision moves
 * Production onto the real policy too (see `resolveShippingProvider` below).
 *
 * PRODUCTION LAUNCH BLOCKER: going live on this class as-is means every Production order ships
 * free regardless of size, with no cap. That gap is real and ongoing, not hypothetical, for as
 * long as Production stays on this branch of `resolveShippingProvider`.
 */
class FreeShippingProvider implements ShippingQuoteProvider {
  async getOptions(_address: ShippingAddressInput, subtotalCents: number): Promise<ShippingOption[]> {
    // Deliberately unconditional and side-effect-only (never changes the result, never throws) —
    // a plain audit trail so Production exposure to this gap (see header above) is at least
    // observable in logs (e.g. via a Vercel log drain) rather than silent, without this codebase
    // inventing a cap, a paid rate, or refusing an order on its own authority.
    console.info(`[shipping] Free Shipping granted (no threshold active) for subtotalCents=${subtotalCents}`);
    return [{ id: "free", label: "Free Shipping", cents: 0 }];
  }
}

/**
 * The per-environment gate, mirroring `taxProvider.ts`'s `resolveTaxProvider` exactly: a plain,
 * directly-testable function (never reading `process.env` itself) so any future change is a
 * one-line edit to a branch below, reviewed via a real commit — never an env var or Vercel
 * dashboard setting an owner could flip by accident.
 *
 * ACTIVATED 2026-11-22 (owner-approved) for Preview/dev only: `ChitChatsShippingProvider` already
 * implements the confirmed policy correctly (orders at/under $300 get the real calculated rate;
 * orders over $300 get it free, but ONLY after that same real rate request succeeds and confirms
 * the destination is serviceable; any failure — unreachable carrier, unsupported destination, or
 * today, for every real cart, missing package dimensions — throws `ShippingRateUnavailableError`
 * rather than ever falling back to a fabricated free or invented rate). Both checkout API routes
 * already catch that error and surface a "request a shipping quote" path (see
 * CheckoutClient.tsx) instead of silently completing checkout.
 *
 * Concretely, until a real `packagingProfiles.ts` entry exists for at least one product, EVERY
 * delivery quote in Preview will hit the dimensions-required refusal (`fetchChitChatsRates`'s own
 * preflight check) and route to a manual quote — Ottawa pickup is unaffected (it never calls this
 * provider at all). That is the correct, honest behavior given no real packaging data exists yet,
 * not a bug: see packagingProfiles.ts's header for how to add a real, measured profile, at which
 * point real Chit Chats rate requests will actually start flowing for that product, in Preview
 * only, using the real Chit Chats account (there is no staging sandbox for Chit Chats itself —
 * see chitChatsShippingProvider.ts's header) — always as an unpurchased, deletable draft shipment,
 * never postage, per this codebase's standing "no real shipments without approval" rule.
 *
 * Production stays on `FreeShippingProvider` until a separate, deliberate edit to that branch
 * follows a real Production-activation decision — exactly like `resolveTaxProvider`'s
 * Production/non-Production split.
 */
/**
 * ACTIVATED (this round) now that supabase/migrations/010_chit_chats_shipping_quotes.sql is
 * confirmed applied to staging -- chitChatsQuoteCoordinator.ts's own prior header literally named
 * "the table hasn't been created" as the reason this was never wired in; that's no longer true for
 * staging. Fails SOFT, never hard: if SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL aren't
 * available when this runs (local `npm test`/`npm run dev` without them, confirmed true in this
 * sandbox -- or any other environment misconfiguration), this returns undefined and
 * ChitChatsShippingProvider behaves EXACTLY as before: in-memory-only caching, no crash, no
 * behavior change. Reconciler stays the coordinator's own honest "unknown" default -- building a
 * real one would mean a NEW live Chit Chats API call path, out of scope here. */
export function buildCoordinator(): ChitChatsQuoteCoordinator | undefined {
  try {
    const supabaseAdmin = createAdminClient();
    return new ChitChatsQuoteCoordinator(new SupabaseChitChatsQuoteStore(supabaseAdmin));
  } catch (err) {
    console.error(
      "[shipping] couldn't construct the persistent Chit Chats quote coordinator -- falling back to in-memory-only caching:",
      err,
    );
    return undefined;
  }
}

export function resolveShippingProvider(vercelEnv: string | undefined): ShippingQuoteProvider {
  if (vercelEnv === "production") {
    return new FreeShippingProvider();
  }
  return new ChitChatsShippingProvider(undefined, undefined, buildCoordinator());
}

export const shippingProvider: ShippingQuoteProvider = resolveShippingProvider(process.env.VERCEL_ENV);
