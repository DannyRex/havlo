import { NextRequest, NextResponse } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import { getServerCountry } from "@/lib/country-server";
import { filterDealsForCountry, getCountry } from "@/lib/country";
import type { OriginFilter, SortOption } from "@/types";

export const dynamic = "force-dynamic";

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

    /* Country priority: URL param (when set) > cookie. The URL form
       is what the client sends so the CDN cache key varies per country;
       cookie fallback covers direct API consumers / curl. */
    const countryParam = searchParams.get("country");
    const country = countryParam ? getCountry(countryParam) : getServerCountry();
    const isNG = country.code === "ng";
    const provider = await getActiveBrowseProvider();

    /* For non-NG users, override the origin filter to "intl" — Konga /
       Jumia / 3C Hub aren't shoppable from the UK / US / etc. Even
       within the intl pool we then run filterDealsForCountry to drop
       NG-anchored stores and keep only the user's country + cross-
       border globals. NG users keep the full origin choice (toggle
       between local / intl / all on the /deals UI). */
    const effectiveOrigin: OriginFilter = !isNG && origin === "local"
      ? "intl"
      : (!isNG ? "intl" : origin);

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
    const allRawAcrossOrigins = await provider.fetchDeals({
      categorySlug: category,
      minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
      sort,
      search,
      origin: "all",
    });

    /* Country store filter — pure-function, runs over Deal[] */
    const allFiltered = filterDealsForCountry(allRawAcrossOrigins, country);

    /* Bucket by currency-as-origin so the toggle counts and items
       always match. NGN-priced items count as local; USD/other count
       as intl. Same heuristic the dealToStoreRow ingestion uses. */
    const localFiltered = allFiltered.filter((d) => d.currency === "NGN");
    const intlFiltered  = allFiltered.filter((d) => d.currency !== "NGN");
    const originCounts = {
      all:   allFiltered.length,
      local: localFiltered.length,
      intl:  intlFiltered.length,
    };

    /* Apply the user's origin filter for the items in the response. */
    const all =
      effectiveOrigin === "local" ? localFiltered :
      effectiveOrigin === "intl"  ? intlFiltered  :
      allFiltered;

    const total = all.length;
    const items = all.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return NextResponse.json(
      { items, total, hasMore, originCounts, provider: provider.id },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("[/api/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
