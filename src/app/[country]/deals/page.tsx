import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import DealFeed from "@/components/deals/DealFeed";
import JsonLd from "@/components/seo/JsonLd";
import { getCountry } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates, buildBreadcrumbList } from "@/lib/seo";
import type { Deal } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/deals`;
  const title = `Deals worth checking today in ${country.name}`;
  const description = `Fresh price drops + standout offers across the stores you already shop in ${country.name}. Filter by category, brand, and discount.`;

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
    qs.set("limit",   "24");
    qs.set("offset",  "0");
    if (params.category) qs.set("category",    params.category);
    if (params.tier)     qs.set("minDiscount", params.tier);
    if (params.sort)     qs.set("sort",        params.sort);
    if (params.search)   qs.set("search",      params.search);
    if (params.origin)   qs.set("origin",      params.origin);
    if (params.stores)   qs.set("stores",      params.stores);
    /* cache: "no-store" disables the Next.js fetch data cache so every
       SSR render hits /api/deals fresh.

       Why we can't cache this fetch: /api/deals' browse_deals RPC can
       transiently fail (Supabase blip, RLS misconfig, network), and
       when it does the route falls back to getCuratedDeals() which
       returns ONLY the 75 hardcoded Amazon items. If `next: { revalidate
       N }` is enabled, that Amazon-only fallback response gets stamped
       into Next's data cache for N seconds — and every subsequent /uk/
       deals (and /us/deals, /de/deals, …) visit during that window
       serves the bad cached HTML where the initial items array is all
       Amazon, even though /api/deals itself has long since recovered
       and is returning the real catalog. User report May 2026: "in
       UK, switching between all/local/intl tabs changes the deals
       count but stores aren't visible except Amazon" — confirmed by
       diffing fresh /api/deals (1531 items, 16 stores) vs the SSR'd
       HTML payload (24 items, all amazon-co-uk).

       Cost: one extra RPC pair per /[country]/deals SSR (Pass A + B).
       Acceptable given the bug class this eliminates — stale homepages
       were the single most damaging UX failure. If egress becomes a
       concern later, the right fix is to make /api/deals NEVER cache
       a curated-fallback response (add a marker header the SSR fetch
       can detect and skip-cache), not to re-enable an unconditional
       fetch cache here. */
    const url = `${proto}://${host}/api/deals?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      items:        j.items ?? [],
      total:        j.total ?? 0,
      hasMore:      j.hasMore ?? false,
      originCounts: j.originCounts,
      storeOptions: Array.isArray(j.stores) ? j.stores : undefined,
    };
  } catch {
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
  const initial = await fetchInitialDeals({
    country:  country.code,
    category: pickFirst("category"),
    tier:     pickFirst("minDiscount"),
    sort:     pickFirst("sort"),
    search:   pickFirst("search"),
    origin:   pickFirst("origin"),
    stores:   pickFirst("stores"),
  });

  return (
    <>
      <JsonLd data={breadcrumb} />
      <Suspense>
        <DealFeed
          initialItems={initial?.items}
          initialTotal={initial?.total}
          initialHasMore={initial?.hasMore}
          initialOriginCounts={initial?.originCounts}
          initialStoreOptions={initial?.storeOptions}
        />
      </Suspense>
    </>
  );
}
