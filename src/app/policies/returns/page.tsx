import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Returns & Defects Policy",
  robots: { index: false, follow: true },
};

export default function ReturnsPolicyPage() {
  return (
    <PolicyLayout
      title="Returns & Defects Policy"
      description="Custom goods, blank goods and defective items are treated differently. This page separates the three cases clearly."
    >
      <PolicySection title="Custom, personalized items">
        <p>
          Once a proof is approved and production begins, custom items generally cannot be returned for change of
          mind. Production errors that don&apos;t match the approved proof are corrected or refunded.
        </p>
      </PolicySection>
      <PolicySection title="Unpersonalized blank goods">
        <p>Unused, unpersonalized items may be eligible for return within a stated window. Exact conditions are confirmed with the client.</p>
      </PolicySection>
      <PolicySection title="Defects">
        <p>
          Defects are assessed against the approved proof. Customer artwork errors, approved-proof errors and
          production errors are handled differently and explained at the time of assessment.
        </p>
      </PolicySection>
      <PolicySection title="How to request a resolution">
        <p>Contact us with your order number and photos of the issue, and we&apos;ll confirm next steps.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
