import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      description="How Maple Imprint collects, uses and protects customer information."
    >
      <PolicySection title="Information we collect">
        <p>
          Contact details, order and quote information, uploaded artwork, and account activity necessary to fulfil
          orders and provide support.
        </p>
      </PolicySection>
      <PolicySection title="How we use it">
        <p>
          To process orders and quotes, communicate about production and delivery, and improve the site. We do not
          sell customer information.
        </p>
      </PolicySection>
      <PolicySection title="Third parties">
        <p>
          Payment processing, email delivery, analytics and file storage are handled by named processors, listed here
          once selected and confirmed with the client.
        </p>
      </PolicySection>
      <PolicySection title="Your rights">
        <p>
          Customers can request a copy of their data or request deletion, subject to records we&apos;re required to
          keep for tax and legal purposes.
        </p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>Questions about this policy can be sent to hello@mapleimprint.ca.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
