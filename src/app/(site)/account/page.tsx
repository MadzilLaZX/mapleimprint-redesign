import type { Metadata } from "next";
import { FileText, Package, PenNib, Receipt } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { FieldLabel, TextInput } from "@/components/ui/Field";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: true },
};

const panels = [
  { icon: Package, label: "Orders", detail: "Track status from approved through to delivery." },
  { icon: PenNib, label: "Quotes & proofs", detail: "Review and approve digital proofs in one place." },
  { icon: FileText, label: "Saved designs", detail: "Reopen and reorder a previous design in a few clicks." },
  { icon: Receipt, label: "Invoices", detail: "Download receipts and invoice-ready paperwork." },
];

export default function AccountPage() {
  return (
    <>
      <PageHeader
        title="Account"
        description="Sign in to view orders, quotes, proofs and saved designs."
      />
      <Section tone="canvas">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              {panels.map((panel) => (
                <div key={panel.label} className="rounded-2xl bg-white p-5 opacity-60">
                  <panel.icon className="size-5 text-crimson" weight="duotone" />
                  <p className="mt-3 font-display font-semibold text-ink-900">{panel.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{panel.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted">
              Account sign-in is being connected as part of the commerce build-out. Order tracking is available now
              without an account below.
            </p>
          </div>

          <form className="rounded-[28px] bg-white p-8">
            <h2 className="font-display text-xl font-semibold text-ink-900">Sign in</h2>
            <div className="mt-6 space-y-5">
              <div>
                <FieldLabel htmlFor="signin-email">Email</FieldLabel>
                <TextInput id="signin-email" type="email" disabled placeholder="you@example.com" />
              </div>
              <div>
                <FieldLabel htmlFor="signin-password">Password</FieldLabel>
                <TextInput id="signin-password" type="password" disabled placeholder="••••••••" />
              </div>
            </div>
            <Button type="submit" className="mt-6 w-full justify-center" disabled>
              Sign in (coming soon)
            </Button>
            <p className="mt-4 text-center text-xs text-muted">
              Need order status now? <a href="/account/orders" className="font-semibold text-crimson">Track an order</a>
            </p>
          </form>
        </Container>
      </Section>
    </>
  );
}
