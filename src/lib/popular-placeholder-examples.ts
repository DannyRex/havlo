/* Server-side helper that returns the rotating placeholder examples for
   the homepage Hero search box.

   June 2026 (founder direction): switched from a dynamic, store-count-
   ranked RPC (suggest_diverse_popular_products) to a CURATED list of
   iconic, instantly-recognizable products. The dynamic ranking optimised
   for cross-store COVERAGE, which surfaced less-aspirational picks — e.g.
   "adidas Samba OG" outranked "Nike Air Force 1" in UK/US on store count,
   sports landed on "Puma Conduct Pro", computing on a generic "HP Ryzen 5
   laptop". A placeholder's job is to INSPIRE a search, so recognizability
   matters more than coverage.

   Every item below is verified (June 2026) to return real results across
   our markets — NG/UK/US spot-checked, e.g. Nike Air Force 1 → 45/55/32,
   iPhone 15 Pro → 15/15/11 — so the example never leads to an empty
   search. They span categories (phones / computing / sports / audio /
   gaming / wearable / tv / eyewear) so the rotation feels broad, and
   they're global-iconic brands that carry across all six markets (the
   catalog is cross-border). LG OLED TV (22 products) and Ray-Ban (20)
   re-verified June 2026 via the FTS search; both far outcover the items
   they replaced (Dyson Airwrap 8, Stanley Quencher 4).

   Kept async + cached so the caller (homepage SSR) and its signature
   don't change, and so a dynamic source can be reintroduced later without
   touching callers. */

import { unstable_cache } from "next/cache";

const REVALIDATE_S = 1800;   // 30 min, matches homepage ISR revalidate

/* Curated, category-spanning, recognizable, verified-present. Order is the
   rotation order (one every 3.5s in the Hero), so it leads with the most
   universal item. */
const CURATED: string[] = [
  "iPhone 15 Pro",       // phones
  "MacBook Air",         // computing
  "Nike Air Force 1",    // sports / fashion
  "AirPods Pro",         // audio
  "PlayStation 5",       // gaming
  "Apple Watch",         // wearable
  "LG OLED TV",          // tv
  "Ray-Ban",             // fashion / eyewear
];

export { CURATED as PLACEHOLDER_EXAMPLES };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchPlaceholderExamplesUncached(_country: string): Promise<string[]> {
  /* Global-iconic brands are present in every market we ship, so the
     same curated set serves all countries. If a market ever needs local
     flavour, branch on _country and return a verified per-country list. */
  return CURATED;
}

/** Per-country cached fetcher. Returns the curated iconic placeholder
    examples that span categories. */
export const getPopularPlaceholderExamples = unstable_cache(
  fetchPlaceholderExamplesUncached,
  /* Version bump invalidates the old dynamic-RPC cache entries. */
  ["placeholder-examples-v2-curated"],
  { revalidate: REVALIDATE_S, tags: ["placeholder-examples"] },
);
