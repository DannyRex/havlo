-- ──────────────────────────────────────────────────────────────────
-- Did-you-mean helper for the empty-state recovery on /compare and
-- /deals. When the main FTS search returns nothing, we call this
-- function to surface the closest title matches as clickable pills.
--
-- Why a separate function (vs reusing search_products_fts):
--   • search_products_fts joins to product_best_offers, returning
--     one row per (product, offer). For did-you-mean we only want
--     distinct TITLES with the best similarity score, no offer
--     details needed — a tighter result set + smaller payload.
--   • Different threshold tuning. search_products_fts requires
--     similarity > 0.18; for suggestions we go lower (> 0.15) since
--     the user has already failed to find anything and needs more
--     forgiveness, not less.
--
-- Returns the product_id alongside the title so the UI can route to
-- ?key=<product_id> for a direct lookup if it wants. Currently we
-- route to ?q=<title> instead (re-runs search), but having both
-- options available costs nothing.
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
  -- Subquery dedupes by lowercased title (case-insensitive distinct);
  -- outer ORDER BY ranks the dedupe winners by similarity score.
  select product_id, title, score from (
    select distinct on (lower(p.title))
      p.id   as product_id,
      p.title,
      similarity(lower(p.title), lower(q)) as score
    from products p
    where similarity(lower(p.title), lower(q)) > 0.15
    order by lower(p.title), similarity(lower(p.title), lower(q)) desc
  ) sub
  order by score desc
  limit max_results;
$$;

-- Sanity check after applying:
--   select title, score from suggest_titles('iphon 15 promax');
--   select title, score from suggest_titles('macbk pro');
--   select title, score from suggest_titles('zzznotreal');
