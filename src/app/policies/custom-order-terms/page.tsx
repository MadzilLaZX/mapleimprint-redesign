import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Custom Order Terms",
  robots: { index: false, follow: true },
};

export default function CustomOrderTermsPage() {
  return (
    <PolicyLayout
      title="Custom Order Terms"
      description="Additional terms specific to bulk, business and quote-based orders."
    >
      <PolicySection title="Quotes">
        <p>Quotes are scoped based on the details submitted and may change if quantities, artwork or timeline change materially.</p>
      </PolicySection>
      <PolicySection title="Deposits and payment">
        <p>Deposit and invoicing terms for larger orders will be confirmed with the client&apos;s payment and accounting setup.</p>
      </PolicySection>
      <PolicySection title="Proof approval">
        <p>A named approver&apos;s sign-off on the digital proof is treated as final authorization to produce the full run.</p>
      </PolicySection>
      <PolicySection title="Rush orders">
        <p>Rush timelines depend on decoration method and current production load, and are confirmed before you commit.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
