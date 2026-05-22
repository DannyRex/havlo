/* Builders for product-detail-page URLs.

   Two URL shapes:
     - /[country]/p/[offer_id]    DB-backed offer (real UUID)
     - /[country]/p/live?...      Synthetic offer (live SerpAPI rows,
                                  paste-a-link sniffs, anything not
                                  in the offers table)

   The "every card → PDP first, never straight to merchant" rule
   relies on these helpers so we don't duplicate URL-building logic
   across MasonryCard, ListCard, DupeCard, PriceResults, LiveResults,
   and LiveAlternatives. */

import type { Deal } from "@/types";
import type { StoreOffer } from "@/lib/search";

/** True when the offer was sourced from a live search provider
    (synthetic id) or has no id at all (sniffed external page).

    Every live SearchProvider mints its OWN prefix and none of those
    rows land in the offers table because live-search persist is
    paused (see src/app/api/live-search/route.ts for the egress
    context). So all four provider prefixes 404 the standard
    /p/[id] route — they MUST route to /p/live instead.

    User report May 2026: /ng/p/aliex-1005007312017504 returned 404.
    Same shape would have hit paapi-* (Amazon PA-API) and konga-*
    affiliate rows for any user who tried.

    serp-, aliex-, paapi-, konga- — keep this list in sync with the
    search providers in src/lib/providers/search-*.ts. */
const SYNTHETIC_PROVIDER_PREFIXES = ["serp-", "aliex-", "paapi-", "konga-"];

function isSyntheticId(id: string | null | undefined): boolean {
  if (!id) return true;
  for (const prefix of SYNTHETIC_PROVIDER_PREFIXES) {
    if (id.startsWith(prefix)) return true;
  }
  // Synthetic dupe IDs use a colon separator (storeId:productKey)
  if (id.includes(":")) return true;
  return false;
}

/* SerpAPI Google-relay rows arrive with `Deal.url` already wrapped as
   the internal redirect `/api/go?url=<absolute>` (see search-serpapi.ts
   mapToDeal). That relative URL is fine as an outbound href, but the
   /p/live PDP carries the merchant URL in a `?u=` query param and
   parses it with `new URL()` — which THROWS on a relative URL, so the
   page 404s on every Google-relay live result (regression: "/p/live
   404s on titles with a quote char" — verbose old-product listings
   are exactly the ones that lack a direct merchant link and fall back
   to the relay). Unwrap to the absolute inner URL here; /p/live
   re-applies its own /api/go wrap at the outbound CTA, so the
   redirect still happens, just at click time. */
export function toAbsoluteMerchantUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.startsWith("/api/go")) return rawUrl;
  const qIndex = rawUrl.indexOf("?");
  if (qIndex === -1) return rawUrl;
  const inner = new URLSearchParams(rawUrl.slice(qIndex + 1)).get("url");
  return inner || rawUrl;
}

/** Build the PDP URL for a Deal-shaped object. Returns the live-PDP
    query-param variant for synthetic IDs, the standard /p/[id]
    path for real ones. */
export function pdpUrlForDeal(countryCode: string, deal: Deal): string {
  if (!isSyntheticId(deal.id)) {
    return `/${countryCode}/p/${encodeURIComponent(deal.id)}`;
  }
  const params = new URLSearchParams();
  params.set("t",  deal.title.slice(0, 250));
  params.set("u",  toAbsoluteMerchantUrl(deal.url));
  if (deal.storeId)        params.set("s",  deal.storeId);
  if (deal.storeName)      params.set("sn", deal.storeName);
  if (deal.salePrice)      params.set("p",  String(deal.salePrice));
  if (deal.originalPrice && deal.originalPrice !== deal.salePrice) {
    params.set("op", String(deal.originalPrice));
  }
  if (deal.discountPercent) params.set("dp", String(deal.discountPercent));
  if (deal.currency)        params.set("c",  deal.currency);
  if (deal.imageUrl)        params.set("i",  deal.imageUrl);
  return `/${countryCode}/p/live?${params.toString()}`;
}

/** Build the PDP URL for a StoreOffer (compare-side pricing rows).
    Mirrors pdpUrlForDeal — uses offerId when present, falls back
    to /p/live for synthetic offers. */
export function pdpUrlForOffer(
  countryCode: string,
  offer: Pick<
    StoreOffer,
    "offerId" | "storeId" | "storeName" | "price" | "originalPrice"
    | "discountPercent" | "url" | "imageUrl"
  > & { title?: string },
): string {
  if (offer.offerId && !isSyntheticId(offer.offerId)) {
    return `/${countryCode}/p/${encodeURIComponent(offer.offerId)}`;
  }
  const params = new URLSearchParams();
  if (offer.title)         params.set("t",  offer.title.slice(0, 250));
  if (offer.url)           params.set("u",  toAbsoluteMerchantUrl(offer.url));
  if (offer.storeId)       params.set("s",  offer.storeId);
  if (offer.storeName)     params.set("sn", offer.storeName);
  if (offer.price)         params.set("p",  String(offer.price));
  if (offer.originalPrice && offer.originalPrice !== offer.price) {
    params.set("op", String(offer.originalPrice));
  }
  if (offer.discountPercent) params.set("dp", String(offer.discountPercent));
  /* StoreOffer always carries currency=NGN per the data layer,
     so callers pass that downstream automatically; explicit set
     here in case the shape changes. */
  params.set("c", "NGN");
  if (offer.imageUrl)      params.set("i",  offer.imageUrl);
  return `/${countryCode}/p/live?${params.toString()}`;
}
