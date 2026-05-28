/* /api/popular-suggestions — returns product titles for the
   search-bar chip pool. Each returned product satisfies:
     1. AT LEAST one store carrying it is in the user's country
        (so the comparison includes a local-shopper option)
     2. AT LEAST 2 distinct stores total (so the comparison
        actually compares)

   Country is passed via ?country=<iso>. Defaults to 'ng' when
   absent. The country gates rule (1): a chip's product must have
   at least one store tagged with the user's country in our
   stores table. Without this, chips like 'Marshall Stanmore'
   could appear for an NG user even when no NG store carries it.

   Caching: edge-keyed by country so each one gets its own 10-min
   cache. The list rotates organically as the catalog grows.

   Fail-soft: returns an empty list if the RPC isn't migrated yet
   or Supabase is unreachable. The SearchBar component falls back
   to its hand-curated SUGGESTIONS_POOL in that case. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { chipLabelForTitle } from "@/lib/search/normalize";

export const revalidate = 600; // 10 min edge cache

interface SuggestionRow {
  product_id:   string;
  title:        string;
  store_count:  number;
  total_offers: number;
}

const VALID_COUNTRIES = new Set(["ng", "us", "uk", "ae", "de", "in", "za"]);

export async function GET(req: NextRequest) {
  const supa = getSupabaseAdmin();
  const countryParam = req.nextUrl.searchParams.get("country")?.toLowerCase().trim();
  const country = countryParam && VALID_COUNTRIES.has(countryParam) ? countryParam : "ng";

  if (!supa) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  }

  const { data, error } = await supa.rpc("suggest_multistore_products", {
    user_country: country,
    max_results:  30,
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

  /* Each chip label is the parsed 'Brand Model' (e.g. 'Apple iPhone 15
     Pro Max') instead of the raw retailer title (e.g. 'Apple iPhone
     15 Pro Max - 6.9 inch, 256gb Rom, 8gb Ram, Black Titanium').
     Cleaner display + cleaner search query when the user taps the
     chip.

     `key` (product_id) is surfaced so the chip click can route as
     /compare?q=<title>&pid=<key> — direct product lookup, guaranteed
     to land on a real anchor with at least 2 stores. Without this,
     the chip click does text-search (pgFtsFindSimilar) which can
     fail when the cleaned chip label drifts from the underlying
     product's FTS-indexed title (chipLabelForTitle strips a lot of
     detail). User report (May 2026): "the displayed pills must
     always have at least 2 products in the db" — same product
     does have ≥ 2 stores, the text-search just couldn't find it. */
  const items = ((data as SuggestionRow[] | null) ?? []).map((r) => ({
    title:      chipLabelForTitle(r.title),
    key:        r.product_id,
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
