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
}

export async function fetchOfferById(offerId: string): Promise<OfferRow | null> {
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
      .select("product_id, offer_id, store_id, url, current_price, original_price, discount_percent, currency, scraped_at, title, category_slug, brand, image_url, store_name, store_logo_url, is_international")
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
        supa.from("stores").select("name, logo_url, is_international").eq("id", offer.store_id).maybeSingle(),
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
    };
  }

  return null;
}
