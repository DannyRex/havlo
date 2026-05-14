import { NextRequest, NextResponse } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry, getCountry, inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import { isStoreSearchUrl } from "@/lib/utils";
import { displayStoreName } from "@/lib/store-display";
import type { OriginFilter, SortOption } from "@/types";

/* No `export const dynamic = "force-dynamic"` here.

   The route's use of `req.nextUrl.searchParams` automatically marks
   it dynamic in Next 14, so `force-dynamic` was redundant — but it
   ALSO caused Next.js to set
   `Cache-Control: public, max-age=0, must-revalidate` on the response,
   which silently overrode the explicit
   `Cache-Control: s-maxage=600, stale-while-revalidate=3600`
   set in the NextResponse below. QA caught this May 2026: Vercel
   edge was still HITting on warm cache somehow, but the shipped
   header didn't match spec and downstream CDN / browser caching was
   far weaker than intended. Removing the directive lets the
   explicit header flow through to clients.

   Route still behaves dynamically because of the searchParams read
   — no caching regression, just a header reconciliation. */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const category    = searchParams.get("category")    ?? undefined;
    /* No discount floor by default. Earlier we required >= 5% off,
       which hid the entire curated SerpAPI catalog (those rows ingest
       at retail price with discount_percent=0 because the upstream
       feed doesn't return a 'was' price). The user-facing contract
       for /deals: show all the deals we know about. The user can
       narrow with the tier filter (0% / 20%+ / 50%+) on the UI. */
    const minDiscount = searchParams.get("minDiscount") ?? "0";
    const sort        = (searchParams.get("sort") as SortOption) ?? "relevance";
    const search      = searchParams.get("search")      ?? undefined;
    const originParam = searchParams.get("origin") as OriginFilter | null;
    const origin      = originParam === "local" || originParam === "intl" ? originParam : "all";
    const limit       = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 24;
    const offset      = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    /* Multi-store filter: comma-separated list of store IDs the user
       has ticked in the Stores filter panel (e.g. ?stores=argos,currys).
       Empty / absent = no filter applied. Trimmed + de-duped + cap at
       50 entries to prevent abusive queries from blowing up the SQL
       IN clause. */
    const storesParam = searchParams.get("stores")?.trim();
    const stores: string[] | undefined = storesParam
      ? Array.from(
          new Set(
            storesParam
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 50)
      : undefined;

    /* Country priority: URL param (when set) > cookie. The URL form
       is what the client sends so the CDN cache key varies per country;
       cookie fallback covers direct API consumers / curl. */
    const countryParam = searchParams.get("country");
    const country = countryParam ? getCountry(countryParam) : getServerCountry();
    const provider = await getActiveBrowseProvider();

    /* Pass through the user's origin choice for every country.

       The previous override forced non-NG users to "intl" regardless
       of what they clicked. Reasoning was "Konga / Jumia / 3C Hub
       aren't shoppable from UK / US", but filterDealsForCountry +
       the inferStoreCountry-based bucket below already handle that.
       The override added nothing and silently broke the UK "Local
       stores" tab: clicking it counted UK retailers in the badge
       (932) but the displayed items were still the cross-border
       intl bucket because effectiveOrigin was being clamped to
       "intl". Retest May 2026 caught the UK default view showing
       a wall of AliExpress with no UK retailers.

       After this change:
         - UK default "All deals"  → returns UK retailers + cross-border
         - UK "Local stores" tab    → returns UK retailers only
         - UK "International" tab   → returns cross-border only
         NG paths unchanged — user choice was already passed through. */
    const effectiveOrigin: OriginFilter = origin;

    /* Bucket 3#5 fix from QA audit — origin counts and result counts
       were both derived but from different pipelines:
         • Result count came from filterDealsForCountry on the
           sort-limited fetch (changed with sort)
         • Origin counts came from a SQL count(*) that ignored
           filterDealsForCountry, the curated catalog merge, and the
           in-memory plausibility filters
       So 'All 897 / Local 202 / Intl 665' (SQL) coexisted with
       '182 deals' (Relevance) and '310 deals' (Latest), and the
       appliances+50% case showed '1' in the toggle but '0' in the
       result. Reconcile by deriving everything from one fetch:
       pull origin='all', country-filter, bucket by currency in-
       memory, then apply the user's chosen origin to the items
       returned. Counts and items are now guaranteed consistent. */
    /* Fetch the BROAD pool — no minDiscount filter passed to the
       provider. The user's tier choice (20%+, 50%+) is applied
       below in JS so we can keep TWO pools:

         broadPool      — un-discount-filtered. Powers the Stores
                          dropdown so 0%-only stores (pharmacies,
                          grocers, Shopify-no-compare-at-price feeds)
                          still appear when the user picks a stricter
                          tier. User report May 2026: "stores without
                          deals should be included as well" — without
                          this split, HealthPlus / MedPlus / Bitmarte /
                          Essenza / Supermart / Ajebomarket vanish
                          from the dropdown whenever tier > 0.

         qualifying     — broadPool ∩ discount tier. Powers the
                          items list + originCounts. These need to
                          match what the user clicks: "Local 50"
                          better mean clicking "Local stores" shows
                          50 items, not 200.

       Egress unchanged: PAGES caps fan-out at 4000 rows regardless
       of whether minDiscount is SQL-filtered or JS-filtered. The
       dual-pass Pass B already pulled 2000 zero-discount rows for
       the default tier; this change just makes that data visible
       in the dropdown for higher tiers too. */
    const userMinDiscount = minDiscount ? parseInt(minDiscount, 10) : 0;
    const allRawAcrossOrigins = await provider.fetchDeals({
      categorySlug: category,
      /* Intentionally NOT passing the user's minDiscount — see
         comment above. Pass 0 to force browse-db's Pass B to fire
         even when the user has a stricter tier picked. */
      minDiscount: 0,
      sort,
      search,
      origin: "all",
    });

    /* Country store filter — pure-function, runs over Deal[] */
    const broadCountryFiltered = filterDealsForCountry(allRawAcrossOrigins, country);

    /* Bucket by store COUNTRY (not currency). Round-4 QA caught
       /uk/deals showing "Local stores: 0" even though John Lewis,
       Argos, Currys cards were visible. Root cause: SerpAPI
       normalises all UK retailer prices to USD before storing, so
       the old `currency === "NGN"` heuristic counted every UK
       retailer as INTL.

       Now: a deal is "local" if its store is anchored in the user's
       country. Argos / Currys / John Lewis → "UK" → local for UK
       shoppers. Konga / 3C Hub / Slot → "NG" → local for NG
       shoppers. AliExpress / Shein / Temu / DHgate → no anchor
       → INTL for everyone. Falls back to the currency check when
       the store can't be inferred (rare, niche scrapers). */
    const isLocalToUser = (d: typeof broadCountryFiltered[0]): boolean => {
      const storeCountry = inferStoreCountry(d.storeId, d.storeName);
      if (storeCountry !== null) {
        return storeCountry.toLowerCase() === country.code.toLowerCase();
      }
      /* Explicit global cross-border stores (AliExpress, Shein, Temu,
         DHgate, …) are NEVER local. Without this short-circuit the
         currency fallback below misclassifies USD-priced AliExpress
         rows as "local" for US visitors (US currency = USD) — exactly
         the bug the May 2026 cross-country audit caught (AliExpress
         was the top store in the US "local" pool at 63 deals). */
      if (isGlobalIntlStore(d.storeId, d.storeName)) return false;
      // Fallback to currency match when store country can't be inferred
      return d.currency === country.currency;
    };

    /* Apply user's origin choice to the BROAD pool — this is the
       pool that drives the Stores dropdown. Country + origin are
       hard intent signals (a UK user on "Local stores" should never
       see Konga in the dropdown); discount tier is a soft preference
       that shouldn't shrink the dropdown. */
    const broadByOrigin =
      effectiveOrigin === "local" ? broadCountryFiltered.filter(isLocalToUser) :
      effectiveOrigin === "intl"  ? broadCountryFiltered.filter((d) => !isLocalToUser(d)) :
      broadCountryFiltered;

    /* Apply the user's discount tier to derive the qualifying pool
       (items + originCounts). When tier=0 this is identical to
       broadCountryFiltered, so no extra work for default views. */
    const qualifyingCountryFiltered = userMinDiscount > 0
      ? broadCountryFiltered.filter((d) => d.discountPercent >= userMinDiscount)
      : broadCountryFiltered;
    const qualifyingLocal = qualifyingCountryFiltered.filter(isLocalToUser);
    const qualifyingIntl  = qualifyingCountryFiltered.filter((d) => !isLocalToUser(d));
    const originCounts = {
      all:   qualifyingCountryFiltered.length,
      local: qualifyingLocal.length,
      intl:  qualifyingIntl.length,
    };

    /* Items pool: qualifying pool, narrowed to the user's origin choice. */
    const qualifyingByOrigin =
      effectiveOrigin === "local" ? qualifyingLocal :
      effectiveOrigin === "intl"  ? qualifyingIntl  :
      qualifyingCountryFiltered;

    /* Degraded-response detector — fires when browse_deals RPC failed
       upstream and getCuratedDeals() served the response instead. In
       that case every item has a storeId like amazon-uk-* / amazon-us-*
       / amazon-de-* (the curated catalog is Amazon-only). Production
       data is never Amazon-only; even sparse markets surface a few
       cross-border stores. We use this as the cache-poisoning safeguard:
       when degraded, the response gets `Cache-Control: no-store` so
       Vercel + Next.js + browser caches all refuse to retain it.

       Why this matters: the SSR fetch in /[country]/deals/page.tsx now
       uses cache: "no-store" (May 2026 fix). But this header is a
       second layer of defence — any future re-enabling of fetch cache,
       any CDN downstream, any client-side cache, all see no-store and
       refuse to retain the bad response. */
    const looksLikeCuratedFallback =
      allRawAcrossOrigins.length > 0 &&
      allRawAcrossOrigins.length <= 80 &&
      allRawAcrossOrigins.every((d) => d.storeId.startsWith("amazon-") || d.storeId === "amazon");

    /* Build the stores aggregate as a HYBRID:

       • Store LIST comes from the broad pool — every store in the
         country/category/origin context appears, including 0%-only
         pharmacies / grocers that have no qualifying inventory at
         the current tier. So users at tier=20%+ still see HealthPlus
         in the dropdown.

       • Store COUNT comes from the qualifying pool — the number next
         to each store matches the items that will appear in the feed
         after that store is ticked. So if a user reads "HealthPlus
         (12)" and clicks, they see 12 items — not 554.

       Before this hybrid, the count was sourced from the broad pool
       and didn't match post-click reality. User report May 2026:
       "some stores show a wrong number in the dropdown and it
       changes when the store is selected." The number actually
       changed because tier-filtered items came back with a smaller
       total — fixed by reconciling the two upfront. */
    /* Consolidate the dropdown by DISPLAY name (not raw storeId).
       SerpAPI's ingest creates one row per seller variant — Walmart
       alone produces "walmart", "walmart-carote-official",
       "walmart-turtle-beach", … (8+ variants). The previous
       per-storeId aggregate showed each as a separate entry, and
       ticking the bare "Walmart" matched only 2 of the 15 actual
       Walmart deals. User report May 2026: "/us/deals?stores=walmart
       shows '15' in header but '0 deals' in body."

       Now every variant whose displayStoreName collapses to the
       same canonical name (Walmart, Amazon UK, Currys, etc.) gets
       merged into ONE dropdown entry. The entry's `id` becomes the
       canonical display name (lowercased), and `count` sums all
       variants' qualifying counts. The filter pass below matches
       items by displayStoreName too, so ticking one entry catches
       every underlying variant. */
    const canonicalKey = (storeName: string) => displayStoreName(storeName).toLowerCase();

    const storesAggregate = (() => {
      /* First pass: qualifying-pool counts grouped by canonical
         display name. */
      const qualifyingCounts = new Map<string, number>();
      for (const d of qualifyingByOrigin) {
        if (!d.storeId) continue;
        const key = canonicalKey(d.storeName);
        qualifyingCounts.set(key, (qualifyingCounts.get(key) ?? 0) + 1);
      }
      /* Second pass: walk the broad pool to collect the store list
         (so 0%-only stores still appear) and stamp each with its
         qualifying count (0 when the store has no items at the
         user's current tier). Keyed on canonical name; the entry's
         `id` IS that canonical key so the URL stays human-readable
         ("?stores=walmart" rather than a UUID). */
      const map = new Map<string, { id: string; name: string; count: number }>();
      for (const d of broadByOrigin) {
        if (!d.storeId) continue;
        const key  = canonicalKey(d.storeName);
        if (map.has(key)) continue;
        const name = displayStoreName(d.storeName);
        map.set(key, { id: key, name, count: qualifyingCounts.get(key) ?? 0 });
      }
      /* Sort by qualifying count DESC so the stores with the most
         actionable inventory at the current tier float to the top
         of the dropdown. Stores with count=0 (visible but empty)
         settle at the bottom. */
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    })();

    /* Multi-store filter — match by canonical display name now that
       the dropdown's `id` is the display key. Falls back to storeId
       match too (defensive — older clients may pass a raw storeId
       from a shared link). */
    const all = stores && stores.length > 0
      ? qualifyingByOrigin.filter((d) => {
          if (stores.includes(d.storeId.toLowerCase())) return true;
          return stores.includes(canonicalKey(d.storeName));
        })
      : qualifyingByOrigin;

    const total = all.length;
    const sliced = all.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    /* Trim per-item payload before serialising. The full Deal shape
       carries 21 fields totalling ~1.9KB per row — but the cards only
       read 14, and the single biggest field is `url` (Google Shopping
       URLs run 1000+ chars per row, ~55% of the per-item payload).

       Cards link to the PDP first (`/p/{id}`), not directly to the
       merchant, so the URL itself is never read on the deals surface.
       The only consumer of `url` was `isStoreSearchUrl(deal.url)` to
       decide whether to show a "from $X" prefix — pre-compute that
       boolean server-side and ship just the bit.

       Net per-item: ~1.9KB → ~500 bytes (75% reduction). 24-item
       page: 57KB → ~14KB on the wire. Big win on poor networks +
       Vercel egress. */
    const items = sliced.map((d) => ({
      id:              d.id,
      title:           d.title,
      /* `description` shipped as empty string — duplicates `title`
         in 99%+ of rows and isn't read by any card surface. Keeps
         the Deal type satisfied without bloating the wire. */
      description:     "",
      category:        d.category,
      categorySlug:    d.categorySlug,
      storeId:         d.storeId,
      storeName:       d.storeName,
      originalPrice:   d.originalPrice,
      salePrice:       d.salePrice,
      discountPercent: d.discountPercent,
      currency:        d.currency,
      imageUrl:        d.imageUrl,
      imageGradient:   d.imageGradient,
      imageEmoji:      d.imageEmoji,
      /* `url` intentionally empty — Google Shopping URLs are 1KB+
         each and the cards link to PDP first (`/p/{id}`), not
         directly to the merchant. The full URL lives on the
         offer record fetched by the PDP itself. */
      url:             "",
      expiresAt:       null,
      isHot:           false,
      isFeatured:      false,
      tags:            [],
      saves:           0,
      clicks:          0,
      postedAt:        d.postedAt,
      /* Pre-computed boolean — cards read this instead of running
         isStoreSearchUrl(deal.url) themselves (which can't work
         anyway now that url is empty). */
      isPriceFromOnly: isStoreSearchUrl(d.url),
    }));

    /* Cache window bumped May 2026 from s-maxage=60/swr=300 to
       s-maxage=600/swr=3600 — Supabase egress crossed the free-tier
       cap. 10 minutes of staleness is invisible to browsers (prices
       on the deals feed move on hour-scale, not minute-scale) and
       the SWR window means a stale page renders instantly while a
       fresh one warms in the background.

       Manual Response (not NextResponse.json) — bypasses the Next 14
       quirk where dynamic routes silently strip user-set
       Cache-Control headers in favour of `private, no-cache,
       no-store`. The QA verified post-deploy that NextResponse.json's
       header didn't reach the wire. Returning a plain Response with
       headers explicitly set bypasses Next's response-wrapper.

       Cache key varies by full URL (every filter combo gets its own
       slot), so this won't accidentally serve UK results to NG users. */
    return new Response(
      JSON.stringify({ items, total, hasMore, originCounts, stores: storesAggregate, provider: provider.id }),
      {
        status: 200,
        headers: {
          "Content-Type":  "application/json",
          /* Degraded responses (browse_deals RPC fell back to curated)
             are explicitly NOT cached — see looksLikeCuratedFallback
             check above. Production responses keep the normal SWR
             cache so warm visitors hit the edge. */
          "Cache-Control": looksLikeCuratedFallback
            ? "private, no-store, no-cache, max-age=0, must-revalidate"
            : "s-maxage=600, stale-while-revalidate=3600",
          /* Diagnostic header so we can grep nginx / Vercel logs for
             fallback hits and know when to investigate the RPC. */
          "X-Havlo-Degraded": looksLikeCuratedFallback ? "curated-fallback" : "ok",
        },
      },
    );
  } catch (err) {
    console.error("[/api/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
