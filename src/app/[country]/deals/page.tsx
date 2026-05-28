import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import DealFeed from "@/components/deals/DealFeed";
import JsonLd from "@/components/seo/JsonLd";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import { getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";
import type { Deal } from "@/types";

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

/* Server-side fetch helper. Calls our own /api/deals so the SSR
   path uses identical logic + cache as the client refetch — no
   risk of drift between "what server thought" vs "what client sees
   after first filter change". The fetch URL is absolute (built
   from incoming request host) because Node fetch on the server
   can't resolve relative URLs.

   Errors swallowed → empty initial state → DealFeed renders the
   skeleton + falls through to client-side fetch on mount. Belt-
   and-braces: server-fetch failure shouldn't break the page. */
interface InitialDealsBundle {
  items:        Deal[];
  total:        number;
  hasMore:      boolean;
  originCounts: { all: number; local: number; intl: number } | undefined;
  storeOptions: Array<{ id: string; name: string; count: number }> | undefined;
}
async function fetchInitialDeals(
  params: { country: string; category?: string; tier?: string; sort?: string; search?: string; origin?: string; stores?: string },
): Promise<InitialDealsBundle | null> {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "havlo.io";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const qs = new URLSearchParams();
    qs.set("country", params.country);
    /* SSR limit bumped May 2026 re-audit from 24 → 60. Bots, audit
       tools, and headless renderers see only the SSR-emitted HTML;
       the client-side IntersectionObserver pagination doesn't fire
       for them. 60 cards in initial HTML give SEO crawlers a
       meaningful crawl depth and let any HTML-based audit see the
       full first-screen + several scrolls' worth of inventory.
       Wire-size impact: ~30 KB → ~75 KB per /deals HTML response
       (with the per-item payload trim in /api/deals keeping the
       per-card cost around 500 bytes). Trade is worth it for
       discoverability + audit signal. */
    qs.set("limit",   "60");
    qs.set("offset",  "0");
    if (params.category) qs.set("category",    params.category);
    if (params.tier)     qs.set("minDiscount", params.tier);
    if (params.sort)     qs.set("sort",        params.sort);
    if (params.search)   qs.set("search",      params.search);
    if (params.origin)   qs.set("origin",      params.origin);
    if (params.stores)   qs.set("stores",      params.stores);
    /* 60s SSR fetch cache (May 2026 paint-speed pass).
     *
     * History: was `cache: "no-store"` because the cache-poisoning
     * fallback bug (UK Amazon-only HTML cached for 10 min) made
     * any persistent cache catastrophic. That class is now mitigated
     * at TWO layers:
     *   1. /api/deals detects `looksLikeCuratedFallback` and sets
     *      `Cache-Control: no-store, no-cache` on degraded responses,
     *      plus the `X-Havlo-Degraded: curated-fallback` header.
     *   2. The route's own POOL_CACHE versioning (`v3-3pass` prefix)
     *      means old function instances can't write under the same
     *      key as new ones.
     *
     * With those guards in place, a 60s SSR fetch cache is safe AND
     * trims ~1-2s off every cold-cache page load (~95% of visits to
     * a low-traffic /[country]/deals route). If the RPC ever does
     * fail and produces a curated-fallback response, the worst case
     * is 60s of stale Amazon-only HTML before the cache expires and
     * the next SSR refreshes from a recovered API.
     *
     * User report May 2026: "/deals takes long to paint content".
     * Wall-time before this fix: ~1.5-2s cold (Vercel SSR fn cold
     * start + 3-pass RPC + 200KB JSON parse). After: ~50ms for
     * cache-hit visits, ~1.5s for the 1-in-60s cache-miss visitor.
     */
    const url = `${proto}://${host}/api/deals?${qs.toString()}`;
    /* Sort-aware cache window. The relevance sort uses seeded jitter
       inside /api/deals (its own s-maxage is 60s for relevance) so a
       visitor's first-page rotates as the jitter re-rolls — drop the
       SSR fetch cache to 60s for relevance so the SSR'd first page
       cycles in lockstep with that. The previous 600s window meant
       every visit inside a 10-minute span saw the identical first 60
       cards regardless of jitter, which read as "the pool didn't
       increase". Non-rotating sorts (newest, price_*) stay on the
       600s window — they don't benefit from faster cycling and the
       longer window keeps Fluid CPU + Supabase egress in check. */
    const isRotatingSort = !params.sort || params.sort === "relevance";
    const res = await fetch(url, { next: { revalidate: isRotatingSort ? 60 : 600 } });
    if (!res.ok) {
      /* Log the status so Vercel captures the SSR-time failure.
         Previously `if (!res.ok) return null` silently degraded to
         the skeleton + client-side fetch path, indistinguishable
         from a healthy first paint — no signal to investigate. */
      console.error(`[fetchInitialDeals] /api/deals returned ${res.status}`, { url });
      return null;
    }
    const j = await res.json();
    return {
      items:        j.items ?? [],
      total:        j.total ?? 0,
      hasMore:      j.hasMore ?? false,
      originCounts: j.originCounts,
      storeOptions: Array.isArray(j.stores) ? j.stores : undefined,
    };
  } catch (err) {
    /* Same rationale — surface the underlying error to Vercel
       logs so a persistent SSR failure doesn't masquerade as a
       successful skeleton render. */
    console.error("[fetchInitialDeals] threw", (err as Error).message);
    return null;
  }
}

