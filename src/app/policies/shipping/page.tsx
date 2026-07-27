import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Shipping Policy",
  robots: { index: false, follow: true },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout title="Shipping Policy" description="Delivery and pickup options, timing and responsibility once an order ships.">
      <PolicySection title="Delivery options">
        <p>Ottawa pickup and shipping are offered at checkout, with an estimated ready date shown before payment.</p>
      </PolicySection>
      <PolicySection title="Shipping destinations">
        <p>Exact serviceable destinations and carrier options will be confirmed with the client and listed here.</p>
      </PolicySection>
      <PolicySection title="Delays">
        <p>
          Weather, carrier delays and custom production timelines can affect delivery dates. Any change to an
          estimated date is communicated directly.
        </p>
      </PolicySection>
      <PolicySection title="Lost or damaged shipments">
        <p>Process for reporting and resolving lost or damaged shipments will be finalized with the client&apos;s carrier agreements.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
