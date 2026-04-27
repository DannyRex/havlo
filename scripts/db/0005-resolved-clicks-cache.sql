-- Phase 9 follow-up — outbound-click URL resolution cache.
--
-- Run in the Supabase SQL Editor after 0004-offers-source-country.sql.
--
-- Why this exists:
--   SerpAPI returns Google Shopping relay URLs for many results
--   (https://www.google.com/.../prds=...), which land users on a Google
--   product card instead of the actual merchant. We resolve relay URLs
--   to the merchant via a SerpAPI follow-up call, then cache the
--   result here so we only pay 1 credit per relay across all users.
--
-- Used by /api/go.

CREATE TABLE IF NOT EXISTS resolved_clicks (
  source_url   text PRIMARY KEY,
  resolved_url text NOT NULL,
  resolved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resolved_clicks_resolved_at_idx
  ON resolved_clicks (resolved_at);
