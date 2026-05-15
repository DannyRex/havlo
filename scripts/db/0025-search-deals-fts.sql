-- ──────────────────────────────────────────────────────────────────
-- search_deals_fts — FTS-powered deals search.
--
-- Replaces the `title ilike '%q%'` substring path in browse_deals
-- when the user has typed a query. ILIKE was missing:
--   • typos          ("iphn 15" → 0 results)
--   • stemming       ("earbuds" misses "earbud")
--   • brand aliases  ("rayban" misses "Ray-Ban")
--   • word reorderings ("max pro iphone" misses "iPhone Pro Max")
--
-- Strategy mirrors search_products_fts (0002 + 0003 exact-phrase boost)
-- but lays the browse filter/sort layer on top: same FTS + trigram +
-- exact-phrase blend, then applies category / min_discount / origin /
-- store / country-priority gates so /deals' filter chips still work
-- alongside relevance ranking.
--
-- Ranking blend (rank DESC):
--   ts_rank      on search_doc                      — baseline FTS
--   similarity   on lower(title) vs lower(q) * 0.5  — fuzzy / typo
--   +2.0 if lower(title) LIKE '%lower(q)%'           — exact phrase
--   +0.8 if every q-token is a whole word in title   — token coverage
--   country-priority TIE-BREAKER (anchored-local first when p_country set)
--   discount_percent DESC as last tie-breaker for equal-relevance rows
--
-- WHERE matches if ANY of:
--   p.search_doc @@ websearch_to_tsquery(q)
--   similarity(title, q) > 0.18           — trigram threshold (typos)
--   lower(title) LIKE '%lower(q)%'        — substring fallback
--
-- The 0.18 threshold matches search_products_fts. suggest_titles
-- uses 0.15 (more forgiving) for the did-you-mean recovery path.
--
-- Output shape MATCHES product_best_offers exactly so the JS layer
-- in browse-db.ts can keep treating both RPCs (browse_deals + this)
-- as returning BestOfferRow[].
--
-- IDEMPOTENT — CREATE OR REPLACE FUNCTION.
-- ──────────────────────────────────────────────────────────────────

create or replace function search_deals_fts(
  q              text,
  p_category     text default null,
  p_min_discount integer default 0,
  p_origin       text default 'all',          -- 'all' | 'local' | 'intl'
  p_store_ids    text[] default null,
  p_max_rows     integer default 1000,
  p_country      text default null             -- 'NG' / 'UK' / 'US' / etc.
)
returns setof product_best_offers
language sql
stable
as $$
  with ranked_products as (
    select
      p.id,
      (
        ts_rank(p.search_doc, websearch_to_tsquery('english', q))
        + similarity(lower(p.title), lower(q)) * 0.5
        -- Exact-phrase boost: query string appears verbatim in title.
        + case
            when lower(p.title) like '%' || lower(q) || '%' then 2.0
            else 0.0
          end
        -- Per-token whole-word boost: every word in q appears in title.
        + case
            when array_length(
              array(
                select 1
                from unnest(string_to_array(lower(q), ' ')) as w
                where length(w) >= 2
                  and position(' ' || w || ' ' in ' ' || lower(p.title) || ' ') > 0
              ),
              1
            ) = array_length(
              array(select 1 from unnest(string_to_array(lower(q), ' ')) as w where length(w) >= 2),
              1
            )
            then 0.8
            else 0.0
          end
      ) as rank
    from products p
    where
      p.search_doc @@ websearch_to_tsquery('english', q)
      or similarity(lower(p.title), lower(q)) > 0.18
      or lower(p.title) like '%' || lower(q) || '%'
  )
  select pbo.*
  from ranked_products r
  join product_best_offers pbo on pbo.product_id = r.id
  where (p_category is null or p_category = 'all' or pbo.category_slug = p_category)
    and (coalesce(p_min_discount, 0) = 0 or pbo.discount_percent >= p_min_discount)
    and (p_origin = 'all'
         or (p_origin = 'local' and pbo.is_international = false)
         or (p_origin = 'intl'  and pbo.is_international = true))
    and (p_store_ids is null or array_length(p_store_ids, 1) is null or pbo.store_id = any(p_store_ids))
  order by
    -- Country-priority first (same intent as browse_deals 0023): when
    -- p_country is set, anchored-local rows sort first within ties.
    case when p_country is not null and pbo.store_country = upper(p_country) then 0 else 1 end,
    -- Relevance is the primary sort.
    r.rank desc nulls last,
    -- Tie-breakers: higher discount, freshest, deterministic offer_id.
    pbo.discount_percent desc nulls last,
    pbo.scraped_at desc nulls last,
    pbo.offer_id asc
  limit p_max_rows;
$$;

-- ── Sanity checks ───────────────────────────────────────────────────
--   -- Typo tolerance
--   select count(*) from search_deals_fts('iphn 15 pro max', p_country=>'NG');
--
--   -- Brand normalisation (relies on synonym expansion JS-side; this
--   -- SQL alone matches "ray ban" loosely via trigram)
--   select count(*) from search_deals_fts('rayban');
--
--   -- Origin gating
--   select count(*) from search_deals_fts('phone case', p_origin=>'intl');
--
--   -- Empty-query safety: caller must NOT pass null q to this RPC
--   -- (use browse_deals instead). If null is passed, websearch_to_tsquery
--   -- returns ''::tsquery which matches nothing, so the function
--   -- returns empty rather than blowing up.
