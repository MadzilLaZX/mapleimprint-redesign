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
        <p>
          Ottawa local pickup and shipping delivery options are being finalized. Once available, they will be
          offered at checkout. In the meantime, delivery arrangements and ready dates are confirmed directly with
          each order.
        </p>
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
