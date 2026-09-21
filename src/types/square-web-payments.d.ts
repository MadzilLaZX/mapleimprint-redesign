// Minimal ambient types for the Square Web Payments SDK, which is loaded via a <script> tag
// (see SquarePaymentSection.tsx) rather than an npm package — Square doesn't ship official types
// for the browser global. Only the surface this app actually uses is declared.

interface SquareTokenResult {
  status: "OK" | "Cancel" | "Error";
  token?: string;
  errors?: { type: string; message: string }[];
}

interface SquareVerificationDetails {
  amount: string;
  currencyCode: string;
  intent: "CHARGE" | "STORE";
  billingContact?: { givenName?: string; familyName?: string; email?: string; phone?: string };
}

interface SquareCard {
  attach(selector: string): Promise<void>;
  tokenize(verificationDetails?: SquareVerificationDetails): Promise<SquareTokenResult>;
  destroy(): Promise<void>;
}

interface SquarePaymentRequest {
  // Opaque handle passed to payments.applePay()/googlePay() — no methods this app calls directly.
  [key: string]: unknown;
}

// Apple Pay has no attach() — per Square's docs, the button is plain HTML you style yourself
// (Apple's official button CSS) with your own click listener calling tokenize() directly.
interface SquareApplePayButton {
  tokenize(): Promise<SquareTokenResult>;
}

// Google Pay's button IS rendered by the SDK via attach().
interface SquareGooglePayButton {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<SquareTokenResult>;
}

interface SquarePayments {
  card(): Promise<SquareCard>;
  paymentRequest(options: {
    countryCode: string;
    currencyCode: string;
    total: { amount: string; label: string };
  }): SquarePaymentRequest;
  applePay(request: SquarePaymentRequest): Promise<SquareApplePayButton>;
  googlePay(request: SquarePaymentRequest): Promise<SquareGooglePayButton>;
}

interface Window {
  Square?: {
    payments(applicationId: string, locationId: string): SquarePayments;
  };
}
