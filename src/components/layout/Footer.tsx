import Image from "next/image";
import Link from "next/link";
import { EnvelopeSimple, InstagramLogo, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/ui/Container";
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE, PRODUCT_CATEGORIES, SOLUTIONS } from "@/lib/constants";

const helpLinks = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Print Methods", href: "/print-methods" },
  { label: "Artwork Guidelines", href: "/resources/artwork-guidelines" },
  { label: "FAQ", href: "/resources#faq" },
  { label: "Order Tracking", href: "/account/orders" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/policies/privacy" },
  { label: "Terms of Service", href: "/policies/terms" },
  { label: "Shipping Policy", href: "/policies/shipping" },
  { label: "Returns & Defects", href: "/policies/returns" },
  { label: "Custom Order Terms", href: "/policies/custom-order-terms" },
  { label: "Accessibility Statement", href: "/policies/accessibility" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 text-white/70">
      <Container className="grid grid-cols-2 gap-x-8 gap-y-12 py-16 md:grid-cols-6 lg:py-20">
        <div className="col-span-2 md:col-span-2">
          <Image
            src="/logo/logo-lockup.png"
            alt="Maple Imprint Ltd."
            width={1529}
            height={432}
            className="h-8 w-auto"
          />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
            Custom apparel, workwear, business printing and promotional products, made and finished in Ottawa.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-orange" />
              <span>
                {BUSINESS.addressLine1}, {BUSINESS_ADDRESS_ONE_LINE}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-orange" />
              <a href={BUSINESS.phoneHref} className="hover:text-white">
                {BUSINESS.phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <EnvelopeSimple className="mt-0.5 size-4 shrink-0 text-orange" />
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-white">
                {BUSINESS.email}
              </a>
            </li>
          </ul>
        </div>

        <nav aria-label="Products">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Products</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {PRODUCT_CATEGORIES.slice(0, 6).map((cat) => (
              <li key={cat.slug}>
                <Link href={`/products/${cat.slug}`} className="hover:text-white">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Solutions">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Solutions</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {SOLUTIONS.map((s) => (
              <li key={s.slug}>
                <Link href={`/solutions/${s.slug}`} className="hover:text-white">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Help">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Help</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {helpLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Company</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link href="/about" className="hover:text-white">
                About
              </Link>
            </li>
            <li>
              <Link href="/our-work" className="hover:text-white">
                Our Work
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                <InstagramLogo className="size-4" /> Instagram
              </a>
            </li>
          </ul>
        </nav>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-4 py-6 text-xs text-white/45 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Maple Imprint Ltd. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white/80">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
