import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { BUSINESS, SITE_URL } from "@/lib/constants";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Maple Imprint | Custom Printing & Apparel, Ottawa",
    template: "%s | Maple Imprint",
  },
  description:
    "Custom apparel, workwear, business printing, signage and promotional products in Ottawa. Instant online customization for one-off orders, guided quotes for business and bulk projects.",
  keywords: [
    "custom printing Ottawa",
    "custom t-shirt printing Ottawa",
    "embroidery Ottawa",
    "business uniforms Ottawa",
    "screen printing Ottawa",
    "promotional products Ottawa",
  ],
  openGraph: {
    title: "Maple Imprint | Custom Printing & Apparel, Ottawa",
    description:
      "Custom apparel, workwear, business printing, signage and promotional products in Ottawa. Proof-first process, transparent pricing.",
    url: SITE_URL,
    siteName: "Maple Imprint",
    locale: "en_CA",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Maple Imprint Ltd." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maple Imprint | Custom Printing & Apparel, Ottawa",
    description:
      "Custom apparel, workwear, business printing, signage and promotional products in Ottawa.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Maple Imprint Ltd.",
  description:
    "Custom apparel, workwear, business printing, signage and promotional products in Ottawa.",
  url: SITE_URL,
  logo: `${SITE_URL}/logo/logo-lockup.png`,
  image: `${SITE_URL}/og-image.png`,
  telephone: BUSINESS.phoneHref.replace("tel:", ""),
  email: BUSINESS.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${BUSINESS.addressLine1}, ${BUSINESS.addressLine2}`,
    addressLocality: BUSINESS.city,
    addressRegion: BUSINESS.region,
    postalCode: BUSINESS.postalCode,
    addressCountry: "CA",
  },
  areaServed: `${BUSINESS.city}, ${BUSINESS.regionFull}, ${BUSINESS.country}`,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Wednesday", "Thursday"],
      opens: "11:00",
      closes: "19:00",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-CA"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink-900 font-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-orange focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-950"
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
