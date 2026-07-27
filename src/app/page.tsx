import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { ShopByNeed } from "@/components/home/ShopByNeed";
import { TwoPaths } from "@/components/home/TwoPaths";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PopularCategories } from "@/components/home/PopularCategories";
import { BusinessSolutions } from "@/components/home/BusinessSolutions";
import { OurWorkPreview } from "@/components/home/OurWorkPreview";
import { PrintMethodsPreview } from "@/components/home/PrintMethodsPreview";
import { FAQPreview } from "@/components/home/FAQPreview";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <ShopByNeed />
      <TwoPaths />
      <HowItWorks />
      <PopularCategories />
      <BusinessSolutions />
      <OurWorkPreview />
      <PrintMethodsPreview />
      <FAQPreview />
      <FinalCTA />
    </>
  );
}
