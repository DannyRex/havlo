-- ──────────────────────────────────────────────────────────────────
-- search_deals_fts — tighten relevance so "iphone 15 pro" doesn't
-- surface iPhone 13 Pro, Xiaomi Redmi Note 14 Pro, phone cases via
-- shared trigrams (May 29 2026 user-reported bug).
--
-- Two changes to the original 0025-search-deals-fts RPC:
--
--   1. Raise the trigram similarity threshold from 0.18 → 0.35.
--      0.18 caught typos ("iphn 15") but also non-related products
--      that happen to share characters with the query (Xiaomi
--      Redmi vs iphone). 0.35 still catches typos within a single
--      word but stops single-shared-word noise from leaking in.
--
--   2. Drop the substring fallback (lower(title) like '%' || q || '%').
--      The exact-phrase BOOST (still present in the rank function)
--      already rewards substring matches; making it a WHERE clause
--      independent of FTS pulled in titles where the query was a
--      coincidental substring (e.g. "iphone 15 pro" inside "iphone
--      15 pro max ronaldo football phone case"). The rank function
--      preserves the boost so genuine matches still win; we just
--      stop using substring as a match GATE.
--
-- Output shape unchanged. WHERE narrower; rank function unchanged.
-- ──────────────────────────────────────────────────────────────────

create or replace function search_deals_fts(
  q              text,
  p_category     text default null,
  p_min_discount integer default 0,
  p_origin       text default 'all',
  p_store_ids    text[] default null,
  p_max_rows     integer default 1000,
  p_country      text default null
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
        -- Stays in the rank function (boost) even though we dropped
        -- the matching substring fallback from WHERE.
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
      -- FTS match (websearch_to_tsquery ANDs tokens by default)
      p.search_doc @@ websearch_to_tsquery('english', q)
      -- Trigram similarity gated tighter (0.35) — catches "iphn 15"
      -- typos within a single word but stops Xiaomi-Redmi-Note-Pro-style
      -- noise that shares a single token with the query.
      or similarity(lower(p.title), lower(q)) > 0.35
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
    case when p_country is not null and pbo.store_country = upper(p_country) then 0 else 1 end,
    r.rank desc nulls last,
    pbo.discount_percent desc nulls last,
    pbo.scraped_at desc nulls last,
    pbo.offer_id asc
  limit p_max_rows;
$$;


-- ── Sanity checks (run in Supabase SQL editor after applying) ─────
--   -- Specific query should return only real iPhone 15 Pro:
--   select title from search_deals_fts('iphone 15 pro', p_country=>'NG') limit 8;
--
--   -- Typo still works:
--   select title from search_deals_fts('iphn 15 pro max', p_country=>'NG') limit 8;
--
--   -- Brand search still works:
--   select title from search_deals_fts('rayban', p_country=>'NG') limit 8;
