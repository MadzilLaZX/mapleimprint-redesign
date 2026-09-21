import { randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids support confusion

/** Human/support-facing order token — deliberately NOT sequential (unlike
 *  src/lib/automation/reference.ts's Sheets-row-count scheme, which is also racy under
 *  concurrent writes). This is read by the confirmation page via the service-role client, so it
 *  doubles as that page's access-control boundary: it must be practically unguessable, not just
 *  "not an auto-increment." 8 chars from a 32-symbol alphabet is ~40 bits of entropy. */
export function generateOrderReference(): string {
  const bytes = randomBytes(8);
  let token = "";
  for (const b of bytes) token += BASE32_ALPHABET[b % BASE32_ALPHABET.length];
  return `MO-${token}`;
}
