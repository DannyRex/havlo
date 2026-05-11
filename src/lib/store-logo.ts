/* Single source of truth for resolving a storeId → its display logo
   URL across the search + browse pipelines.

   Default path: /logos/<storeId>.png. The store row in the DB usually
   stores this exact path (set by dealToStoreRow in ingestion.ts) so
   most stores just round-trip the DB value.

   Collapsing rules (applied AFTER the DB lookup):
     • Amazon marketplace variants (amazon-co-uk-amazon-co-uk-seller,
       amazon-de-amazon-de-seller, amazon-ae-seller, amazon-in,
       amazon-uk, amazon-us, …) all reuse /logos/amazon.png — the
       Amazon arrow logo is brand-consistent across every marketplace,
       so shipping individual files for each is wasteful.

   Adding a new collapse rule:
     1. Add the prefix/match here
     2. The DB row's logo_url column doesn't need updating — this
        helper runs after the DB fetch in every consumer

   sniff-to-anchor.ts has a name-based variant (it operates on the
   user-facing storeName from a URL sniff, not a DB storeId); kept
   separate because their input shapes don't overlap. */

export function resolveStoreLogoUrl(
  storeId: string,
  dbLogoUrl?: string | null,
): string {
  /* Amazon family — every marketplace variant uses the same arrow. */
  if (storeId.startsWith("amazon-") || storeId === "amazon") {
    return "/logos/amazon.png";
  }
  /* Walmart marketplace seller variants (walmart-techmate-intl,
     walmart-dac-enterprises, walmart-jsg2dak1, etc.) — all sell
     under the same Walmart storefront, so reuse /logos/walmart.png. */
  if (storeId.startsWith("walmart-") || storeId === "walmart") {
    return "/logos/walmart.png";
  }
  return dbLogoUrl ?? `/logos/${storeId}.png`;
}
