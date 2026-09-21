// Checkout's Contact/Delivery form state (ACTIVATE REAL CHECKOUT brief, Section 16: "Persist
// checkout form state appropriately in session/order draft. Do not put shipping/contact
// information in DesignProject, design.json, or URL query parameters. PII belongs in protected
// order/checkout records.")
//
// HONEST SCOPE: there is no real Order/CheckoutSession database table in this app yet — the only
// backend this session has write access to is the Studio DesignProject schema, and adding a new
// table needs a migration this session cannot run (no Supabase MCP/schema-write access; see the
// checkout brief's audit finding that no checkout backend exists at all, not just that it isn't
// wired up). A real "protected order record" is a genuine follow-up item, not something faked here.
//
// Given that constraint, this uses sessionStorage — NOT DesignProject, NOT design.json, NOT a URL
// query param, satisfying the letter of Section 16 even though it isn't yet a server-side
// protected record. sessionStorage (not localStorage) is deliberate: it survives a page refresh/
// "Back to Cart"/"Proceed to Checkout" round trip within the same tab (Section 27/32's
// requirements) but does NOT persist indefinitely across browser sessions the way a real saved
// address would — an appropriately conservative default for PII when no real backend protects it
// yet. Never stores card/payment details (none are ever collected client-side — see PaymentSection).

const STORAGE_KEY = "mi-checkout-draft";

export interface ContactDraft {
  email: string;
  phone: string;
}

export interface DeliveryDraft {
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CheckoutDraft {
  contact: ContactDraft;
  delivery: DeliveryDraft;
}

export const EMPTY_CONTACT_DRAFT: ContactDraft = { email: "", phone: "" };
export const EMPTY_DELIVERY_DRAFT: DeliveryDraft = {
  fullName: "",
  address1: "",
  address2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "CA",
};

export function loadCheckoutDraft(): CheckoutDraft {
  if (typeof window === "undefined") return { contact: EMPTY_CONTACT_DRAFT, delivery: EMPTY_DELIVERY_DRAFT };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { contact: EMPTY_CONTACT_DRAFT, delivery: EMPTY_DELIVERY_DRAFT };
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    return {
      contact: { ...EMPTY_CONTACT_DRAFT, ...parsed.contact },
      delivery: { ...EMPTY_DELIVERY_DRAFT, ...parsed.delivery },
    };
  } catch {
    return { contact: EMPTY_CONTACT_DRAFT, delivery: EMPTY_DELIVERY_DRAFT };
  }
}

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private browsing, quota) — checkout still works, the customer just
    // re-enters their details if they navigate away and back.
  }
}

/** Called only once a test/real order actually completes — never persist PII longer than the
 *  checkout session that produced it. */
export function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op — nothing sensitive is left behind by failing to clear here (sessionStorage doesn't
    // outlive the tab anyway).
  }
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Loose on purpose — a checkout form shouldn't reject real international phone numbers over
 *  formatting; this just guards against obviously-empty/garbage input (Section 14's "inline
 *  validation," not a strict E.164 parser). */
export function isLikelyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7;
}

export function isContactValid(contact: ContactDraft): boolean {
  return isLikelyEmail(contact.email) && isLikelyPhone(contact.phone);
}

export function isDeliveryValid(delivery: DeliveryDraft): boolean {
  return (
    delivery.fullName.trim().length > 1 &&
    delivery.address1.trim().length > 3 &&
    delivery.city.trim().length > 1 &&
    delivery.region.trim().length > 0 &&
    delivery.postalCode.trim().length > 2 &&
    delivery.country.trim().length > 0
  );
}
