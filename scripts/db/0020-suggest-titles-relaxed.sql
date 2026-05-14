-- ──────────────────────────────────────────────────────────────────
-- suggest_titles — relax trigram threshold + ilike fallback.
--
-- QA report May 2026: /us/compare?q=ninja+air+fryer returns
--   { mode: "empty", suggestions: [] }
-- even though the DB has 31 products with "ninja" in the title.
--
-- Root cause: trigram similarity is biased AGAINST short queries.
-- "ninja" is 5 chars / 5 trigrams; "Ninja Air Fryer 6QT" has many
-- more trigrams. The shared / total ratio falls below the 0.15
-- threshold even though the title clearly contains the word.
--
-- Fix:
--   1. Drop the threshold to 0.10 (more forgiving, especially for
--      short queries).
--   2. Add an ilike '%q%' fallback that fires when trigram returns
--      nothing — a literal substring match so any title containing
--      the query word surfaces. Scored by length-inverse so shorter
--      titles (closer matches) rank higher.
--
-- Result: "ninja" now surfaces "Ninja Air Fryer 6QT" + others as
-- did-you-mean suggestions. The /compare empty-state UI's "Did you
-- mean…" pills become useful for the common case where the user's
-- query is a brand name shorter than any single product title.
-- ──────────────────────────────────────────────────────────────────

create or replace function suggest_titles(
  q           text,
  max_results int default 3
)
returns table (
  product_id uuid,
  title      text,
  score      real
)
language sql stable as $$
  with trigram_hits as (
    /* Primary path: trigram similarity. Works well for typo-recovery
       and longer queries ("iphone 15 promax" → "iPhone 15 Pro Max").
       Threshold dropped from 0.15 → 0.10 (more forgiving). */
    select distinct on (lower(p.title))
      p.id   as product_id,
      p.title,
      similarity(lower(p.title), lower(q)) as score
    from products p
    where similarity(lower(p.title), lower(q)) > 0.10
    order by lower(p.title), similarity(lower(p.title), lower(q)) desc
  ),
  ilike_hits as (
    /* Fallback: literal substring match. Fires when trigram returns
       nothing — covers the short-query case ("ninja") where trigram
       similarity falls below the threshold despite a clear title
       match. Score uses length-inverse + a small floor so they sort
       BELOW any genuine trigram hit but ABOVE empty. */
    select distinct on (lower(p.title))
      p.id   as product_id,
      p.title,
      /* length-inverse score capped at 0.099 so trigram hits (which
         have score > 0.10) always win when both paths return rows. */
      least(0.099, 30.0 / greatest(length(p.title), 30)) as score
    from products p
    where length(q) >= 2
      and not exists (select 1 from trigram_hits)  -- only when trigram empty
      and lower(p.title) like '%' || lower(q) || '%'
    order by lower(p.title), length(p.title)
  )
  select product_id, title, score from (
    select * from trigram_hits
    union all
    select * from ilike_hits
  ) merged
  order by score desc, length(title) asc
  limit max_results;
$$;

-- Sanity check after applying:
--   select title, score from suggest_titles('ninja');           -- before: 0 rows; after: Ninja Air Fryer + others
--   select title, score from suggest_titles('iphone 15 pro');   -- trigram path, unchanged
--   select title, score from suggest_titles('zzznotreal');      -- 0 rows in both paths, returns empty
