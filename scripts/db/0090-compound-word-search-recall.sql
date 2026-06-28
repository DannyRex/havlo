-- ──────────────────────────────────────────────────────────────────
-- Migration 0090: compound-word search recall (lawnmower <-> lawn mower)
--
-- User report (June 2026): searching "lawnmower" returned almost
-- nothing useful, even though the catalog carries ~15 of them. Root
-- cause is tokenisation, not missing data:
--
--   websearch_to_tsquery('english', 'lawn mower') ANDs the two tokens
--   {lawn, mower}. A title that stores the word fused ("Bosch Rotak
--   Lawnmower") tokenises to {bosch, rotak, lawnmower} — it has
--   neither 'lawn' nor 'mower' as a standalone token, so the FTS match
--   misses it. The reverse misses too: query "lawnmower" (one token)
--   never matches a spaced title ("LawnMaster Robotic Lawn Mower").
--   Trigram similarity is diluted below threshold by the surrounding
--   brand/model words, so it doesn't rescue either direction.
--
--   Net effect measured on prod: /deals "lawnmower"=15 but "lawn
--   mower"=9 (different result sets for the same intent), and the
--   /compare anchor FTS could only scrape together a lone single-store
--   anchor with zero alternatives.
--
-- Fix: a space-normalised match. Collapse spaces on BOTH the query and
-- the title, then substring-match. "lawn mower" -> "lawnmower" matches
-- "...lawnmower...", and "lawnmower" matches "...lawn mower..." once
-- that title is collapsed too. Symmetric, and it covers dishwasher /
-- dish washer, playstation / play station, headphones / head phones,
-- airpods / air pods, etc. with no per-word list to maintain.
--
-- GATED so it can't reintroduce the substring noise migration 0061
-- deliberately removed from search_deals_fts (where bare
-- "iphone 15 pro" LIKE-matched "...pro max ronaldo phone case"):
--   * at most 2 whitespace tokens — this is the compound-WORD case,
--     a single word that's sometimes written with a space, not a
--     multi-word product descriptor.
--   * collapsed length 5..24 — long enough that the substring is
--     specific, short enough to stay a single product word.
-- "iphone 15 pro" (3 tokens) is excluded, so 0061's tightening holds.
--
-- Applies to BOTH search engines so /compare (search_products_fts) and
-- /deals browse (search_deals_fts) gain the same recall. A GIN trigram
-- index on the collapsed title keeps the new clause index-backed
-- instead of a sequential scan.
--
-- Idempotent — CREATE EXTENSION IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS, CREATE OR REPLACE FUNCTION. Pure-additive to both WHERE
-- clauses (only ever widens the match set within the gate), so no
-- existing result can disappear.
-- ──────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

-- Index the space-collapsed title so the gated de-spaced LIKE below
-- can use a trigram GIN scan rather than a full seq scan. replace()
-- and lower() are IMMUTABLE, so the functional index is valid.
create index if not exists idx_products_title_despaced_trgm
  on products using gin (replace(lower(title), ' ', '') gin_trgm_ops);


-- ── /compare anchor FTS (was migration 0041) ──────────────────────
-- Reproduces 0041 verbatim (including the store_country column) and
-- adds: (1) a de-spaced rank boost, (2) the gated de-spaced WHERE
-- clause.
DROP FUNCTION IF EXISTS search_products_fts(text, integer);

CREATE OR REPLACE FUNCTION search_products_fts(
  q text,
  max_results int DEFAULT 24
)
RETURNS TABLE (
  product_id        uuid,
  title             text,
  category_slug     text,
  brand             text,
  image_url         text,
  offer_id          uuid,
  store_id          text,
  store_name        text,
  store_logo_url    text,
  is_international  boolean,
  url               text,
  current_price     numeric,
  original_price    numeric,
  discount_percent  integer,
  currency          text,
  rank              real,
  store_country     text
)
LANGUAGE sql STABLE AS $$
  WITH ranked AS (
    SELECT
      p.id,
      p.title,
      p.category_slug,
      p.brand,
      p.image_url,
      (
        ts_rank(p.search_doc, websearch_to_tsquery('english', q))
        + similarity(lower(p.title), lower(q)) * 0.5
        -- Exact-phrase boost.
        + CASE
            WHEN lower(p.title) LIKE '%' || lower(q) || '%' THEN 2.0
            ELSE 0.0
          END
        -- Per-token whole-word boost.
        + CASE
            WHEN array_length(
              array(
                SELECT 1
                FROM unnest(string_to_array(lower(q), ' ')) AS w
                WHERE length(w) >= 2
                  AND position(' ' || w || ' ' IN ' ' || lower(p.title) || ' ') > 0
              ),
              1
            ) = array_length(
              array(SELECT 1 FROM unnest(string_to_array(lower(q), ' ')) AS w WHERE length(w) >= 2),
              1
            )
            THEN 0.8
            ELSE 0.0
          END
        -- Compound-word (space-collapsed) boost. Gated to the
        -- compound-word case so it surfaces "lawn mower" -> "Lawnmower"
        -- matches without re-ranking long multi-word descriptors.
        + CASE
            WHEN array_length(string_to_array(btrim(lower(q)), ' '), 1) <= 2
             AND length(replace(lower(q), ' ', '')) BETWEEN 5 AND 24
             AND replace(lower(p.title), ' ', '') LIKE '%' || replace(lower(q), ' ', '') || '%'
            THEN 1.5
            ELSE 0.0
          END
      ) AS rank
    FROM products p
    WHERE
      p.search_doc @@ websearch_to_tsquery('english', q)
      OR similarity(lower(p.title), lower(q)) > 0.18
      OR lower(p.title) LIKE '%' || lower(q) || '%'
      -- Compound-word recall: collapse spaces on both sides and
      -- substring-match, gated to single-word-with-optional-space
      -- queries (<= 2 tokens, 5..24 collapsed chars).
      OR (
        array_length(string_to_array(btrim(lower(q)), ' '), 1) <= 2
        AND length(replace(lower(q), ' ', '')) BETWEEN 5 AND 24
        AND replace(lower(p.title), ' ', '') LIKE '%' || replace(lower(q), ' ', '') || '%'
      )
    ORDER BY rank DESC
    LIMIT max_results
  )
  SELECT
    r.id              AS product_id,
    r.title,
    r.category_slug,
    r.brand,
    r.image_url,
    o.offer_id,
    o.store_id,
    o.store_name,
    o.store_logo_url,
    o.is_international,
    o.url,
    o.current_price,
    o.original_price,
    o.discount_percent,
    o.currency,
    r.rank,
    o.store_country
  FROM ranked r
  JOIN product_best_offers o ON o.product_id = r.id
  ORDER BY r.rank DESC;
$$;


-- ── /deals browse FTS (was migration 0061) ────────────────────────
-- Reproduces 0061 verbatim (0.35 trigram gate, no bare-substring gate)
-- and adds the same de-spaced boost + gated de-spaced WHERE clause.
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
        + case
            when lower(p.title) like '%' || lower(q) || '%' then 2.0
            else 0.0
          end
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
        -- Compound-word (space-collapsed) boost, gated as above.
        + case
            when array_length(string_to_array(btrim(lower(q)), ' '), 1) <= 2
             and length(replace(lower(q), ' ', '')) between 5 and 24
             and replace(lower(p.title), ' ', '') like '%' || replace(lower(q), ' ', '') || '%'
            then 1.5
            else 0.0
          end
      ) as rank
    from products p
    where
      p.search_doc @@ websearch_to_tsquery('english', q)
      or similarity(lower(p.title), lower(q)) > 0.35
      -- Compound-word recall, same gate as search_products_fts. Keeps
      -- 0061's tightening (no bare substring match) for 3+ word queries.
      or (
        array_length(string_to_array(btrim(lower(q)), ' '), 1) <= 2
        and length(replace(lower(q), ' ', '')) between 5 and 24
        and replace(lower(p.title), ' ', '') like '%' || replace(lower(q), ' ', '') || '%'
      )
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
--   -- Both spellings now return the same ballpark (was 15 vs 9):
--   select count(*) from search_deals_fts('lawnmower',  p_country=>'UK');
--   select count(*) from search_deals_fts('lawn mower', p_country=>'UK');
--
--   -- Compare anchor FTS finds the fused + spaced titles for either:
--   select title from search_products_fts('lawn mower', 12);
--
--   -- 0061's tightening still holds (3-word query, gate excludes it):
--   select title from search_deals_fts('iphone 15 pro', p_country=>'NG') limit 8;
--   -- → still only real iPhone 15 Pro, no "...pro max ronaldo case".
