"use client";

/* Live SerpAPI-backed alternatives shown on the PDP, beneath the
   static "Similar products" rail. Mirrors the /compare page's
   "Here's what's live online" surface so users get the same broader
   view of live deals from inside the product detail page.

   Fetches /api/live-search on mount. Renders nothing while loading
   (the static SimilarProducts rail above already gives users
   immediate alternatives — no point flashing a second skeleton).
   Renders nothing on empty or error too, keeping the PDP clean. */

import { useEffect, useState } from "react";
import MasonryCard from "@/components/deals/MasonryCard";
import { MASONRY_ASPECTS } from "@/components/deals/masonry-layout";
import type { Deal } from "@/types";

interface Props {
  query:          string;
  countryCode:    string;
  /** Store ID of the PDP anchor. We filter live results that come
      from the same store so the visitor doesn't see the same offer
      they're already looking at as an "alternative." */
  excludeStoreId: string;
}

export default function LiveAlternatives({ query, countryCode, excludeStoreId }: Props) {
  const [items, setItems] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;

    /* Call /api/live-search with the PDP's product title as the
       query. limit=12 mirrors /compare's call (the dupes rail above
       already serves 16, so 12 here keeps total noise reasonable
       without overlapping too much). */
    fetch(
      `/api/live-search?q=${encodeURIComponent(query)}&country=${encodeURIComponent(countryCode)}&limit=12`,
    )
      .then((r) => r.json())
      .then((data: { items?: Deal[]; results?: Deal[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) return;
        const fetched = data.items ?? data.results ?? [];
        /* Drop any row from the same store as the anchor — same
           reason /compare's anchor card omits self-listings. */
        const filtered = fetched.filter(
          (d) => d.storeId?.toLowerCase() !== excludeStoreId.toLowerCase(),
        );
        setItems(filtered);
      })
      .catch(() => {
        /* Live search is supplementary — failing silently is the
           right move. The static dupes rail above still rendered. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, countryCode, excludeStoreId]);

  /* Nothing to show — keep the page tidy.
       - During load: SimilarProducts above is already filled.
       - On error or empty: don't insert noise. */
  if (loading || items.length === 0) return null;

  return (
    <section className="mt-12 sm:mt-16">
      <header className="mb-6 sm:mb-8">
        <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
          Live deals
        </h2>
        <p className="text-sm sm:text-base text-ink-2 mt-1.5">
          {items.length} {items.length === 1 ? "fresh match" : "fresh matches"} from the live search across other stores.
        </p>
      </header>

      <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
        {items.map((deal, i) => (
          <div key={deal.id + ":live:" + i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
            {/* Live results carry synthetic `serp-{ts}-{i}` IDs that
                don't resolve in the PDP route. Route to /compare for
                that product's title instead — same fix shape as
                SimilarProducts. */}
            <MasonryCard
              deal={deal}
              aspect={MASONRY_ASPECTS[i % MASONRY_ASPECTS.length]}
              priority={false}
              linkHref={`/${countryCode}/compare?q=${encodeURIComponent(deal.title)}&mode=similar`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
