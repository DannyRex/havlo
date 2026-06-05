-- 0077 — product attributes (denoised SerpAPI snippet + extensions)
--
-- The providers all set products.description = title (a verbatim echo), so the
-- catalog has no signal beyond the title -- which is especially thin for
-- fashion/beauty where colour/material/size/fit are the discriminators. SerpAPI
-- Google Shopping responses DO return a `snippet` + an `extensions` array
-- (often "Black", "Leather", "Men's", a short sentence) that we were discarding.
--
-- This column stores that denoised extra text. It feeds:
--   1. the title embedding (embed text becomes "title | attributes"), and
--   2. the LLM match-judge prompt (a `details:` line per side),
-- so the matcher has more to work with on ambiguous fashion/beauty pairs.
--
-- Nullable + additive: existing rows stay NULL; only newly-(re)ingested SerpAPI
-- products populate it. Apply BEFORE deploying the ingest change that writes it.

alter table products add column if not exists attributes text;

comment on column products.attributes is
  'Denoised extra product text from SerpAPI (snippet + attribute extensions). Feeds the title embedding + the match-judge prompt. NULL for non-SerpAPI / pre-0077 rows.';
