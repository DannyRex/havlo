import Hero from "@/components/landing/Hero";
import TrendingDeals from "@/components/landing/TrendingDeals";
import TrendingSearches from "@/components/landing/TrendingSearches";
import CategoryGrid from "@/components/landing/CategoryGrid";
import StoreLogos from "@/components/landing/StoreLogos";
import CTA from "@/components/landing/CTA";
import RefreshOnInterval from "@/components/ui/RefreshOnInterval";

/* Revalidate this page server-side every 5 min so the trending shuffle
   surfaces fresh picks for every cached request. Combined with the
   client-side <RefreshOnInterval /> below, users on the page also see
   updates without manual reload. */
export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrendingDeals />
      <TrendingSearches />
      <CategoryGrid />
      <StoreLogos />
      <CTA />
      <RefreshOnInterval ms={300_000} />
    </>
  );
}
