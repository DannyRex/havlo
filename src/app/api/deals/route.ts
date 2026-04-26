import { NextRequest, NextResponse } from "next/server";
import { getActiveBrowseProvider } from "@/lib/providers";
import type { OriginFilter, SortOption } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const category    = searchParams.get("category")    ?? undefined;
    const minDiscount = searchParams.get("minDiscount") ?? undefined;
    const sort        = (searchParams.get("sort") as SortOption) ?? "newest";
    const search      = searchParams.get("search")      ?? undefined;
    const originParam = searchParams.get("origin") as OriginFilter | null;
    const origin      = originParam === "local" || originParam === "intl" ? originParam : "all";
    const limit       = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 24;
    const offset      = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const provider = await getActiveBrowseProvider();

    const all = await provider.fetchDeals({
      categorySlug: category,
      minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
      sort,
      search,
      origin,
    });

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
