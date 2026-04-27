/* /api/go — outbound click redirector.
   Two responsibilities:
     1. Optional: log analytics about which deal was clicked
        (kept fire-and-forget so click latency isn't affected).
     2. Resolve Google-relay URLs (https://www.google.com/...&prds=...)
        to the actual merchant URL via SerpAPI's product-detail endpoint.
        Caches resolved URLs for 30 days so we only pay 1 credit per
        relay URL across all users.

   Request:
     GET /api/go?url=<encoded-target>&id=<optional-deal-id>

   Response:
     307 to the resolved merchant URL. Falls back to the input URL
     when resolution fails (better than 500-ing the click).
*/

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

interface ResolvedRow {
  resolved_url: string;
  resolved_at:  string;
}

interface SerpProductSeller {
  link?:           string;
  direct_link?:    string;
  base_price?:     string;
  total_price?:    string;
  name?:           string;
}
interface SerpProductResponse {
  sellers_results?: { online_sellers?: SerpProductSeller[] };
  product_results?: { sellers?: SerpProductSeller[] };
}

function isGoogleRelay(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "google.com" || h.endsWith(".google.com");
  } catch {
    return false;
  }
}

/* Lookup a previously-resolved URL from the cache table.
   Schema (create on demand):
     CREATE TABLE resolved_clicks (
       source_url   text PRIMARY KEY,
       resolved_url text NOT NULL,
       resolved_at  timestamptz DEFAULT now()
     ); */
async function readCache(sourceUrl: string): Promise<string | null> {
  const supa = getSupabaseAdmin();
  if (!supa) return null;
  const { data } = await supa
    .from("resolved_clicks")
    .select("resolved_url, resolved_at")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (!data) return null;
  // 30-day TTL
  const age = Date.now() - new Date((data as ResolvedRow).resolved_at).getTime();
  if (age > 30 * 86400 * 1000) return null;
  return (data as ResolvedRow).resolved_url;
}

async function writeCache(sourceUrl: string, resolvedUrl: string) {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  await supa.from("resolved_clicks").upsert(
    { source_url: sourceUrl, resolved_url: resolvedUrl, resolved_at: new Date().toISOString() },
    { onConflict: "source_url" },
  );
}

/* Resolve a Google Shopping relay URL via SerpAPI's product endpoint.
   Returns the first online seller's direct merchant link, or null
   when SerpAPI can't resolve it. */
async function resolveViaSerpApi(googleUrl: string): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return null;

  /* The relay URL contains a `prds=...productId...` segment we can
     extract. Without product_id we can't resolve. */
  let productId: string | null = null;
  try {
    const u = new URL(googleUrl);
    const prds = u.searchParams.get("prds") ?? "";
    const match = prds.match(/(?:catalogid|productid|gpcid):(\d+)/i);
    if (match) productId = match[1];
  } catch {/* fall through */}
  if (!productId) return null;

  const endpoint = new URL("https://serpapi.com/search.json");
  endpoint.searchParams.set("engine",     "google_product");
  endpoint.searchParams.set("product_id", productId);
  endpoint.searchParams.set("api_key",    apiKey);

  try {
    const res = await fetch(endpoint.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = (await res.json()) as SerpProductResponse;
    const sellers = data.sellers_results?.online_sellers
      ?? data.product_results?.sellers
      ?? [];
    for (const s of sellers) {
      const link = s.direct_link ?? s.link;
      if (link && !isGoogleRelay(link)) return link;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new NextResponse("Missing url", { status: 400 });

  /* Direct merchant URLs pass through with a single redirect — no
     resolution overhead. */
  if (!isGoogleRelay(target)) {
    return NextResponse.redirect(target, 307);
  }

  /* Google relay — try cache first, then SerpAPI. */
  const cached = await readCache(target);
  if (cached) return NextResponse.redirect(cached, 307);

  const resolved = await resolveViaSerpApi(target);
  if (resolved) {
    // Fire-and-forget — don't block redirect on cache write
    void writeCache(target, resolved);
    return NextResponse.redirect(resolved, 307);
  }

  /* Last resort — send them to the Google relay rather than 500ing.
     They'll see a Google product page; not ideal but never broken. */
  return NextResponse.redirect(target, 307);
}
