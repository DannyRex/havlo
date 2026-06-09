/* HubProductGrid — the crawlable product grid shared by category and
   brand hub pages.

   Server component on purpose: it renders real <Link href> anchors to
   /[country]/p/[offer_id] PDPs in the SSR HTML, which is the entire
   point of the hubs (give crawlers + answer engines a path DOWN to the
   product corpus that GSC flagged as orphaned).

   MasonryCard is a client component but still server-renders its
   initial HTML (so the PDP <Link> is in the crawlable markup) and reads
   useCountry() for currency — seeded correctly by the root layout on
   any /[country]/ route, so no country prop is needed here.

   Layout matches the /[country]/deals skeleton/loaded grid exactly
   (cols 2/3/4, uniform aspect-[4/5]) so a hub reads as the same surface
   as the main feed, just pre-filtered. */

import MasonryCard from "@/components/deals/MasonryCard";
import { pdpUrlForDeal } from "@/lib/pdp-url";
import type { Deal } from "@/types";

interface HubProductGridProps {
  deals:       Deal[];
  countryCode: string;
  /** First row opts into priority image loading for LCP. */
  priorityCount?: number;
}

export default function HubProductGrid({
  deals,
  countryCode,
  priorityCount = 4,
}: HubProductGridProps) {
  if (deals.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
        <p className="text-ink-2 text-[15px] leading-relaxed">
          No products to show here right now. Prices and stock refresh
          throughout the day, so check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
      {deals.map((deal, i) => (
        <MasonryCard
          key={deal.id}
          deal={deal}
          aspect="aspect-[4/5]"
          priority={i < priorityCount}
          /* Explicit country-prefixed PDP href — pdpUrlForDeal returns
             /[cc]/p/[id] for real offer ids (every hub deal is real,
             synthetic ids are filtered upstream in hubs.ts). */
          linkHref={pdpUrlForDeal(countryCode, deal)}
        />
      ))}
    </div>
  );
}