export default async function DealsPage({
  params,
  searchParams,
}: {
  params:       { country: string };
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const country = getCountry(params.country);
  const breadcrumb = buildBreadcrumbList([
    { name: "Havlo",      url: `${SITE_URL}/${country.code}` },
    { name: country.name, url: `${SITE_URL}/${country.code}` },
    { name: "Deals",      url: `${SITE_URL}/${country.code}/deals` },
  ]);

  /* Pre-fetch the FIRST page server-side. Eliminates the skeleton
     flash on first paint — the initial HTML carries real cards.
     Filters from URL search params are forwarded so a deep link like
     /uk/deals?category=phones&minDiscount=20 SSRs the filtered view
     directly, not the default + then a client refetch. */
  const pickFirst = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  /* origin default must match DealFeed's client-side default
     ("local" — see comment in DealFeed.tsx for the full history;
     founder direction May 2026 to revert to local-first). When the
     URL has no ?origin=, we fetch the local pool server-side so
     SSR + client first-paint agree. */
  const initial = await fetchInitialDeals({
    country:  country.code,
    category: pickFirst("category"),
    tier:     pickFirst("minDiscount"),
    sort:     pickFirst("sort"),
    search:   pickFirst("search"),
    origin:   pickFirst("origin") ?? "local",
    stores:   pickFirst("stores"),
  });

  return (
    <>
      <JsonLd data={breadcrumb} />
      <Suspense>
        {/* `key={country.code}` forces React to UN-mount + RE-mount
            DealFeed when the visitor switches countries. Without
            this, DealFeed's filter state (initialised from URL via
            useState on first render) survives the navigation and
            silently keeps the old country's category / origin /
            store-filter selections. The audit May 2026 caught the
            visible symptom: switching from /uk/deals?category=
            phones to NG landed on /ng/deals?origin=local with
            ?category=phones silently stripped because state
            survived the country swap, then wrote back the old
            origin via the URL-sync useEffect.

            Re-mount cost: a brief skeleton flicker during the
            country swap (the new country's SSR'd initial fetch
            still seeds the freshly-mounted DealFeed, so it's
            faster than a full client cold-start). Worth it for
            correct state semantics. */}
        <DealFeed
          key={country.code}
          initialItems={initial?.items}
          initialTotal={initial?.total}
          initialHasMore={initial?.hasMore}
          initialOriginCounts={initial?.originCounts}
          initialStoreOptions={initial?.storeOptions}
        />
      </Suspense>
      {/* Newsletter signup at the bottom of the feed. Added May 2026
          launch-readiness pass — was previously homepage-only. A
          visitor who scrolls the whole /deals feed without finding
          what they want still gets the signup prompt. */}
      <NewsletterStrip />
    </>
  );
}
