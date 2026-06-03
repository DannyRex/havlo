import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import DealFeed from "@/components/deals/DealFeed";
import JsonLd from "@/components/seo/JsonLd";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import { getCountry } from "@/lib/country";
import { categories } from "@/lib/data/categories";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList, buildItemListJsonLd } from "@/lib/seo";
import type { SeoDeal } from "@/lib/seo";
import { isSyntheticId } from "@/lib/pdp-url";
import type { Deal } from "@/types";
import type { ProductGroup } from "@/lib/search";

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
  /* True when /api/deals served the degraded curated-Amazon fallback.
     Forwarded to DealFeed so it refetches client-side instead of
     seeding a bogus empty/Amazon-only first paint. */
  degraded:     boolean;
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
      degraded:     j.degraded === true,
    };
  } catch (err) {
    /* Same rationale — surface the underlying error to Vercel
       logs so a persistent SSR failure doesn't masquerade as a
       successful skeleton render. */
    console.error("[fetchInitialDeals] threw", (err as Error).message);
    return null;
  }
}

/* Confidence gate for the best-price header.

   A Hero freeform search lands on /deals?search=…; we only want the
   "Best price across stores" comparison card when the query clearly
   denotes ONE product, not when it's a bare category or brand
   ("sneakers", "laptops", "adidas"). Two cheap, deterministic signals:
     1. >= 2 meaningful tokens. Single-token queries at this surface
        are overwhelmingly categories/brands — too broad for a single-
        product price claim.
     2. The anchor title contains a strong majority of the query
        tokens, i.e. the FTS top hit actually IS what they searched —
        guards against FTS latching onto a tangential product via one
        shared word. */
function isConfidentProductQuery(search: string, anchorTitle: string, distinctStores: number): boolean {
  const STOP = new Set([
    "the", "a", "an", "for", "with", "and", "of", "in", "on", "new",
    "best", "cheap", "cheapest", "price", "prices", "deal", "deals", "buy", "sale",
  ]);
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const qTokens = tokenize(search).filter((t) => !STOP.has(t));
  if (qTokens.length < 2) return false;
  const titleTokens = new Set(tokenize(anchorTitle));
  const hits = qTokens.filter((t) => titleTokens.has(t)).length;
  /* Tier the overlap requirement by corroboration. 2+ distinct stores
     carrying the SAME matched product is itself evidence the anchor is
     correct, so 60% token overlap is enough. A SINGLE-store anchor has
     no such corroboration, so require EVERY meaningful query token in
     the title — otherwise a generic-category match ("scanfrost chest
     freezer" -> "snowsea chest deep freezer", sharing only chest +
     freezer) would headline a DIFFERENT brand as "best price we found".
     This is what makes the single-store loosening (June 2026) safe. */
  const need = distinctStores >= 2 ? Math.ceil(qTokens.length * 0.6) : qTokens.length;
  return hits >= need;
}

/* Resolve the landing search to a confident cross-store comparison
   anchor, or null. Calls our own /api/compare on its FTS q-path —
   which does NOT fan out to live-search (that's a separate client-side
   /api/live-search call) and does NOT invoke the LLM judge (that lives
   only on the pid path, pgFtsFindByProductId). So this stays cheap and
   reuses /api/compare's 1h edge cache. The anchor is returned for any
   confident product query with >= 1 in-stock offer. The header copy
   adapts to the store count ("Best price across stores" for 2+ stores,
   "Best price we found" for a single store) and CompareAnchorCard hides
   its spread + says "Available at" when there's one store, so a
   one-store anchor never implies a cross-store comparison that isn't
   there. (Founder direction June 2026: the strict 2-store gate stayed
   silent on most real queries given thin cross-store catalog overlap.) */
async function fetchComparisonForSearch(
  search: string,
  countryCode: string,
): Promise<{ anchor: ProductGroup; query: string } | null> {
  const q = search.trim();
  if (!q) return null;
  try {
    const h = headers();
    const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "havlo.io";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/api/compare?q=${encodeURIComponent(q)}&country=${encodeURIComponent(countryCode)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.mode !== "similar" || !data.anchor) return null;
    const anchor = data.anchor as ProductGroup;
    const distinctStores = new Set((anchor.offers ?? []).map((o) => o.storeId)).size;
    if (distinctStores < 1) return null;   // single-store OK; header reads "Best price we found"
    if (!isConfidentProductQuery(q, anchor.title, distinctStores)) return null;
    return { anchor, query: q };
  } catch (err) {
    console.error("[fetchComparisonForSearch] threw", (err as Error).message);
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
  const searchParam = pickFirst("search");
  /* Resolve the feed AND (only for a freeform text search) a possible
     cross-store best-price header in parallel, so the comparison probe
     adds no serial latency to the page. fetchComparisonForSearch is
     self-gating: it returns null for ambiguous/category queries and
     anything with no in-stock offer, so we always attempt it when
     a search is present and let it decide. */
  const [initial, comparison] = await Promise.all([
    fetchInitialDeals({
      country:  country.code,
      category: pickFirst("category"),
      tier:     pickFirst("minDiscount"),
      sort:     pickFirst("sort"),
      search:   searchParam,
      origin:   pickFirst("origin") ?? "local",
      stores:   pickFirst("stores"),
    }),
    searchParam ? fetchComparisonForSearch(searchParam, country.code) : Promise.resolve(null),
  ]);

  /* ItemList JSON-LD over the SSR'd first page, so the structured
     product list matches the cards actually present in the initial
     HTML. Skip synthetic/live rows (their /p/live URLs are query-param
     PDPs, not canonical product pages) and map each real deal to its
     canonical /[country]/p/[id] URL. Deal has no brand field, so brand
     is left null — the builder omits it rather than misrepresenting the
     store as the brand. Emitted only when the page actually rendered
     deals, so a degraded SSR fetch doesn't ship an empty ItemList. */
  const seoDeals: SeoDeal[] = (initial?.items ?? [])
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
          initialComparison={comparison}
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
                  className="px-3.5 py-2 rounded-full bg-surface-2 border border-border text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            <Link
              href={`/${country.code}/brands`}
              className="px-3.5 py-2 rounded-full bg-surface-2 border border-border text-ink-2 text-sm hover:border-border-strong hover:text-ink transition-colors"
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
