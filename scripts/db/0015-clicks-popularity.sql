-- ─── 0015 ── Outbound clicks + popularity aggregation ─────────────
--
-- WHY THIS MIGRATION
--
-- The previous `clicks` table (created in scripts/ai-search/supabase-
-- schema.sql for the early AI-search experiment) had a foreign-key
-- constraint:
--
--   deal_id text not null references deals_index(id) on delete cascade
--
-- The live /api/click route logs deal_ids that come from TWO sources:
--   1. Homepage MasonryCard / LiveCard      → offer_id (UUID)
--   2. /compare anchor + dupe rows          → product.key (slug)
--
-- Neither of those exists in `deals_index` (that was a separate
-- experiment table that's never populated by the production
-- ingestion pipeline). So EVERY click insert silently failed the FK
-- check. Verified May 2026: 0 rows in `clicks` despite the route
-- being live for months.
--
-- The route also wrote `mode` and `clicked_at` columns, but the
-- schema had `search_mode` and `created_at`. Double silent failure.
--
-- Strategy: drop the old experimental table cleanly and replace
-- with `outbound_clicks` that has no FK constraint (deal_id is
-- intentionally polymorphic — can be an offer_id, product.key, or
-- anything else we ship from a new surface in the future). The
-- aggregation function below handles the join semantics on read,
-- left-joining against both offers and products and attributing
-- the click to whichever side resolves.

-- ── Replace the old experimental clicks table ──────────────────────
drop table if exists clicks;

create table if not exists outbound_clicks (
  id          bigserial primary key,
  deal_id     text not null,
  query       text,
  position    integer,
  mode        text,
  clicked_at  timestamptz not null default now()
);

-- Indexes:
--   deal_id_idx : per-deal lookup (rare admin query, kept cheap)
--   recency_idx : the agg function filters by clicked_at, then groups
--                 by deal_id → a leading-clicked_at index keeps the
--                 30-day window scan cheap even at high traffic.
create index if not exists outbound_clicks_deal_id_idx on outbound_clicks (deal_id);
create index if not exists outbound_clicks_recency_idx on outbound_clicks (clicked_at desc);


-- ── popular_products(days_back) ────────────────────────────────────
-- Returns (product_id, clicks) over the last N days. The /api/click
-- log is polymorphic on deal_id, so we left-join against BOTH offers
-- and products, then COALESCE — each click attributes to exactly one
-- product (the offer's product, OR the directly-named product). Clicks
-- that match neither (e.g. legacy AI-search experimental ids) are
-- silently dropped.
--
-- Callers: src/lib/providers/browse-db.ts pulls this into an in-
-- memory Map<product_id, clicks> and uses it to populate `clicks`
-- on each Deal row. The /deals "Most popular" sort then ranks by
-- that field. Wrapped in unstable_cache (5 min) on the JS side so
-- this RPC fires at most once per cache window.

create or replace function popular_products(days_back int default 30)
returns table(product_id text, clicks int)
language sql
stable
as $$
  select
    coalesce(o.product_id::text, p.id::text) as product_id,
    count(*)::int                            as clicks
  from outbound_clicks c
  left join offers   o on o.id::text = c.deal_id
  left join products p on p.id::text = c.deal_id
  where c.clicked_at > now() - (days_back || ' days')::interval
    and (o.product_id is not null or p.id is not null)
  group by coalesce(o.product_id::text, p.id::text);
$$;
