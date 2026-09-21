import type { Metadata } from "next";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <CheckoutHeader />
      {children}
    </div>
  );
}
