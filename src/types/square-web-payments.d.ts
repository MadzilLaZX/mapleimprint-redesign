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
  // Both required by Square's tokenize() despite being undocumented in the quickstart examples —
  // omitting either throws "verificationDetails.X is required and must be a(n) boolean" at
  // tokenize time (only surfaces with a real browser test, not a server-side nonce test).
  customerInitiated: boolean;
  sellerKeyedIn: boolean;
  billingContact?: {
    givenName?: string;
    familyName?: string;
    email?: string;
    phone?: string;
    addressLines?: string[];
    city?: string;
    state?: string;
    countryCode?: string;
    postalCode?: string;
  };
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
  // postalCode seeds an INITIAL VALUE for the card form's own built-in postal/zip sub-field --
  // deliberately never passed by this app (see SquarePaymentSection.tsx's own comment): a seeded
  // value is asserted as the real billing postal code, and the field's country-specific format
  // (US ZIP vs. Canadian postal code vs. none at all) is auto-detected from the card's own BIN
  // once entered, not from anything this app configures -- confirmed against Square's own docs
  // (https://developer.squareup.com/reference/sdks/web/payments/card-payments: "automatically
  // infers whether to display the postal code field... based on the issuing country of the
  // buyer payment card") and their community forum (Square staff, directly on this exact
  // Canadian-postal-code question: "the card they entered doesn't have that format on file with
  // the bank"). Square's Sandbox has no Canadian-BIN test cards -- only US-simulated ones -- so a
  // Sandbox test with any test card will always show the numeric US ZIP format regardless of this
  // option; that's a documented Sandbox limitation, not something fixable in integration code.
  card(options?: { postalCode?: string }): Promise<SquareCard>;
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
