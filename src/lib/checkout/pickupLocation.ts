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
