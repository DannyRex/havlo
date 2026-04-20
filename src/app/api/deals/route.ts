import { NextRequest, NextResponse } from "next/server";
import { getDeals, getOriginCounts } from "@/lib/data/deals";
import type { OriginFilter, SortOption } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const category    = searchParams.get("category")    ?? undefined;
  const minDiscount = searchParams.get("minDiscount")  ?? undefined;
  const sort        = (searchParams.get("sort") as SortOption) ?? "newest";
  const search      = searchParams.get("search")       ?? undefined;
  const originParam = searchParams.get("origin") as OriginFilter | null;
  const origin      = originParam === "local" || originParam === "intl" ? originParam : "all";
  const limit       = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 20;
  const offset      = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const all = getDeals({
    categorySlug: category,
    minDiscount:  minDiscount ? parseInt(minDiscount, 10) : undefined,
    sort,
    search,
    origin,
  });

  // Origin counts are computed across all three buckets (ignoring the current
  // origin filter) so the toggle can show "how many would I get if I switched"
  // without the user having to flip it to find out.
  const originCounts = getOriginCounts({
    categorySlug: category,
    minDiscount: minDiscount ? parseInt(minDiscount, 10) : undefined,
    search,
  });

  const total = all.length;
  const items = all.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return NextResponse.json({ items, total, hasMore, originCounts }, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
  });
}
