import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/policy/PolicyLayout";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  robots: { index: false, follow: true },
};

export default function AccessibilityPolicyPage() {
  return (
    <PolicyLayout
      title="Accessibility Statement"
      description="Our target standard and how to reach us about an accessibility issue."
    >
      <PolicySection title="Our target">
        <p>
          This site is designed and built toward WCAG 2.2 Level AA, covering keyboard access, focus visibility,
          colour contrast, reduced motion and screen-reader compatibility.
        </p>
      </PolicySection>
      <PolicySection title="Ongoing work">
        <p>
          Accessibility is verified through automated checks and manual keyboard and screen-reader testing as the
          site is built out, not treated as a one-time pass.
        </p>
      </PolicySection>
      <PolicySection title="Reporting an issue">
        <p>
          If you experience a barrier using this site, contact hello@mapleimprint.ca and we&apos;ll address it as a
          priority.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
