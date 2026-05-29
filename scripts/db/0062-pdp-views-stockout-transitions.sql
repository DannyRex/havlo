-- ──────────────────────────────────────────────────────────────────
-- B2B data-tap foundation tables (May 29 2026).
--
-- These open two event streams Havlo wasn't capturing before. The
-- gap was identified in docs/b2b-data-strategy.md: we tracked CLICKS
-- (out to merchant) but not VIEWS, and we tracked CURRENT in_stock
-- state but not TRANSITIONS. The reports we'd want to sell to
-- retailers and brands depend on both.
--
-- Both tables are written-only at this stage. Aggregation rollups
-- (b2b_daily_rollups) come in a later migration once we have a few
-- weeks of data to size the indexing strategy off.
-- ──────────────────────────────────────────────────────────────────


-- ── PDP view events ────────────────────────────────────────────────
-- Fire-and-forget POST from the PDP server shell. session_id is the
-- hash of an anonymous cookie set by middleware; it lets us measure
-- "this anonymous user looked at 5 products in Fashion" without
-- knowing who they are. No PII; no IP storage; GDPR-safe by design.

create table if not exists pdp_views (
  id           bigserial   primary key,
  session_id   text        not null,           -- hashed anonymous cookie value
  country      text        not null,           -- iso 3166-1 alpha-2 lowercased
  product_id   uuid        references products(id) on delete set null,
  offer_id     uuid        references offers(id) on delete set null,
  source       text        not null,           -- 'google' | 'direct' | 'internal-deals' | 'internal-compare' | 'internal-similar' | 'internal-blog' | 'other'
  referrer     text,                           -- raw referrer URL when known (capped to 500 chars at insert)
  user_agent_class text,                       -- 'mobile' | 'tablet' | 'desktop' | 'bot' | null
  viewed_at    timestamptz not null default now()
);

create index if not exists pdp_views_country_date_idx
  on pdp_views (country, viewed_at desc);
create index if not exists pdp_views_product_idx
  on pdp_views (product_id, viewed_at desc);
create index if not exists pdp_views_session_idx
  on pdp_views (session_id, viewed_at desc);

-- Bot exclusion happens at query time on `user_agent_class`. We keep
-- bot rows because they tell us about Google's crawl pattern, useful
-- separately for SEO health monitoring.


-- ── Inventory state transitions ───────────────────────────────────
-- Postgres trigger on offers AFTER UPDATE OF in_stock. Logs every
-- flip so we have the time series of when product X went out of
-- stock at store Y, and when it came back. Powers "stockout
-- incidence" and "time-to-restock" reports.

create table if not exists inventory_state_transitions (
  id           bigserial   primary key,
  offer_id     uuid        not null references offers(id) on delete cascade,
  product_id   uuid        references products(id) on delete set null,
  store_id     text        not null,
  from_state   boolean,                       -- null if previous was null (first sweep)
  to_state     boolean     not null,
  changed_at   timestamptz not null default now()
);

create index if not exists inv_transitions_store_date_idx
  on inventory_state_transitions (store_id, changed_at desc);
create index if not exists inv_transitions_offer_idx
  on inventory_state_transitions (offer_id, changed_at desc);
create index if not exists inv_transitions_product_idx
  on inventory_state_transitions (product_id, changed_at desc);

create or replace function log_inventory_state_change()
returns trigger language plpgsql as $$
begin
  if new.in_stock is distinct from old.in_stock then
    insert into inventory_state_transitions (offer_id, product_id, store_id, from_state, to_state)
    values (new.id, new.product_id, new.store_id, old.in_stock, new.in_stock);
  end if;
  return null;
end $$;

drop trigger if exists log_inventory_state_change_trigger on offers;

create trigger log_inventory_state_change_trigger
after update of in_stock on offers
for each row execute function log_inventory_state_change();


-- ── outbound_clicks: add source attribution column ─────────────────
-- Existing schema has deal_id, query, position, mode. We're not
-- breaking any of that. Adding `source` so reports can split
-- conversion rate by which SURFACE the click happened on
-- (pdp-hero / deals-card / similar-rail / compare-row / etc.).
-- Nullable so existing rows + any client that doesn't pass it stay
-- compatible.

alter table outbound_clicks
  add column if not exists source text;

create index if not exists outbound_clicks_source_idx
  on outbound_clicks (source, clicked_at desc)
  where source is not null;


-- ── Sanity checks after apply ──────────────────────────────────────
--   -- Should each return 0 right after apply
--   select count(*) from pdp_views;
--   select count(*) from inventory_state_transitions;
--
--   -- Trigger smoke test
--   update offers set in_stock = false where id = '<known-offer-id>';
--   select * from inventory_state_transitions where offer_id = '<known-offer-id>';
--   -- Expect one row with from_state = true, to_state = false.
