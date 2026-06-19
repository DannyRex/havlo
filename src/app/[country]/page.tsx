import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReactDOM from "react-dom";
import Hero from "@/components/landing/Hero";
import TrendingDeals, { getTrendingBuckets } from "@/components/landing/TrendingDeals";
import RecordBrowseCrumb from "@/components/nav/RecordBrowseCrumb";
import { composePicks } from "@/components/landing/trending-compose";
import CashbackTeaser from "@/components/landing/CashbackTeaser";
import CategoryGrid from "@/components/landing/CategoryGrid";
import AmazonPromo from "@/components/landing/AmazonPromo";
import StoreLogos, { getStoreCountForCountry } from "@/components/landing/StoreLogos";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import CTA from "@/components/landing/CTA";
import HomeVideoShowcase from "@/components/landing/HomeVideoShowcase";
import RefreshOnInterval from "@/components/ui/RefreshOnInterval";
import JsonLd from "@/components/seo/JsonLd";
import DealUnavailableBanner from "@/components/feedback/DealUnavailableBanner";
import { COUNTRIES, getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";
import { getPopularPlaceholderExamples } from "@/lib/popular-placeholder-examples";
import { getShoppableStoreCount } from "@/lib/providers/browse-db";
import { proxiedImageUrl, downscaleCardImageUrl } from "@/lib/utils";

/* Revalidate this page server-side every 30 min. Was 300s (5 min);
   pushed out to 1800s on May 2026 after PSI flagged "Document request
   latency: 4,830 ms" on a cold-cache hit — that 4.8s is the streaming
   SSR's full duration (TrendingDeals + CategoryGrid each fan out to
   several DB queries before the response stream closes), and the
   short revalidate window meant ~12 cold renders per region per hour.

   Bumping to 1800s drops that to 2 cold renders per region per hour
   — every other visitor still hits warm ISR cache, and the client-
   side <RefreshOnInterval /> below kicks in every 5 minutes for users
   already on the page so freshness on the live surface is preserved.

   Trending-deal rotation does NOT depend on this revalidate window:
   <TrendingDeals/> ships several precomposed variants in the ISR
   payload and <TrendingDealsGrid/> picks one client-side per visit,
   so the homepage surfaces a fresh set even while the HTML is cached.
   See TrendingDealsGrid.tsx for why rotation must be client-side
   under ISR. */
/* Dropped 3600s -> 900s (May 2026 v4). The 3600s window kept the
   trending pool frozen for an hour; even after switching to client-
   side per-visit picks from a wider candidate pool (see
   TrendingDealsGrid), the user reported the grid still felt
   "recycled" on UK after several reloads inside the cache window.
   900s = 15 min cycles, so the underlying pool itself refreshes
   often enough during a testing or browsing session that returning
   visitors see genuinely fresh inventory. Cost vs 3600: 4x the
   cold-render rate, but the cold-render path is fanned out across
   Suspense (Hero streams immediately, only TrendingDeals +
   CategoryGrid sections wait for DB) so user-perceived TTFB is
   barely affected. */
/* Lowered 900 -> 300 (June 2026) so the homepage category-count tiles
   track the /deals All-tab pill closely (the user's "tile says 8 but the
   grid loads 75" report — that gap was the 15-min ISR window serving an
   old count). Affordable now because CategoryGrid reads the EDGE-CACHED
   /api/deals (originCounts.all) instead of fanning out to the DB itself,
   so a cold render at 300s is cheap cache hits, not fresh pool pulls. */
export const revalidate = 300;

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

/* Per-country meta description. Previous template lived inline and
   came out ~110-120 chars — under Google's 150-160 sweet spot, which
   caused the snippet to run short with empty space in SERPs. Each
   string here names 2-3 stores the visitor recognises in their
   country, lifting both length and click-through relevance.
   Length budget per entry: 145-160 chars. */
const META_DESCRIPTIONS: Record<string, string> = {
  ng: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in Nigeria, including Konga, Jumia, Amazon, and 20+ more.",
  uk: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the UK, including Currys, John Lewis, and 20+ more.",
  us: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the US, including Amazon, Walmart, and 20+ more.",
  de: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in Germany, including Amazon, MediaMarkt, and 20+ more.",
  ae: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in the UAE, including noon, Amazon, and 20+ more.",
  in: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in India, including Flipkart, Amazon, and 20+ more.",
  za: "Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in South Africa, including Takealot, and 20+ more.",
};

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const title = `Find similar products for less in ${country.name}`;
  const description = META_DESCRIPTIONS[country.code]
    ?? `Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know in ${country.name}.`;
  const url = `${SITE_URL}/${country.code}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates(""),
    },
    openGraph: {
      type: "website",
      title: `${title} · Havlo`,
      description,
      url,
      siteName: "Havlo",
      /* Valid OG locale: our 'uk' slug must map to ISO 'GB' (en_GB) — share
         scrapers (Facebook, etc.) ignore the malformed 'en_UK'. */
      locale: country.code === "de" ? "de_DE" : `en_${country.code === "uk" ? "GB" : country.code.toUpperCase()}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Havlo`,
      description,
    },
  };
}

/* ── Skeleton fallback for the streamed CategoryGrid section ────────
   Kept inline (vs imported from a separate file) so the relationship
   between the real section's layout and the placeholder stays
   obvious during future edits. Heights tuned to roughly match the
   real component so the page doesn't jump when content resolves.

   The TrendingDeals skeleton that used to live here was removed in the
   May 2026 LCP rework v5: TrendingDeals no longer streams behind a
   Suspense boundary. Its buckets are awaited in the page shell (cheap,
   unstable_cache-backed) and the grid renders in the first SSR flush so
   the LCP product image ships in the initial HTML next to its
   <link rel=preload>, instead of arriving in a later streaming chunk. */

function CategoryGridSkeleton() {
  return (
    <section className="py-12 sm:py-20 bg-bg" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="skeleton h-8 sm:h-10 w-56 rounded-lg mb-6 sm:mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[5/3] rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage({ params }: { params: { country: string } }) {
  const country = getCountry(params.country);
  if (!COUNTRIES.some((c) => c.code === country.code)) notFound();

  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
  ]);

  /* Hero trust pill ("Live · scanning prices across N stores")
     uses the PER-COUNTRY roster count so it matches the marquee
     below and the country selector's implicit scope. User report
     May 2026 (country-awareness audit): "87 stores pill hardcoded
     across all markets — needs to read per-market store count
     from the same source the country selector uses."

     Previous version called getTotalStoreCount() (deduped 87 across
     every market) on the theory that the per-country roster
     under-represents Havlo's coverage. But showing the same 87 on
     every homepage made the headline credibility signal feel
     synthetic — and contradicted the per-country deals counts
     immediately below the hero (UK shows 1,921 / 738 / 2,659 etc.,
     so a flat 87 stores reads as inconsistent).

     The ROSTERS in StoreLogos.tsx are hand-curated per country
     (NG=22, UK=22, US=21, DE=11, AE=12, IN=11, ZA=10) and drive the
     marquee. They under-counted the real shoppable universe, though:
     a NG visitor can shop ~75 stores (12 NG-local + 63 cross-border
     globals), a UK visitor ~267 — and a flat ~28-38 roster estimate
     read as inconsistent next to the per-country deals counts below.

     Per the May 2026 finding-3 directive ("homepage should be all
     stores you're capable of shopping with on havlo"), the pill now
     reads the live shoppable universe = stores anchored in this
     country ∪ the cross-border globals carrying a live offer. This is
     the IDENTICAL union the /deals "all" tab counts, so the two agree
     on the default view. getStoreCountForCountry stays as the static
     fallback when the RPC is unavailable during ISR regeneration
     (helper returns 0 and declines to cache it). */
  const shoppableCount = await getShoppableStoreCount(country.code);
  const storeCount = shoppableCount > 0 ? shoppableCount : getStoreCountForCountry(country.code);

  /* Dynamic placeholder examples — pulled from the live catalog via
     suggest_diverse_popular_products RPC. One popular multi-store
     product per category, country-aware. 30-min unstable_cache so
     the SSR DB cost amortises across page renders. Falls back to a
     hardcoded per-country list inside Hero if the RPC isn't
     migrated or returns thin data — Hero handles either shape
     transparently. */
  const placeholderExamples = await getPopularPlaceholderExamples(country.code);

  /* Trending buckets are fetched HERE in the shell (LCP rework v5, May
     2026) rather than inside a Suspense-wrapped async component. Awaiting
     them is cheap on the warm path — every fetch under getTrendingBuckets
     is unstable_cache-backed (30-min TTL) — and it never blocks a real
     visitor: the route is ISR (stale-while-revalidate), so only a
     background revalidation pays the cold DB cost, and no user waits on
     that render. The payoff is that the trending grid renders in the
     first SSR flush, so the first product image (the mobile LCP element)
     ships in the initial HTML instead of a later streaming chunk. */
  const trendingBuckets = await getTrendingBuckets(country);

  /* Preload the exact LCP image. composePicks(buckets, false)[0] is the
     deterministic HEAD[0] the client grid renders first (pure, no
     Math.random when randomize=false), and the URL is built with the
     identical proxiedImageUrl(downscaleCardImageUrl()) pipeline
     MasonryCard uses — so the <link rel=preload> and the streamed
     <img src> match byte-for-byte and the browser collapses them into a
     single fetch that starts during head parse. Skipped when the lead
     card has no image (the card renders the Havlo mark fallback, so
     there's nothing to preload). */
  const leadDeal = trendingBuckets ? composePicks(trendingBuckets, false)[0] : null;
  if (leadDeal?.imageUrl) {
    ReactDOM.preload(proxiedImageUrl(downscaleCardImageUrl(leadDeal.imageUrl)), {
      as: "image",
      fetchPriority: "high",
    });
  }

  return (
    <>
      <JsonLd data={breadcrumb} />
      {/* Drop a "Back to home" breadcrumb so a homepage card → PDP → back
          returns here instead of falling through to a stale compare crumb or
          bare /deals. */}
      <RecordBrowseCrumb label="home" />
      {/* Recovery banner — only renders when /api/go bounced the user
          back here because a Google-relay merchant URL couldn't be
          resolved. Suspense boundary required because the banner
          reads useSearchParams() and Next 14 expects that to be
          inside a Suspense for static-rendered routes. */}
      <Suspense fallback={null}>
        <DealUnavailableBanner />
      </Suspense>
      <Hero storeCount={storeCount} countryCode={country.code} countryName={country.name} placeholderExamples={placeholderExamples} />
      {/* TrendingDeals renders SYNCHRONOUSLY in the shell now — its
          buckets were awaited above and its first card carries the LCP
          image, so it must ship in the initial SSR flush (not behind a
          Suspense chunk) for the preload to pay off. CategoryGrid below
          still streams behind Suspense: it fans out to its own DB reads
          and sits below the fold, so deferring it keeps shell TTFB low
          without touching the LCP.

          Country is passed as a PROP (not read via cookies()) so the
          page stays statically renderable per /[country]/ segment.
          See the "ISR-not-actually-ISR" investigation May 2026:
          every cookies() read in the render tree forced dynamic
          SSR + ~70 Supabase queries per visit. URL-as-source-of-
          truth eliminates the cookie read and unlocks the
          revalidate=1800 ISR caching that was already declared. */}
      {trendingBuckets && (
        <TrendingDeals buckets={trendingBuckets} countryCode={country.code} />
      )}
      {/* "See how it works" — two alternating autoplay-video feature
          sections (spoken.io pattern) using our own CursorFlow +
          price-drop demo clips. Placed AFTER TrendingDeals so the tuned
          LCP (the first trending card image) is untouched; the videos
          are lazy-loaded (preload=none + IntersectionObserver) so they
          cost nothing above the fold. */}
      <HomeVideoShowcase countryCode={country.code} />
      {/* Amazon affiliate promo — placed right after the trending grid so
          it rides the deal-discovery momentum (reads as another way to
          find deals, not an injected ad) while still sitting below the
          hero + primary feed, not jammed up top. */}
      <AmazonPromo country={country} />
      {/* Cashback teaser — restores the pre-launch signup hook that
          was previously a hero strip (removed in c9954c9 because it
          duplicated the nav link and pushed the search input down).
          Sits below the fold so visitors who scroll see it; carries
          its own inline email capture so signup is one step, not
          "click → land on /cashback → submit". */}
      <CashbackTeaser country={country} />
      {/* TrendingSearches moved to /compare in round-4 QA. The
          chips work better as a "try a comparison" rail next to the
          search input than as a standalone homepage section that
          competed with TrendingDeals + CategoryGrid for the same
          attention. */}
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid country={country} />
      </Suspense>
      <StoreLogos country={country} />
      <NewsletterStrip />
      <CTA country={country} />
      <RefreshOnInterval ms={300_000} />
    </>
  );
}
