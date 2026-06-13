import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import DealFeed from "@/components/deals/DealFeed";
import MasonryCard from "@/components/deals/MasonryCard";
import JsonLd from "@/components/seo/JsonLd";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import { getCountry } from "@/lib/country";
import { categories } from "@/lib/data/categories";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList, buildItemListJsonLd } from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";
import { isSyntheticId } from "@/lib/pdp-url";
import type { Deal } from "@/types";

/* ISR — /[country]/deals is now STATICALLY prerendered + revalidated
   every 10 minutes instead of re-rendering on the origin for every
   request.

   History: the page was dynamic by design — it read `searchParams` to
   SSR the filtered/searched view and `headers()` to build an absolute
   self-fetch URL. Both reads opt the route out of static generation, so
   Vercel served it `x-vercel-cache: MISS` + `private, no-store` and
   re-rendered ~373 KB on the origin every hit — the dominant driver of
   Vercel "Fast Origin Transfer" (every other page is already
   PRERENDER/ISR). The June 2026 egress audit flagged it.

   The fix splits the surface in two:
     • A statically-SSR'd DEFAULT deals grid (the <Suspense> fallback
       below) — real product cards baked into the prerendered HTML so
       crawlers keep their crawl depth and the page paints instantly
       from the edge.
     • The interactive <DealFeed> (filters, search, infinite scroll) is
       a client component that reads `useSearchParams`, which forces a
       static page dynamic unless wrapped in <Suspense>. On the client
       it reads the URL and fetches /api/deals itself for any
       filtered/searched view — it already did this for every filter
       change. Deep links like /uk/deals?category=phones resolve
       correctly: the client reads the param on mount and fetches the
       filtered set (skeleton → results).

   The `?search=` best-price comparison header moved to a client fetch
   inside DealFeed (its /api/compare effect), so it works for both
   client navigation and direct deep-links without re-introducing a
   server read here. */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/deals`;
  const title = `Deals worth checking today in ${country.name}`;
  const description = `Price drops and offers from the stores you already shop in ${country.name}. Filter by category, brand, and discount.`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("deals"),
    },
    openGraph: {
      title:       `${title} · Havlo`,
      description,
      url,
      type:        "website",
    },
    twitter: {
      card:        "summary_large_image",
      title:       `${title} · Havlo`,
      description,
    },
  };
}

/* Server-side fetch of the DEFAULT deals view. Calls our own /api/deals
   so the SSR seed uses identical logic + cache as DealFeed's client
   refetch — no drift between "what the server SSR'd" and "what the
   client sees after its first filter change".

   The absolute URL is built from SITE_URL (not `headers()`) so the page
   stays statically renderable. We deliberately fetch ONLY the default
   view (origin=local, no category/tier/sort/search/stores): the page is
   static now, so searchParams don't exist at prerender time. The default
   seed is both the SEO grid (fallback) and the seed passed to DealFeed;
   any filtered/searched view is resolved client-side.

   Errors swallowed → null → the fallback renders an empty grid and
   DealFeed recovers via its client-side mount fetch. */
interface InitialDealsBundle {
  items:        Deal[];
  total:        number;
  hasMore:      boolean;
  originCounts: { all: number; local: number; intl: number } | undefined;
  storeOptions: Array<{ id: string; name: string; count: number }> | undefined;
  /* True when /api/deals served the degraded curated-Amazon fallback.
     Forwarded to DealFeed so it refetches client-side instead of
     seeding a bogus empty/Amazon-only first paint. */
  degraded:     boolean;
}
async function fetchDefaultDeals(countryCode: string, seed: string): Promise<InitialDealsBundle | null> {
  try {
    const qs = new URLSearchParams();
    qs.set("country", countryCode);
    /* 40 cards — strong first-paint + multi-scroll crawl-depth signal
       (May 2026 bumped 24→60 for SEO; June 2026 trimmed 60→40 in the
       egress audit). Real users keep getting infinite scroll client-side. */
    qs.set("limit",  "40");
    qs.set("offset", "0");
    /* origin=local matches DealFeed's client-side default ("local"
       everywhere — founder direction May 2026) so the SSR seed and the
       client's first render agree on the default view. */
    qs.set("origin", "local");
    /* minDiscount=10 matches DealFeed's DEFAULT_TIER ("10", Deals): the
       page is called Deals, so it leads with genuine markdowns by default.
       Must stay in lockstep with DEFAULT_TIER + isDefaultView in DealFeed
       or the SSR seed mismatches the client's first render. */
    qs.set("minDiscount", "10");
    /* Pin the relevance rotation to one seed for this prerender, the
       SAME seed handed to DealFeed (initialSeed) so its client load-more
       continues the identical order — no recycling across offsets. On a
       static page the seed is frozen per revalidation window, which is
       the intended trade for edge-caching the surface. */
    qs.set("seed", seed);

    const url = `${SITE_URL}/api/deals?${qs.toString()}`;
    /* 600s cache, aligned with this page's `revalidate`. Tagged so the
       on-demand bust in /api/live-search (revalidateTag(`deals:{cc}`),
       fired after a compare-page live search persists fresh offers)
       refreshes the prerendered seed on the next load instead of waiting
       out the window. */
    const res = await fetch(url, {
      next: {
        revalidate: 600,
        tags: ["deals", `deals:${countryCode.toLowerCase()}`],
      },
    });
    if (!res.ok) {
      console.error(`[fetchDefaultDeals] /api/deals returned ${res.status}`, { url });
      return null;
    }
    const j = await res.json();
    return {
      items:        j.items ?? [],
      total:        j.total ?? 0,
      hasMore:      j.hasMore ?? false,
      originCounts: j.originCounts,
      storeOptions: Array.isArray(j.stores) ? j.stores : undefined,
      degraded:     j.degraded === true,
    };
  } catch (err) {
    console.error("[fetchDefaultDeals] threw", (err as Error).message);
    return null;
  }
}

/* Static SEO grid — the default deals rendered server-side into the
   prerendered HTML (this is the <Suspense> fallback for DealFeed). Keeps
   real product cards + crawlable PDP links in the document crawlers see,
   and paints instantly from the edge while the interactive DealFeed
   hydrates and swaps in (seeded with the SAME deals, so the swap is
   seamless on the default view).

   Mirrors DealFeed's header + grid markup so the fallback→DealFeed swap
   doesn't reshape the cards. NO AnimateIn wrapper here: AnimateIn starts
   at opacity:0 until its mount effect runs, which would hide the SEO
   grid before JS — these cards must be visible in the static HTML. */
function DefaultDealsGrid({ deals }: { deals: Deal[] }) {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-6 sm:mb-8 px-1 sm:px-0">
        <h1 className="text-[28px] sm:text-4xl font-bold text-ink tracking-[-0.03em] leading-tight">
          Browse deals & new arrivals
        </h1>
        <p className="text-sm sm:text-base text-ink-2 mt-2 max-w-2xl">
          The newest deals first, then everything else.
        </p>
      </div>

      {deals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {deals.map((d, i) => (
            <div key={d.id}>
              <MasonryCard
                deal={d}
                aspect="aspect-[4/5]"
                /* First 4 are the LCP candidates across viewports. */
                priority={i < 4}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function DealsPage({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
  ]);

  /* One rotation seed for this prerender, threaded into the SSR fetch AND
     handed to DealFeed (initialSeed) for every load-more, so the
     relevance order stays fixed for the whole scroll session and offsets
     never re-serve already-seen products. On a static page Date.now() is
     the prerender timestamp (frozen per 600s revalidation), which is the
     accepted cost of edge-caching this surface; /api/deals validates the
     `seed` param as a numeric bucket. */
  const rotationSeed = String(Math.floor(Date.now() / 60000));

  /* Pre-fetch the DEFAULT first page server-side. It seeds both the SEO
     grid (the Suspense fallback) and DealFeed's initial state, so the
     prerendered HTML carries real cards and the default view paints with
     zero skeleton flash. */
  const initial = await fetchDefaultDeals(country.code, rotationSeed);
  const defaultDeals = initial?.items ?? [];

  /* ItemList JSON-LD over the SSR'd first page, so the structured
     product list matches the cards actually present in the initial
     HTML. Skip synthetic/live rows (their /p/live URLs are query-param
     PDPs, not canonical product pages) and map each real deal to its
     canonical /[country]/p/[id] URL. Deal has no brand field, so brand
     is left null — the builder omits it rather than misrepresenting the
     store as the brand. Emitted only when the page actually rendered
     deals, so a degraded SSR fetch doesn't ship an empty ItemList. */
  const seoDeals: SeoDeal[] = defaultDeals
    .filter((d) => !isSyntheticId(d.id))
    .slice(0, 24)
    .map((d) => ({
      title:           d.title,
      url:             `${SITE_URL}/${country.code}/p/${d.id}`,
      imageUrl:        d.imageUrl,
      storeName:       d.storeName,
      salePrice:       d.salePrice,
      originalPrice:   d.originalPrice,
      currency:        d.currency,
      discountPercent: d.discountPercent,
      brand:           null,
    }));
  const itemList = seoDeals.length > 0
    ? buildItemListJsonLd(seoDeals, `Deals in ${country.name} on Havlo`)
    : null;

  return (
    <>
      <JsonLd data={itemList ? [breadcrumb, itemList] : breadcrumb} />

      {/* The interactive feed reads `useSearchParams`, which forces a
          static page dynamic unless wrapped in <Suspense>. The fallback
          is the statically-SSR'd default grid (real cards in the
          prerendered HTML for SEO); DealFeed hydrates and swaps in,
          seeded with the same default deals so the default view doesn't
          flicker. A filtered/searched deep link is resolved by DealFeed
          client-side (skeleton → results).

          `key={country.code}` forces a clean re-mount on country switch
          so filter state never survives the navigation (audit May 2026:
          switching /uk/deals?category=phones → NG silently kept the old
          category). */}
      <Suspense fallback={<DefaultDealsGrid deals={defaultDeals} />}>
        <DealFeed
          key={country.code}
          initialSeed={rotationSeed}
          initialItems={initial?.items}
          initialTotal={initial?.total}
          initialHasMore={initial?.hasMore}
          initialOriginCounts={initial?.originCounts}
          initialStoreOptions={initial?.storeOptions}
          initialDegraded={initial?.degraded}
        />
      </Suspense>

      {/* Crawlable category + brand hub links. The feed's own CategoryNav
          is button-driven (JS filter, no href) so it doesn't de-orphan
          anything. This section emits REAL anchors to the per-category
          hub pages (/[cc]/deals/[slug]) and the brand index, which is
          how the GSC-flagged orphaned PDP corpus gets discovered: feed
          (footer + homepage linked) → category/brand hubs → PDPs.
          Rendered server-side so it's in the SSR HTML crawlers see. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="pt-10 border-t border-border">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-3 mb-4">
            Browse {country.name} deals by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== "all")
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/${country.code}/deals/${c.slug}`}
                  className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            <Link
              href={`/${country.code}/brands`}
              className="px-3.5 py-2 rounded-full border border-border bg-surface-2 text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
            >
              Shop by brand
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter signup at the bottom of the feed. Added May 2026
          launch-readiness pass — was previously homepage-only. A
          visitor who scrolls the whole /deals feed without finding
          what they want still gets the signup prompt. */}
      <NewsletterStrip />

      {/* Back-to-top FAB (#21) — the deals feed is a long, lazy-loading
          scroll surface, so give the visitor a one-tap way back up. */}
      <ScrollToTopButton />
    </>
  );
}
