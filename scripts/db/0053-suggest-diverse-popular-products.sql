/* ─────────────────────────────────────────────────────────────────
   0053 — suggest_diverse_popular_products()

   Sibling of suggest_multistore_products() (migration 0010) but
   biased for CATEGORY DIVERSITY: returns at most one product per
   category_slug, sorted by store count desc within each category.
   Used by the homepage Hero placeholder rotation so the rotating
   examples span phones / fashion / beauty / home / appliances /
   sports / etc rather than all-electronics like the hand-curated
   list it replaces.

   Same eligibility rules as suggest_multistore_products:
     - At least one store local to the user's country
     - At least one store NOT local (so the comparison is genuinely
       cross-store, not just intra-NG, which has no price-spread
       value)
     - Multi-store: ≥ 2 distinct stores total
     - Title length 6-80 chars (chip-friendly)

   Order within each category: store_count desc, total_offers desc.
   The output is bounded by max_categories (default 8). Caller can
   ask for fewer to fit specific UI surfaces.

   Why a new RPC vs filtering suggest_multistore_products in JS:
     The top-30 from suggest_multistore_products often clusters on
     a single category — e.g. NG's top 30 might be 22 phones + 5
     audio + 3 home. JS-side dedup would drop us to 3-5 categories,
     too narrow for a rotating placeholder. This RPC's DISTINCT ON
     forces one-per-category at the SQL level so we get 8-10
     genuinely different categories regardless of how skewed the
     popularity distribution is. */

create or replace function suggest_diverse_popular_products(
  user_country     text default 'ng',
  max_categories   int  default 8
)
returns table (
  product_id     uuid,
  title          text,
  brand          text,
  category_slug  text,
  store_count    int
)
language sql stable as $$
  with
    /* Same local + non-local filter as suggest_multistore_products. */
    local_products as (
      select distinct o.product_id
      from offers o
      join stores s on s.id = o.store_id
      where lower(s.country) = lower(user_country)
    ),
    nonlocal_products as (
      select distinct o.product_id
      from offers o
      join stores s on s.id = o.store_id
      where s.country is null
         or lower(s.country) <> lower(user_country)
    ),
    /* All multi-store products with their store count + category. */
    eligible as (
      select
        p.id                                                                       as product_id,
        p.title,
        p.brand,
        p.category_slug,
        (select count(distinct store_id)::int from offers where product_id = p.id) as store_count,
        (select count(*)::int                  from offers where product_id = p.id) as total_offers
      from products p
      where length(p.title) between 6 and 80
        and p.category_slug is not null
        and p.category_slug <> ''
        and p.id in (select product_id from local_products)
        and p.id in (select product_id from nonlocal_products)
    )
  /* DISTINCT ON forces one product per category_slug — the first one
     after sort, which is the highest-store-count product in that
     category. The outer ORDER BY then sorts the per-category winners
     by their own store_count so the rotation starts with the strongest
     product (gives the user the highest-quality first impression
     before rotating into the long tail). */
  select product_id, title, brand, category_slug, store_count
  from (
    select distinct on (category_slug)
      product_id, title, brand, category_slug, store_count, total_offers
    from eligible
    order by category_slug, store_count desc, total_offers desc
  ) per_cat
  order by store_count desc
  limit max_categories;
$$;

comment on function suggest_diverse_popular_products(text, int) is
  'Returns up to max_categories popular products, one per distinct category_slug, biased for cross-store comparison value. Used by the homepage Hero placeholder rotation so examples span all of phones / fashion / beauty / home / appliances / etc rather than clustering on one category.';
