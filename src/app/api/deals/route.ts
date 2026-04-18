import { NextRequest, NextResponse } from "next/server";
import { getDeals } from "@/lib/data/deals";
import type { SortOption } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const category    = searchParams.get("category")    ?? undefined;
  const minDiscount = searchParams.get("minDiscount")  ?? undefined;
  const sort        = (searchParams.get("sort") as SortOption) ?? "newest";
  const search      = searchParams.get("search")       ?? undefined;
  const limit       = searchParams.get("limit")  ? parseInt(searchParams.get("limit")!,  10) : 20;
  const offset      = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

  const all = getDeals({
    categorySlug: category,
    minDiscount:  minDiscount ? parseInt(minDiscount, 10) : undefined,
    sort,
    search,
  });

  const total = all.length;
  const items = all.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return NextResponse.json({ items, total, hasMore }, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
  });
}
