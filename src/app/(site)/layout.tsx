import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";

/** The normal marketing/storefront shell — header, footer, page-to-page transition. Everything
 *  under src/app/(site)/ gets this; Studio deliberately lives in a sibling (studio) route group
 *  with its own minimal layout instead, so it never renders this chrome at all (not hidden with
 *  CSS — it's simply never part of that route's layout tree). See (studio)/layout.tsx. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  );
}
