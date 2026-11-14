import { BUSINESS } from "@/lib/constants";

/**
 * The single source of truth for "where is Ottawa local pickup" and "when can a customer collect
 * their order" -- reuses BUSINESS (src/lib/constants.ts), the same real, already-publicly-shown
 * address and hours displayed on the site footer/contact page today. Nothing here is invented:
 * this is existing, confirmed site content, not a guess at a pickup-specific address or schedule.
 *
 * One real caveat, not yet resolved: BUSINESS.hours are the business's GENERAL hours (shown
 * site-wide) -- the owner has not separately confirmed these are also the hours during which a
 * paid order can actually be collected (e.g. "by appointment only" days might not suit walk-in
 * pickup). Flagged in the launch checklist; do not treat this as pickup-specific confirmation.
 *
 * SECOND, SEPARATE caveat (owner-reported 2026-11-15, not yet resolved): the Chit Chats account
 * profile has an Ottawa address on file that the owner says DIFFERS from BUSINESS.addressLine1/2
 * above. Nothing here has been changed to match either address -- PICKUP_LOCATION still reflects
 * only the site's existing, previously-published BUSINESS constant, which is deliberately NOT
 * assumed to be the Chit Chats account's configured ship-from/return address (that's account-level
 * config under Settings > Returns, invisible to this codebase -- see chitChatsShippingProvider.ts's
 * header). Do not silently reconcile the two addresses in either direction; which one is actually
 * correct for pickup vs. for Chit Chats shipments is a business decision only the owner can make.
 * See docs/chit-chats-production-readiness.md's "Business information or credentials required"
 * section.
 */
export const PICKUP_LOCATION = {
  label: "Maple Imprint — Ottawa",
  addressLine1: BUSINESS.addressLine1,
  addressLine2: BUSINESS.addressLine2,
  city: BUSINESS.city,
  province: BUSINESS.region,
  postalCode: BUSINESS.postalCode,
  country: "CA" as const,
  phone: BUSINESS.phoneDisplay,
  hours: BUSINESS.hours,
} as const;

/** A single human-readable line for the pickup instructions shown on the checkout selector,
 *  order confirmation, and admin order view -- built from PICKUP_LOCATION, not a separate
 *  hand-typed string, so there is exactly one place to update if the address or hours change. */
export function pickupInstructionsText(): string {
  const hoursLines = PICKUP_LOCATION.hours.map((h) => `${h.days}: ${h.time}`).join("; ");
  return `Pick up at ${PICKUP_LOCATION.addressLine1}, ${PICKUP_LOCATION.addressLine2}, ${PICKUP_LOCATION.city}, ${PICKUP_LOCATION.province} ${PICKUP_LOCATION.postalCode}. Hours: ${hoursLines}. We'll email you when your order is ready for collection.`;
}
