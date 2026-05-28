/* Server-side helper that returns rotating placeholder examples
   for the homepage Hero search box, sourced from real catalog data.

   Replaces the hardcoded per-country example list that was previously
   in Hero.tsx. The hardcoded list had two problems:
     1. Maintenance — every catalog change drifted from the examples.
     2. Authenticity — examples were my guesses, not what the catalog
        actually has popular cross-store coverage for.

   This helper calls suggest_diverse_popular_products(country, N)
   which:
     - Filters to products with ≥ 2 stores
     - One product per category (phones / fashion / beauty / home / etc.)
     - Sorted by store_count desc within each category

   Edge-cached 30 min via unstable_cache so the homepage SSR pays the
   DB cost at most twice per hour per country. The list rotates
   organically as the catalog grows + popularity shifts.

   Fail-soft: returns a STATIC fallback if the RPC isn't migrated yet,
   the DB is unreachable, or the catalog has too few multi-store
   products for the country. The Hero rotation works the same either
   way — caller doesn't need to handle "no examples" specially. */

import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { chipLabelForTitle } from "@/lib/search/normalize";

const REVALIDATE_S = 1800;   // 30 min, matches homepage ISR revalidate

/* Static fallback per country — same shape as the dynamic output.
   Used when the RPC isn't migrated yet, the DB is unreachable, or
   the dynamic query returns an empty / too-small list (rare; only
   hits markets where the catalog hasn't reached ≥ 8 cross-store
   categories yet). Each list spans categories deliberately. */
const STATIC_FALLBACK: Record<string, string[]> = {
  ng: ["iPhone 15 Pro", "Air Force 1", "AFNAN perfume", "Stanley Quencher", "Dyson V12", "Accu-Chek glucose meter"],
  uk: ["AirPods 4", "Dyson Airwrap", "Le Creuset Dutch oven", "Air Max 95", "Charlotte Tilbury", "Garmin Forerunner"],
  us: ["Stanley Quencher", "Yeti Rambler", "Dyson Airwrap", "Air Force 1", "Owala FreeSip", "AirPods 4"],
  de: ["Bose QuietComfort", "Adidas Samba", "Le Creuset", "Dyson V12", "Garmin Fenix", "AirPods 4"],
  in: ["OnePlus Nord", "boAt earbuds", "Nike Air Max", "Lakme foundation", "Stanley Quencher", "Apple Watch SE"],
  ae: ["iPhone 15 Pro", "AFNAN perfume", "Dyson Airwrap", "Air Max 95", "Apple Watch Ultra", "Le Creuset"],
  za: ["Yeti Rambler", "Adidas Samba", "Garmin Forerunner", "AirPods 4", "Le Creuset", "Air Force 1"],
};

interface DiverseRow {
  product_id:    string;
  title:         string;
  brand:         string | null;
  category_slug: string;
  store_count:   number;
}

async function fetchPlaceholderExamplesUncached(country: string): Promise<string[]> {
  try {
    const supa = getSupabaseAdmin();
    if (!supa) return STATIC_FALLBACK[country] ?? STATIC_FALLBACK.ng;

    const { data, error } = await supa.rpc("suggest_diverse_popular_products", {
      user_country:   country,
      max_categories: 8,
    });

    if (error) {
      /* Migration not applied yet (or RPC permissions are off).
         Logged at warn level — shows in Vercel logs without paging. */
      console.warn("[placeholder-examples] RPC failed:", error.message);
      return STATIC_FALLBACK[country] ?? STATIC_FALLBACK.ng;
    }

    /* chipLabelForTitle parses the raw retailer title down to a clean
       "Brand Model" form ("Apple iPhone 15 Pro Max" instead of the
       full "Apple iPhone 15 Pro Max - 6.9 inch, 256gb Rom, 8gb Ram,
       Black Titanium"). Keeps the placeholder readable and the
       rotation rhythm consistent. */
    const labels = ((data as DiverseRow[] | null) ?? [])
      .map((r) => chipLabelForTitle(r.title, 28))
      /* Drop any that survived chip-truncation as junk (extremely
         long all-caps, leading punctuation, etc.) — uncommon but
         keeps the placeholder feeling polished. */
      .filter((l) => l.length >= 3 && l.length <= 32);

    /* If we got < 4 dynamic labels (rare — catalog too thin in this
       country, or all categories happen to fail the chip-length
       filter), use the static fallback to keep the rotation
       feeling rich. Don't intermix — mixed-source rotations feel
       inconsistent. */
    if (labels.length < 4) return STATIC_FALLBACK[country] ?? STATIC_FALLBACK.ng;
    return labels;
  } catch (err) {
    console.warn("[placeholder-examples] unexpected error:", (err as Error).message);
    return STATIC_FALLBACK[country] ?? STATIC_FALLBACK.ng;
  }
}

/** Per-country cached fetcher. Returns 6-8 placeholder examples
    that span categories, sourced from the live catalog's popular
    multi-store products. */
export const getPopularPlaceholderExamples = unstable_cache(
  fetchPlaceholderExamplesUncached,
  /* Key includes a version sentinel so we can invalidate without
     a redeploy if we change the RPC shape. */
  ["placeholder-examples-v1"],
  { revalidate: REVALIDATE_S, tags: ["placeholder-examples"] },
);
