"use client";

/* PdpInteractive — client wrapper that streams the PDP's heavy
   comparison data.

   Why this exists (June 2026): the PDP is statically generated (ISR) so
   the edge can serve it cheaply, but its cross-store comparison (dupes +
   variant-match spectrum + price history + "you may also like" rail) is
   an expensive multi-stage Supabase + LLM pipeline. Computing it inside
   the ISR render meant a COLD navigation BUFFERED for ~1.5s on Vercel
   with no loading skeleton — ISR blocking renders don't stream, so the
   `loading.tsx` boundary never showed and the previous page just froze.
   (Local `next start` streams and hid the problem; prod measurement
   revealed it.) See the trade-off note in /[country]/p/[id]/page.tsx.

   Fix: page.tsx server-renders only the cheap shell (hero core from the
   single offer + JSON-LD + breadcrumb), so the ISR render is fast; this
   client component fetches /api/pdp/[id] on mount and shows the SAME
   skeletons as loading.tsx until the data lands. Because it renders with
   data=null during SSR, the ISR-cached HTML already contains the shell +
   skeletons — a cold nav paints instantly, then the comparison streams
   in. Warm offers come back from the endpoint's edge cache in a few
   hundred ms. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
import { ArrowDown } from "lucide-react";
import ProductHero, { type OfferData } from "@/components/product/ProductHero";
import OtherConfigurations from "@/components/product/OtherConfigurations";
import PriceHistoryChartSkeleton from "@/components/product/PriceHistoryChartSkeleton";
import { getCountry } from "@/lib/country";
import { displayStoreName } from "@/lib/store-display";
import type { PdpData } from "@/lib/offers/pdp-data";

/* Below-the-fold rails — code-split so their JS isn't in the initial
   PdpInteractive chunk. They only mount AFTER the client fetch resolves
   (data != null), so they never participate in the SSR'd skeleton shell. */
const SimilarProducts      = nextDynamic(() => import("@/components/product/SimilarProducts"));
const FallbackCategoryRail = nextDynamic(() => import("@/components/product/FallbackCategoryRail"));
const PriceHistoryChart    = nextDynamic(
  () => import("@/components/product/PriceHistoryChart"),
  { loading: () => <PriceHistoryChartSkeleton /> },
);

interface Props {
  offer:              OfferData;
  countryCode:        string;
  signedOutboundUrl:  string;
  /** Cheap server-side cross-border check (isOfferAllowedForCountry over
      the anchor store). Drives the hero banner immediately; the local
      ALTERNATIVE inside it streams in with the comparison data. */
  isLocallyShoppable: boolean;
}

/* Masonry skeleton for the "You may also like" rail — mirrors the rail
   block in loading.tsx so the shell matches the eventual content shape. */
function RailSkeleton() {
  return (
    <section className="mt-12 sm:mt-16">
      <header className="mb-6 sm:mb-8">
        <div className="skeleton h-7 sm:h-9 w-52 rounded-lg mb-2" />
        <div className="skeleton h-4 w-72 rounded" />
      </header>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3 lg:gap-4 [column-fill:_balance]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="break-inside-avoid mb-2 sm:mb-3 lg:mb-4">
            <div
              className={`skeleton rounded-xl sm:rounded-2xl ${
                ["aspect-[4/5]", "aspect-[3/4]", "aspect-square", "aspect-[5/4]"][i % 4]
              }`}
            />
            <div className="skeleton h-3 w-1/3 rounded mt-2.5 mb-1.5" />
            <div className="skeleton h-3.5 w-3/4 rounded mb-1.5" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PdpInteractive({ offer, countryCode, signedOutboundUrl, isLocallyShoppable }: Props) {
  const country = getCountry(countryCode);
  const router  = useRouter();
  const [data, setData]       = useState<PdpData | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErrored(false);
    fetch(`/api/pdp/${encodeURIComponent(offer.offerId)}?cc=${encodeURIComponent(countryCode)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PdpData) => {
        if (cancelled) return;
        setData(d);
        /* Rare broken-offer recovery: a cross-border offer with no
           merchant URL AND no local alternative has a dead "Visit" CTA.
           The server used to redirect here, but the shell now renders
           before this data exists, so we bounce client-side instead. */
        if (!d.localAlternative && isLocallyShoppable === false && (!offer.url || offer.url.trim().length === 0)) {
          router.replace(`/${countryCode}/deals`);
        }
      })
      .catch(() => { if (!cancelled) setErrored(true); });
    return () => { cancelled = true; };
  }, [offer.offerId, offer.url, countryCode, isLocallyShoppable, router]);

  /* loading == the comparison fetch is still in flight. On error we drop
     `loading` so ProductHero renders its single-store bar fallback (the
     hero + CTA still work); the rails simply stay absent. */
  const loading = !data && !errored;

  return (
    <>
      <ProductHero
        offer={offer}
        countryCode={countryCode}
        signedOutboundUrl={signedOutboundUrl}
        totalStores={data?.totalStores}
        perStoreOffers={data?.perStoreOffers}
        priceHistory={data?.priceHistory ?? undefined}
        localAlternative={data?.localAlternative ?? undefined}
        isLocallyShoppable={isLocallyShoppable}
        loading={loading}
      />

      {/* Price-history section — always present. Skeleton until the data
          lands, then the (code-split) chart. */}
      <div className="mt-6 sm:mt-8">
        {data ? (
          <PriceHistoryChart
            points={data.chartPoints}
            currentNgn={data.anchorPriceNgn}
            country={country}
            visitingStoreName={displayStoreName(offer.storeName)}
            dataSource={data.isTrackedProduct ? "tracked" : "curated"}
          />
        ) : (
          <PriceHistoryChartSkeleton />
        )}
      </div>

      {/* "Other variants" disclosure — only once the configs are known. */}
      {data && data.otherConfigs.length > 0 && (
        <OtherConfigurations configs={data.otherConfigs} country={country} />
      )}

      {/* "You may also like" rail, fallback rail, or nothing. */}
      {loading ? (
        <RailSkeleton />
      ) : data && data.dupesForRail.length > 0 ? (
        <section className="mt-12 sm:mt-16">
          <header className="mb-6 sm:mb-8">
            <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              You may also like
            </h2>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success/10 border border-success/20 mt-2">
              <ArrowDown size={12} className="text-success" />
              <span className="text-xs font-semibold text-success">
                {data.dupesForRail.length} {data.dupesForRail.length === 1 ? "alternative" : "alternatives"} found
              </span>
            </div>
            <p className="text-sm sm:text-base text-ink-2 mt-3">
              Sorted by best value, cheapest first.
            </p>
          </header>
          <SimilarProducts dupes={data.dupesForRail} countryCode={countryCode} />
        </section>
      ) : data && data.fallbackDeals.length > 0 ? (
        <section className="mt-12 sm:mt-16">
          <header className="mb-6 sm:mb-8">
            <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight">
              {data.fallbackCategoryName ? `More ${data.fallbackCategoryName} deals` : "More deals to browse"}
            </h2>
            <p className="text-sm sm:text-base text-ink-2 mt-1.5">
              We could not find direct alternatives for this product. Here are top picks {data.fallbackCategoryName ? `from ${data.fallbackCategoryName.toLowerCase()}` : "across the catalog"}.
            </p>
          </header>
          <FallbackCategoryRail deals={data.fallbackDeals} />
        </section>
      ) : null}
    </>
  );
}
