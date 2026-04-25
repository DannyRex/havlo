import Hero from "@/components/landing/Hero";
import TrendingDeals from "@/components/landing/TrendingDeals";
import TrendingSearches from "@/components/landing/TrendingSearches";
import CategoryGrid from "@/components/landing/CategoryGrid";
import StoreLogos from "@/components/landing/StoreLogos";
import CTA from "@/components/landing/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrendingDeals />
      <TrendingSearches />
      <CategoryGrid />
      <StoreLogos />
      <CTA />
    </>
  );
}
