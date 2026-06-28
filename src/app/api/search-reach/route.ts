import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* ── /api/search-reach ────────────────────────────────────────────────
   Country-blind "how much of this do we track, and where" probe.

   Used by /compare's empty state to replace a blank "nothing found"
   with an honest line: "We track 16 lawnmowers, mostly from UK shops.
   They might not reach Nigeria easily." The shopper learns the catalog
   ISN'T empty — the items just live in another market — instead of
   assuming Havlo has nothing.

   Runs the SAME matcher /compare's anchor search uses
   (search_products_fts), so the count reflects exactly what the
   catalog holds for the query, then aggregates distinct products by
   the market their offers sit in. No country filter here on purpose —
   that's the whole point, we want the cross-border picture.

   Cached like /api/compare (1h / 1d SWR): the answer only shifts when
   the catalog refreshes (Mon/Wed/Fri), and it's keyed on q alone. */

const PRODUCT_CAP = 200; // search_products_fts ranks at most this many

interface ReachRow {
  product_id:    string;
  store_country: string | null;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ total: 0, topCountry: null, countries: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ total: 0, topCountry: null, countries: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const { data, error } = await supa.rpc("search_products_fts", {
      q,
      max_results: PRODUCT_CAP,
    });
    if (error || !data) {
      return NextResponse.json({ total: 0, topCountry: null, countries: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    /* One row per (product, store-offer). Fold to distinct products,
       tracking which markets each product is offered in. A product
       offered in two markets counts toward both — "reach" is about
       where it's shoppable, not a single home. */
    const byProduct = new Map<string, Set<string>>();
    for (const r of data as ReachRow[]) {
      const cc = (r.store_country ?? "").trim().toUpperCase();
      if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, new Set());
      if (cc) byProduct.get(r.product_id)!.add(cc);
    }

    const total = byProduct.size;
    const countryCount = new Map<string, number>();
    byProduct.forEach((markets) => {
      markets.forEach((cc) => countryCount.set(cc, (countryCount.get(cc) ?? 0) + 1));
    });

    const countries = Array.from(countryCount.entries())
      .map(([code, count]) => ({ code: code.toLowerCase(), count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(
      {
        /* `total` is a floor when it hits the ranker cap — the UI reads
           `capped` to render "200+" rather than a precise-looking 200. */
        total,
        capped: total >= PRODUCT_CAP,
        topCountry: countries[0] ?? null,
        countries,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
          "Vary": "Accept-Encoding",
        },
      },
    );
  } catch (err) {
    console.error("[/api/search-reach]", err);
    return NextResponse.json({ total: 0, topCountry: null, countries: [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
