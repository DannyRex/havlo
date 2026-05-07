/* /api/popular-suggestions — returns product titles that have at
   least 2 distinct stores carrying them. Used by the search-bar
   chip pool on /compare so every chip a user taps lands on a real
   multi-store comparison rather than a single-listing page.

   Caching: edge cache for 10 min so the chip pool doesn't hit the
   DB on every page load. The list rotates organically as the
   catalog grows but doesn't need real-time freshness for chips.

   Fail-soft: returns an empty list if the RPC isn't migrated yet
   or Supabase is unreachable. The SearchBar component falls back
   to its hand-curated SUGGESTIONS_POOL in that case. */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

export const revalidate = 600; // 10 min edge cache

interface SuggestionRow {
  product_id:   string;
  title:        string;
  store_count:  number;
  total_offers: number;
}

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  }

  const { data, error } = await supa.rpc("suggest_multistore_products", {
    max_results: 30,
  });

  if (error) {
    /* Pre-migration: relation/function doesn't exist. Fail-soft. */
    if (
      /relation .* does not exist|could not find the function|function .* does not exist/i
        .test(error.message)
    ) {
      console.warn("[popular-suggestions] RPC not migrated:", error.message);
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "public, s-maxage=60" } },
      );
    }
    console.error("[popular-suggestions] RPC error:", error.message);
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = ((data as SuggestionRow[] | null) ?? []).map((r) => ({
    title:      r.title,
    storeCount: r.store_count,
  }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    },
  );
}
