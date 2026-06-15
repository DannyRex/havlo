/* ──────────────────────────────────────────────────────────────────
   Shared offer-by-id fetcher.

   Used by:
     - /[country]/p/[id]/page.tsx           (PDP route — what the
                                              user lands on after a
                                              card click)
     - /api/compare/route.ts                (oid fallback — when
                                              pid + FTS both miss,
                                              synthesise a single-
                                              offer anchor from the
                                              offer the user came
                                              from)

   Three sources tried in order:
     1. product_best_offers view — covers in-stock offers indexed by
        offer_id. Fast (single round trip), serves ~50% of /deals
        click-throughs.
     2. offers + products + stores manual join — covers every DB-
        backed offer including out-of-stock ones the view filters
        out. Two extra round trips.
     3. curated Amazon static catalogue — 5 marketplaces × ~15
        products = ~75 stable URLs that aren't in the offers table.
        Without this fallback, clicking a curated card 404s.

   Returns null on miss. Callers decide whether to 404 (PDP route)
   or fall through to a different anchor source (/api/compare's
   FTS path). */

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { curatedAmazonDeals } from "@/lib/data/curated-amazon";

export interface OfferRow {
  offer_id:         string;
  product_id:       string;
  store_id:         string;
  url:              string;
  current_price:    number;
  original_price:   number | null;
  discount_percent: number | null;
  currency:         "NGN" | "USD";
  scraped_at:       string;
  /** Undefined when sourced from product_best_offers (the view
      filters for in_stock=true by construction and drops the
      column from the projection). Callers treat undefined as
      "in stock" downstream. */
  in_stock:         boolean | undefined;
  title:            string;
  category_slug:    string | null;
  brand:            string | null;
  image_url:        string | null;
  store_name:       string;
  store_logo_url:   string | null;
  /** Store's `is_international` flag (ingest-time currency-based
      heuristic). Used by the /api/compare oid-fallback path to
      build a single-offer anchor in the StoreOffer shape, which
      requires the flag for landed-price math. */
  is_international: boolean;
  /** Store's DB-tagged country anchor (stores.country). Lets the
      PDP's anchor-relevance guard use the DB signal instead of
      falling through to the JS COUNTRY_STORES roster, which misses
      stores like `onbuy` (UK marketplace) that are tagged country=UK
      in the DB but absent from the hardcoded roster. Re-audit
      May 2026: /uk/p/661bbc27... infinite-looped to itself because
      anchorAsOfferLike lacked storeCountry → isOfferAllowedForCountry
      fell to the roster fallback → returned false → the PDP fired
      the recovery redirect → picked the same offer as the
      "alternative" (only candidate in the pool) → looped. */
  store_country?:   string | null;
}

/* Per-request memoisation via React.cache. The PDP route calls this
   TWICE per visit — once from generateMetadata (for the page title +
   OG image) and once from the page body (for the hero data + dupe
   anchor). React.cache dedupes those calls within the same request so
   we pay one DB round trip instead of two for every PDP load.

   Note: React.cache is per-request only — it doesn't cross-request
   share. unstable_cache would do cross-request, but the PDP page is
   already ISR-cached at 6h via `export const revalidate = 21600`, so
   the page-level cache absorbs the cross-request layer. Per-request
   dedup is the missing piece, and React.cache is the right tool for
   it. */
