/* ─────────────────────────────────────────────────────────────────
   0052 — match_decisions cache (Phase 4 product-match upgrade)
   ─────────────────────────────────────────────────────────────────

   Persistent cache of LLM-as-judge decisions on whether two products
   are the same. When isLikelySameProduct's lexical-gate-score lands
   in the ambiguous band (0.55 - 0.85), we call gpt-4o-mini to settle
   the question and cache the verdict here. Future queries on the
   same pair short-circuit to the cached decision — pay once per
   pair across the entire catalog lifetime.

   Schema:
     - (anchor_id, candidate_id) — composite primary key; order is
       canonical (smaller UUID first) so both directions of a pair
       hit the same row.
     - decision — 'same' | 'variant' | 'different'. 'variant' is
       a useful middle ground (e.g. iPhone 15 Pro 256GB vs 512GB
       — same product family, different SKU); the caller decides
       whether to admit variants as same-product depending on the
       use case.
     - confidence — model's self-reported confidence (0-1). For
       inspection / tuning, not used in the cache lookup.
     - model — which LLM produced the decision. Lets us invalidate
       just the gpt-4o-mini decisions if we upgrade to a newer
       judge model without losing the gpt-5 ones, etc.
     - decided_at — for stale-cache management if we ever want to
       re-judge old decisions after model upgrades.

   Cost projection: assume ~5% of all cross-store comparison queries
   hit the ambiguous band. With ~10k queries/day at peak and ~10
   candidate comparisons per query, that's ~5,000 LLM calls/day
   on first-time-seen pairs. After ~2 weeks of warm cache the rate
   drops to ~500/day (mostly genuinely new pairs from fresh ingest).
   At gpt-4o-mini's pricing (~$0.001 per decision with our prompt
   shape), that's ~$15/month steady state. Cheap. */

CREATE TABLE IF NOT EXISTS match_decisions (
  /* Smaller UUID first by lexicographic comparison so both
     directions of a pair hit the same row. The check constraint
     enforces this invariant. */
  anchor_id     UUID    NOT NULL,
  candidate_id  UUID    NOT NULL,
  decision      TEXT    NOT NULL CHECK (decision IN ('same', 'variant', 'different')),
  confidence    REAL    NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model         TEXT    NOT NULL,
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /* Composite PK — one decision per pair. The canonical-order
     constraint below ensures we always look up the same row
     regardless of which side called isLikelySameProduct. */
  PRIMARY KEY (anchor_id, candidate_id),
  CHECK (anchor_id < candidate_id),
  /* FK to products for orphan management. ON DELETE CASCADE so
     deleting a product also removes any cached decisions about it
     (otherwise we'd have stale rows pointing to deleted products
     after store-merge or catalog cleanup). */
  FOREIGN KEY (anchor_id)    REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES products(id) ON DELETE CASCADE
);

/* Lookups are always by both keys, so the PK already serves them.
   No additional indexes needed. */

COMMENT ON TABLE match_decisions IS
  'LLM-as-judge cached decisions on whether two products are the same. Composite PK on (anchor_id, candidate_id) with anchor_id < candidate_id invariant so both directions hit the same row.';

COMMENT ON COLUMN match_decisions.decision IS
  'same | variant | different. variant = same product family but different SKU (color/size/storage variant) — caller decides whether to admit.';

COMMENT ON COLUMN match_decisions.model IS
  'Identifier of the judging model (e.g. "gpt-4o-mini-2024-07-18"). Lets us bulk-invalidate decisions from a specific model version if needed.';

/* Helper: insert a decision with the canonical key order applied.
   Callers don't have to remember to sort the UUIDs themselves —
   pass (a, b) in any order and the function normalises. Returns
   the decision that was stored (which may be a pre-existing row
   that the ON CONFLICT clause preserved — no thrashing). */
CREATE OR REPLACE FUNCTION upsert_match_decision(
  p_a            UUID,
  p_b            UUID,
  p_decision     TEXT,
  p_confidence   REAL,
  p_model        TEXT
)
RETURNS match_decisions
LANGUAGE plpgsql
AS $$
DECLARE
  v_anchor   UUID;
  v_candidate UUID;
  v_row      match_decisions;
BEGIN
  IF p_a < p_b THEN
    v_anchor := p_a; v_candidate := p_b;
  ELSIF p_b < p_a THEN
    v_anchor := p_b; v_candidate := p_a;
  ELSE
    /* Self-comparison — degenerate, just refuse to cache it. */
    RAISE EXCEPTION 'anchor_id and candidate_id must differ';
  END IF;

  INSERT INTO match_decisions (anchor_id, candidate_id, decision, confidence, model)
  VALUES (v_anchor, v_candidate, p_decision, p_confidence, p_model)
  ON CONFLICT (anchor_id, candidate_id) DO NOTHING
  RETURNING * INTO v_row;

  /* If ON CONFLICT swallowed the insert, return the existing row. */
  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM match_decisions
      WHERE anchor_id = v_anchor AND candidate_id = v_candidate;
  END IF;
  RETURN v_row;
END $$;
