-- ──────────────────────────────────────────────────────────────────
-- suggest_titles — space-insensitive matching.
--
-- User report May 2026: "/uk/compare?q=lawn+mower returns no results
-- when there is lawnmower". Expected behaviour: a query with spaces
-- should match titles that fuse the same words ("lawn mower" matches
-- "Lawnmower X-200"), and vice versa.
--
-- Root cause: 0020's suggest_titles compares the query and title
-- literally. "lawn mower" and "lawnmower" share no contiguous
-- trigrams above the threshold, and the ilike fallback uses the
-- literal `like '%lawn mower%'` which requires the space to be
-- present in the title.
--
-- Fix: extend both paths to also try a space-stripped variant of
-- query AND title. Same trigram threshold, same scoring, but the
-- comparison is done on the whitespace-collapsed form when the
-- literal form doesn't match.
--
-- This handles:
--   "lawn mower"          → "Lawnmower X-200"  (split → fused)
--   "lawnmower"           → "Lawn Mower 3000"  (fused → split)
--   "macbook pro"         → "MacBookPro M4"    (subtle SKU naming)
--   "iphone 15 promax"    → "iPhone 15 Pro Max" (already worked via trigram, now also via space-strip)
--   "play station 5"      → "PlayStation 5"    (split brand → fused brand)
--
-- It does NOT handle:
--   "iphone" → "Apple iPhone" (just needs to match anywhere)
--   "iphn"   → "iPhone"       (typos — trigram catches this)
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION, safe to re-run.
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
  with
  /* Space-stripped query for the fused-form variant. Computed once
     to avoid repeating the regexp_replace inside every row check. */
  qnorm as (
    select regexp_replace(lower(q), '\s+', '', 'g') as q_squashed
  ),
  trigram_hits as (
    /* Primary path: trigram similarity. Tries BOTH the literal form
       AND the space-stripped form. Whichever scores higher wins.
       Threshold 0.10 keeps the existing tolerance for short queries
       (the round-4 "ninja" fix). */
    select distinct on (lower(p.title))
      p.id   as product_id,
      p.title,
      greatest(
        similarity(lower(p.title), lower(q)),
        similarity(regexp_replace(lower(p.title), '\s+', '', 'g'), (select q_squashed from qnorm))
      ) as score
    from products p
    where similarity(lower(p.title), lower(q)) > 0.10
       or similarity(regexp_replace(lower(p.title), '\s+', '', 'g'), (select q_squashed from qnorm)) > 0.10
    order by
      lower(p.title),
      greatest(
        similarity(lower(p.title), lower(q)),
        similarity(regexp_replace(lower(p.title), '\s+', '', 'g'), (select q_squashed from qnorm))
      ) desc
  ),
  ilike_hits as (
    /* Fallback: literal substring match, also tried in both forms.
       Only fires when trigram returns nothing. The space-stripped
       form catches "lawn mower" → "lawnmower" via the second OR.
       Score uses length-inverse capped below the trigram threshold
       so genuine trigram hits always rank first when both produce
       rows. */
    select distinct on (lower(p.title))
      p.id   as product_id,
      p.title,
      least(0.099, 30.0 / greatest(length(p.title), 30)) as score
    from products p
    where length(q) >= 2
      and not exists (select 1 from trigram_hits)
      and (
        lower(p.title) like '%' || lower(q) || '%'
        or regexp_replace(lower(p.title), '\s+', '', 'g')
             like '%' || (select q_squashed from qnorm) || '%'
      )
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

-- Sanity checks after applying:
--   select title, score from suggest_titles('lawn mower');     -- new: surfaces "Lawnmower X-200"
--   select title, score from suggest_titles('macbook pro');    -- still works
--   select title, score from suggest_titles('play station 5'); -- new: "PlayStation 5" variants
--   select title, score from suggest_titles('ninja');          -- 0020 regression check
--   select title, score from suggest_titles('zzznotreal');     -- still empty
