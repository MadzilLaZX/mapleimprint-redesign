"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/cart/CartProvider";
import { FieldLabel, FieldError, TextInput, SelectInput } from "@/components/ui/Field";
import { OrderSummary, type CheckoutQuote } from "@/components/checkout/OrderSummary";
import { SquarePaymentSection } from "@/components/checkout/payment/SquarePaymentSection";
import { CANADIAN_PROVINCES } from "@/lib/checkout/provinces";
import {
  validateFullName,
  validateEmail,
  validatePhone,
  validateAddressLine1,
  validateCity,
  validateProvince,
  validatePostalCode,
  formatCanadianPostalCode,
} from "@/lib/checkout/validation";
import type { CheckoutCartItemInput } from "@/lib/checkout/priceCartItem";

const QUOTE_DEBOUNCE_MS = 500;

interface ContactState {
  fullName: string;
  email: string;
  phone: string;
}

interface DeliveryState {
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

type TouchedMap = Record<string, boolean>;

export function CheckoutClient() {
  const { items, clearCart } = useCart();
  const router = useRouter();

  const [contact, setContact] = useState<ContactState>({ fullName: "", email: "", phone: "" });
  const [delivery, setDelivery] = useState<DeliveryState>({
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "CA",
  });
  const [touched, setTouched] = useState<TouchedMap>({});

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [unresolvedItems, setUnresolvedItems] = useState<{ cartItemId: string; reason: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const contactErrors = {
    fullName: validateFullName(contact.fullName),
    email: validateEmail(contact.email),
    phone: validatePhone(contact.phone),
  };
  const deliveryErrors = {
    addressLine1: validateAddressLine1(delivery.addressLine1),
    city: validateCity(delivery.city),
    province: validateProvince(delivery.province),
    postalCode: validatePostalCode(delivery.postalCode, delivery.country),
  };
  const contactValid = Object.values(contactErrors).every((e) => e === null);
  const deliveryValid = Object.values(deliveryErrors).every((e) => e === null);
  const canShowPayment = contactValid && deliveryValid && unresolvedItems.length === 0;

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }
  function shown(field: string, error: string | null) {
    return touched[field] ? error : null;
  }

  const quoteItems: CheckoutCartItemInput[] = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        name: i.name,
        categorySlug: i.categorySlug,
        categoryName: i.categoryName,
        quantity: i.quantity,
        colourName: i.colourName,
        sizeBreakdown: i.sizeBreakdown,
        customizationType: i.customizationType,
        designProjectId: i.designProjectId,
        designFrozenRevision: i.designFrozenRevision,
        productSlug: i.productSlug,
        subcategorySlug: i.subcategorySlug,
      })),
    [items],
  );

  useEffect(() => {
    if (quoteItems.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuoteLoading(true);
      fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: quoteItems,
          shippingAddress: { province: delivery.province, country: delivery.country, postalCode: delivery.postalCode },
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            if (data.unresolvedItems) {
              setUnresolvedItems(data.unresolvedItems);
              setQuote(null);
            } else {
              setQuoteError(data.error ?? "Couldn't calculate your total.");
            }
            return;
          }
          setUnresolvedItems([]);
          setQuoteError(null);
          setQuote(data);
        })
        .catch(() => setQuoteError("Couldn't calculate your total. Check your connection and try again."))
        .finally(() => setQuoteLoading(false));
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only the address fields that actually affect tax/shipping should retrigger the quote —
    // re-running on every contact keystroke would spam the endpoint for no reason.
  }, [quoteItems, delivery.province, delivery.country, delivery.postalCode]);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted">Add something to your cart before checking out.</p>
        <Link href="/shop" className="mt-6 rounded-full bg-maple-gradient px-6 py-3 text-sm font-semibold text-ink-950">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:py-12">
      <h1 className="font-display text-2xl font-semibold text-ink-900 lg:text-3xl">Checkout</h1>

      {unresolvedItems.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-crimson/10 px-4 py-3 text-sm text-crimson">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <div>
            <p className="font-semibold">Some items in your cart aren&apos;t ready for checkout yet.</p>
            <p className="mt-0.5">
              <Link href="/cart" className="underline underline-offset-2">
                Go back to your cart
              </Link>{" "}
              to remove or resolve them before continuing.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[60%_1fr]">
        <div className="order-2 space-y-6 lg:order-1">
          {/* Contact */}
          <section className="rounded-[24px] bg-white p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <TextInput
                  id="fullName"
                  autoComplete="name"
                  value={contact.fullName}
                  onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                  onBlur={() => markTouched("fullName")}
                />
                <FieldError>{shown("fullName", contactErrors.fullName) ?? undefined}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <TextInput
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  onBlur={() => markTouched("email")}
                />
                <FieldError>{shown("email", contactErrors.email) ?? undefined}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <TextInput
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  onBlur={() => markTouched("phone")}
                />
                <FieldError>{shown("phone", contactErrors.phone) ?? undefined}</FieldError>
              </div>
            </div>
          </section>

          {/* Delivery */}
          <section className="rounded-[24px] bg-white p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Delivery</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="addressLine1">Address</FieldLabel>
                <TextInput
                  id="addressLine1"
                  autoComplete="address-line1"
                  value={delivery.addressLine1}
                  onChange={(e) => setDelivery((d) => ({ ...d, addressLine1: e.target.value }))}
                  onBlur={() => markTouched("addressLine1")}
                />
                <FieldError>{shown("addressLine1", deliveryErrors.addressLine1) ?? undefined}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="addressLine2" optional>
                  Apartment / Unit
                </FieldLabel>
                <TextInput
                  id="addressLine2"
                  autoComplete="address-line2"
                  value={delivery.addressLine2}
                  onChange={(e) => setDelivery((d) => ({ ...d, addressLine2: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <TextInput
                  id="city"
                  autoComplete="address-level2"
                  value={delivery.city}
                  onChange={(e) => setDelivery((d) => ({ ...d, city: e.target.value }))}
                  onBlur={() => markTouched("city")}
                />
                <FieldError>{shown("city", deliveryErrors.city) ?? undefined}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="province">Province</FieldLabel>
                <SelectInput
                  id="province"
                  autoComplete="address-level1"
                  value={delivery.province}
                  onChange={(e) => setDelivery((d) => ({ ...d, province: e.target.value }))}
                  onBlur={() => markTouched("province")}
                >
                  <option value="">Select…</option>
                  {CANADIAN_PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </SelectInput>
                <FieldError>{shown("province", deliveryErrors.province) ?? undefined}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="postalCode">Postal code</FieldLabel>
                <TextInput
                  id="postalCode"
                  autoComplete="postal-code"
                  value={delivery.postalCode}
                  onChange={(e) => setDelivery((d) => ({ ...d, postalCode: formatCanadianPostalCode(e.target.value) }))}
                  onBlur={() => markTouched("postalCode")}
                />
                <FieldError>{shown("postalCode", deliveryErrors.postalCode) ?? undefined}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                {/* Canada-only for now (see shippingProvider.ts) — a real field, not hardcoded
                    logic, so more countries is a config change once Maple approves shipping there. */}
                <SelectInput id="country" autoComplete="country" value={delivery.country} disabled>
                  <option value="CA">Canada</option>
                </SelectInput>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-[24px] bg-white p-6 transition-opacity">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Payment</h2>
            <AnimatePresence mode="wait">
              {canShowPayment && quote ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4"
                >
                  <SquarePaymentSection
                    totalCents={quote.totalCents}
                    payload={{ items: quoteItems, contact, shippingAddress: delivery }}
                    onSuccess={(orderReference) => {
                      clearCart();
                      router.push(`/order/${orderReference}/confirmation`);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.p
                  key="pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 text-sm text-muted"
                >
                  Complete Contact &amp; Delivery to continue to payment.
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          {quoteError && (
            <p className="flex items-center gap-1.5 text-sm text-crimson">
              <WarningCircle className="size-4" weight="bold" />
              {quoteError}
            </p>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <OrderSummary items={items} quote={quote} quoteLoading={quoteLoading} />
        </div>
      </div>
    </div>
  );
}
