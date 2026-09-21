// Plain, human-readable inline validation — no schema library, matching this repo's existing
// hand-rolled validation style (see the quote wizard / api/quote's manual field checks) rather
// than introducing zod/yup for one form.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CA_POSTAL_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

export function validateFullName(value: string): string | null {
  if (!value.trim()) return "Enter your full name.";
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Enter your email address.";
  if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address.";
  return null;
}

export function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Enter your phone number.";
  if (digits.length < 10) return "Enter a valid phone number.";
  return null;
}

export function validateAddressLine1(value: string): string | null {
  if (!value.trim()) return "Enter your street address.";
  return null;
}

export function validateCity(value: string): string | null {
  if (!value.trim()) return "Enter your city.";
  return null;
}

export function validateProvince(value: string): string | null {
  if (!value.trim()) return "Select a province.";
  return null;
}

/** Only Canadian format is validated for now — Maple currently ships within Canada only (see
 *  ShippingQuoteProvider). Country is still a real field, not hardcoded, so US/international
 *  support is a config change, not a rewrite, once Maple approves shipping there. */
export function validatePostalCode(value: string, country: string): string | null {
  if (!value.trim()) return "Enter your postal code.";
  if (country === "CA" && !CA_POSTAL_RE.test(value.trim())) {
    return "Enter a valid Canadian postal code.";
  }
  return null;
}

export function formatCanadianPostalCode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}`;
}
