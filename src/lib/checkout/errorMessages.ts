// Maps Square's payment error codes to short, human-readable strings — never surface raw Square
// developer error codes/messages to the customer. Keep the technical detail server-side (logged),
// not in the response body.

const MESSAGES: Record<string, string> = {
  CARD_DECLINED: "Your card was declined. Try another card or payment method.",
  CVV_FAILURE: "The security code (CVV) didn't match. Check it and try again.",
  ADDRESS_VERIFICATION_FAILURE: "The billing address didn't match your card. Check it and try again.",
  INSUFFICIENT_FUNDS: "Your card was declined for insufficient funds. Try another card or payment method.",
  CARD_EXPIRED: "That card has expired. Try another card.",
  INVALID_EXPIRATION: "The expiration date doesn't look right. Check it and try again.",
  GENERIC_DECLINE: "Your card was declined. Try another card or payment method.",
  PAYMENT_LIMIT_EXCEEDED: "This payment exceeds a processing limit. Try a smaller amount or another card.",
  TRANSACTION_LIMIT: "This payment exceeds a processing limit. Try a smaller amount or another card.",
};

const FALLBACK = "Your payment didn't go through. Try again or use a different payment method.";

export function humanPaymentError(code: string | undefined | null): string {
  if (!code) return FALLBACK;
  return MESSAGES[code] ?? FALLBACK;
}
