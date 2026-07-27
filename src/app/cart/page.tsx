import type { Metadata } from "next";
import { ShoppingBag } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PRIMARY_CTA } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <>
      <PageHeader title="Your cart" />
      <Section tone="canvas">
        <Container className="max-w-lg text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-white">
            <ShoppingBag className="size-7 text-muted" />
          </span>
          <h2 className="mt-6 font-display text-2xl font-semibold text-ink-900">Your cart is empty</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Customized items you add will show colour, size, artwork status and an itemized price here before checkout.
          </p>
          <Button href={PRIMARY_CTA.href} className="mt-8" showArrow>
            Browse products
          </Button>
        </Container>
      </Section>
    </>
  );
}
