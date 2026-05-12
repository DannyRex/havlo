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

/** True when the offer was sourced from the live SerpAPI provider
    (synthetic id) or has no id at all (sniffed external page). */
function isSyntheticId(id: string | null | undefined): boolean {
  if (!id) return true;
  // SerpAPI-provider rows from /api/live-search start with "serp-"
  if (id.startsWith("serp-")) return true;
  // Synthetic dupe IDs use a colon separator (storeId:productKey)
  if (id.includes(":")) return true;
  return false;
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
  params.set("u",  deal.url);
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
  if (offer.url)           params.set("u",  offer.url);
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
