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
    /* Floor: when no minDiscount is requested, hide items with <5% off so
       the default /deals view feels like deals, not a generic catalog.
       Users who explicitly want "any" can still pass minDiscount=0. */
    const minDiscount = searchParams.get("minDiscount") ?? "5";
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

    const allRaw = await provider.fetchDeals({
      categorySlug: category,
      minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
      sort,
      search,
      origin: effectiveOrigin,
    });

    /* Country store filter — pure-function, runs over Deal[] */
    const all = filterDealsForCountry(allRaw, country);

    // Counts ignore the current `origin` filter so the toggle can show
    // "what would I get if I switched"
    const originCounts = await provider.getOriginCounts({
      categorySlug: category,
      minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
      search,
    });

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