export const fetchOfferById = cache(async function fetchOfferByIdImpl(offerId: string): Promise<OfferRow | null> {
  if (!offerId) return null;

  const supa = getSupabaseAdmin();

  if (supa) {
    /* (1) product_best_offers view — the hot path. Explicit column
       list (was .select("*") before May 2026 v3 egress pass) so we
       don't drag along source_country, store_country, or is_deal —
       the view exposes those for filter pushdown in browse-db.ts but
       this single-row fetch never reads them. ~57 bytes/row saved
       across ~50% of PDP hits.

       NOTE: must be a single string literal — Supabase's typed
       client narrows the result shape by parsing the column list at
       compile time, and concatenated strings collapse the inferred
       type to GenericStringError. */
    const { data: viewRow } = await supa
      .from("product_best_offers")
      .select("product_id, offer_id, store_id, url, current_price, original_price, discount_percent, currency, scraped_at, title, category_slug, brand, image_url, store_name, store_logo_url, is_international, store_country")
      .eq("offer_id", offerId)
      .maybeSingle();

    if (viewRow) {
      /* The view filters for in_stock=true via a lateral join and
         drops the column from its projection. Default to true so
         the out-of-stock badge doesn't misfire across every PDP
         (bug user reported May 2026). product_best_offers already
         exposes is_international from the joined stores table. */
      return {
        ...(viewRow as Omit<OfferRow, "in_stock">),
        in_stock: true,
      };
    }

    /* (2) offers + products + stores manual join. Slower but
       covers every offer including OOS. */
    const { data: offer } = await supa
      .from("offers")
      .select("id, product_id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at")
      .eq("id", offerId)
      .maybeSingle();

    if (offer) {
      const [{ data: product }, { data: store }] = await Promise.all([
        supa.from("products").select("title, category_slug, brand, image_url").eq("id", offer.product_id).maybeSingle(),
        supa.from("stores").select("name, logo_url, is_international, country").eq("id", offer.store_id).maybeSingle(),
      ]);
      if (product && store) {
        return {
          offer_id:         offer.id,
          product_id:       offer.product_id,
          store_id:         offer.store_id,
          url:              offer.url,
          current_price:    offer.current_price,
          original_price:   offer.original_price,
          discount_percent: offer.discount_percent,
          currency:         offer.currency as "NGN" | "USD",
          scraped_at:       offer.scraped_at,
          /* offers.in_stock has `default true` in the schema so a
             missing/null value is treated as in-stock. Only
             explicit false flags out-of-stock downstream. */
          in_stock:         offer.in_stock ?? true,
          title:            product.title,
          category_slug:    product.category_slug,
          brand:            product.brand,
          image_url:        product.image_url,
          store_name:       store.name,
          store_logo_url:   store.logo_url,
          is_international: store.is_international ?? false,
          store_country:    (store as { country?: string | null }).country ?? null,
        };
      }
    }
  }

  /* (3) Curated Amazon static catalogue. IDs look like
     'amazon-us-iphone-15-pro-max' — never in the offers table. */
  const curated = curatedAmazonDeals.find((d) => d.id === offerId);
  if (curated) {
    return {
      offer_id:         curated.id,
      /* Curated rows have no product_id row in the DB. Use the id
         as a synthetic key — downstream anchor builders only read
         this for grouping; pgFtsFindDupes ranks by title
         similarity regardless of key value. */
      product_id:       curated.id,
      store_id:         curated.storeId,
      url:              curated.url,
      current_price:    curated.salePrice,
      original_price:   curated.originalPrice ?? curated.salePrice,
      discount_percent: curated.discountPercent ?? 0,
      currency:         curated.currency,
      scraped_at:       curated.postedAt + "T00:00:00Z",
      in_stock:         true,
      title:            curated.title,
      category_slug:    curated.categorySlug,
      brand:            null,
      image_url:        curated.imageUrl ?? null,
      store_name:       curated.storeName,
      store_logo_url:   `/logos/${curated.storeId}.png`,
      /* Curated Amazon rows are stamped USD (US/UK/DE/AE/IN
         marketplaces) so they're cross-border for everyone except
         the marketplace's home market. Currency-based heuristic
         matches the ingest behaviour for is_international. */
      is_international: curated.currency === "USD",
      /* Parse marketplace from the curated id (e.g.
         "amazon-us-iphone-15-pro-max" → "US"). Lets the PDP's
         anchor-relevance guard correctly route curated rows to
         their home market without falling through to the JS
         roster fallback. */
      store_country:    (curated.id.match(/^amazon-(us|uk|de|ae|in)-/i)?.[1] ?? "").toUpperCase() || null,
    };
  }

  return null;
});

