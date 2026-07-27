import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms of Service" description="The terms that govern using the Maple Imprint website and placing an order.">
      <PolicySection title="Ordering">
        <p>
          Instant orders are confirmed at checkout. Bulk and business orders are confirmed once a quote is accepted
          and, where required, a deposit is paid.
        </p>
      </PolicySection>
      <PolicySection title="Pricing">
        <p>
          Prices state exactly what they include. Taxes, shipping and any rush or setup fees are shown before
          payment.
        </p>
      </PolicySection>
      <PolicySection title="Proofs and approval">
        <p>
          Production does not begin until a digital proof is approved. Approved proofs represent what will be
          produced.
        </p>
      </PolicySection>
      <PolicySection title="Account use">
        <p>Customers are responsible for keeping account credentials secure and for the accuracy of order details they submit.</p>
      </PolicySection>
      <PolicySection title="Limitation of liability">
        <p>Final liability terms will be drafted and confirmed with Maple Imprint&apos;s legal advisor before launch.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
