import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { OrderTrackingForm } from "@/components/account/OrderTrackingForm";

export const metadata: Metadata = {
  title: "Order Tracking",
  robots: { index: false, follow: true },
};

export default function OrderTrackingPage() {
  return (
    <>
      <PageHeader
        title="Track an order"
        description="Enter your order number and the email used at checkout."
      />
      <Section tone="canvas">
        <Container className="max-w-xl">
          <OrderTrackingForm />
        </Container>
      </Section>
    </>
  );
}
