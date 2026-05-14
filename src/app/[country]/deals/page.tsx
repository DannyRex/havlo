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
    /* next: { revalidate: 600 } mirrors the API route's own cache so
       SSR pulls from the same cached response repeat visitors get
       client-side. Cuts the per-visit cost when the cache is warm. */
    const url = `${proto}://${host}/api/deals?${qs.toString()}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
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