/* ──────────────────────────────────────────────────────────────────
   Resolve the canonical PDP offer by PRODUCT id (the STABLE key).

   Mirrors fetchOfferById but keyed on product_id, so the PDP URL can be
   /[country]/p/{product_id} (constant) instead of /p/{offer_id} (which
   churns every scrape cycle as the cheapest in-stock offer flips or the
   stale-sweep marks the old one OOS — the root cause of the Search Console
   "noindex" + "alternative canonical" collapse: an indexed offer_id URL
   went OOS-noindex while the product moved to a new offer_id URL).

   Returns the current cheapest IN-STOCK offer for the product; falls back
   to the cheapest offer of ANY stock state so an all-OOS product_id URL
   still renders (noindex) instead of 404ing.
   ────────────────────────────────────────────────────────────────── */
export const fetchOfferByProductId = cache(async function fetchOfferByProductIdImpl(productId: string): Promise<OfferRow | null> {
  if (!productId) return null;

  const supa = getSupabaseAdmin();

  if (supa) {
    /* (1) product_best_offers — cheapest in-stock offer for this product.
       Same column list as fetchOfferById's view query. */
    const { data: viewRow } = await supa
      .from("product_best_offers")
      .select("product_id, offer_id, store_id, url, current_price, original_price, discount_percent, currency, scraped_at, title, category_slug, brand, image_url, store_name, store_logo_url, is_international, store_country")
      .eq("product_id", productId)
      .maybeSingle();

    if (viewRow) {
      return { ...(viewRow as Omit<OfferRow, "in_stock">), in_stock: true };
    }

    /* (2) offers join — covers all-OOS products (the view is in-stock
       only). Prefer any in-stock row, then the cheapest, and take ONE
       (limit(1) before maybeSingle: a product has many offers). */
    const { data: offer } = await supa
      .from("offers")
      .select("id, product_id, store_id, url, current_price, original_price, discount_percent, currency, in_stock, scraped_at")
      .eq("product_id", productId)
      .order("in_stock", { ascending: false })
      .order("current_price", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (offer) {
      const [{ data: product }, { data: store }] = await Promise.all([
        supa.from("products").select("title, category_slug, brand, image_url").eq("id", offer.product_id).maybeSingle(),
        supa.from("stores").select("name, logo_url, is_international, country").eq("id", offer.store_id).maybeSingle(),
      ]);
      if (product && store) {
        return {
          offer_id:         offer.id,
          product_id:       offer.product_id,
          store_id:         offer.store_id,
          url:              offer.url,
          current_price:    offer.current_price,
          original_price:   offer.original_price,
          discount_percent: offer.discount_percent,
          currency:         offer.currency as "NGN" | "USD",
          scraped_at:       offer.scraped_at,
          in_stock:         offer.in_stock ?? true,
          title:            product.title,
          category_slug:    product.category_slug,
          brand:            product.brand,
          image_url:        product.image_url,
          store_name:       store.name,
          store_logo_url:   store.logo_url,
          is_international: store.is_international ?? false,
          store_country:    (store as { country?: string | null }).country ?? null,
        };
      }
    }
  }

  /* (3) Curated Amazon — curated ids double as their product_id. */
  const curated = curatedAmazonDeals.find((d) => d.id === productId);
  if (curated) {
    return {
      offer_id:         curated.id,
      product_id:       curated.id,
      store_id:         curated.storeId,
      url:              curated.url,
      current_price:    curated.salePrice,
      original_price:   curated.originalPrice ?? curated.salePrice,
      discount_percent: curated.discountPercent ?? 0,
      currency:         curated.currency,
      scraped_at:       curated.postedAt + "T00:00:00Z",
      in_stock:         true,
      title:            curated.title,
      category_slug:    curated.categorySlug,
      brand:            null,
      image_url:        curated.imageUrl ?? null,
      store_name:       curated.storeName,
      store_logo_url:   `/logos/${curated.storeId}.png`,
      is_international: curated.currency === "USD",
      store_country:    (curated.id.match(/^amazon-(us|uk|de|ae|in)-/i)?.[1] ?? "").toUpperCase() || null,
    };
  }

  return null;
});
