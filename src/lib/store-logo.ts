/* Single source of truth for resolving a storeId → its display logo
   URL across the search + browse pipelines.

   Default path: /logos/<storeId>.png. The store row in the DB usually
   stores this exact path (set by dealToStoreRow in ingestion.ts) so
   most stores just round-trip the DB value.

   Collapsing rules (applied AFTER the DB lookup):
     • Marketplace variants (amazon-uk / amazon-de-seller / walmart-jsg2,
       ebay-<seller>, currys-business, dell-uk, qvc-uk, …) all reuse the
       parent's single bundled asset — the wordmark is brand-consistent
       across every regional/seller storefront, so shipping per-variant
       files is wasteful. marketplaceBaseSlug() is the shared collapse,
       also consulted by resolveStoreDomain() so the FAVICON tier resolves
       for seller variants too (June 2026: ebay-<seller> cards fell to a
       letter badge because the favicon lookup never collapsed the seller
       suffix).

   Adding a new collapse rule:
     1. Add the base to MARKETPLACE_BASES
     2. The DB row's logo_url column doesn't need updating — this
        helper runs after the DB fetch in every consumer

   sniff-to-anchor.ts has a name-based variant (it operates on the
   user-facing storeName from a URL sniff, not a DB storeId); kept
   separate because their input shapes don't overlap. */

/* Marketplaces whose storeIds fragment into regional / per-seller
   variants but share ONE wordmark. */
const MARKETPLACE_BASES = ["amazon", "walmart", "currys", "ebay", "dell", "qvc"] as const;

/** Collapse a marketplace's regional/seller storeId variant to its base
    slug (amazon-uk → amazon, ebay-modanet2008 → ebay). Returns the input
    lowercased unchanged for non-marketplace stores. */
export function marketplaceBaseSlug(storeId: string): string {
  const s = (storeId || "").toLowerCase();
  for (const base of MARKETPLACE_BASES) {
    if (s === base || s.startsWith(`${base}-`) || s.startsWith(`${base}_`)) return base;
  }
  return s;
}

export function resolveStoreLogoUrl(
  storeId: string,
  dbLogoUrl?: string | null,
): string {
  const base = marketplaceBaseSlug(storeId);
  if ((MARKETPLACE_BASES as readonly string[]).includes(base)) {
    return `/logos/${base}.png`;
  }
  return dbLogoUrl ?? `/logos/${storeId}.png`;
}
