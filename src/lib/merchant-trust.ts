/* Per-merchant trust classification.

   We don't hold real per-retailer reputation data (no Trustpilot
   feed, no merchant-vetting programme). The one honest, defensible
   signal we DO have is whether a retailer is in Havlo's curated
   MERCHANTS table (src/lib/merchant-search-urls.ts):

     • "established"  — a human curated this retailer's real official
       homepage + working search URL, and link-health checks pass
       (tasks #66/#69/#71/#72). It means "this is the genuine
       retailer site", NOT a judgment on their service, returns, or
       business quality. All the big marketplaces a shopper already
       recognises (Amazon, Jumia, Konga, AliExpress, Currys, Best
       Buy, eBay, ASOS, Temu, DHgate, ...) resolve here.

     • "lesser_known" — a long-tail store (often SerpAPI-ingested)
       we haven't curated. It carries NO badge. It is NOT penalised
       or down-ranked; it simply competes on price like everything
       else. The absence of a badge is a quiet, honest cue, never a
       warning.

   Computed server-side and threaded onto offer payloads as a small
   enum, so the ~390-row MERCHANTS table never ships to the client.
   Client components only ever import the `MerchantTrust` TYPE (erased
   at build) plus the presentational <MerchantVerifiedChip>. */

import { merchantHomepage } from "@/lib/merchant-search-urls";

export type MerchantTrust = "established" | "lesser_known";

export function merchantTrust(
  storeId: string | null | undefined,
  storeName: string | null | undefined,
): MerchantTrust {
  return merchantHomepage(storeId, storeName) ? "established" : "lesser_known";
}
