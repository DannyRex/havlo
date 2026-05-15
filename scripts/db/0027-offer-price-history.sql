-- ──────────────────────────────────────────────────────────────────
-- offer_price_history — track every meaningful price change.
--
-- Unlocks for the PriceComparisonBar:
--   • "Lowest seen at this store: £X (Mar 2026)"
--   • "Price dropped 12% in the last 7 days"
--   • "All-time low" badge when current_price matches the historical floor
--   • Sparkline of price over time (future)
--
-- Strategy: a Postgres trigger on `offers` writes a row WHENEVER
-- current_price changes between an UPDATE and its prior state, or
-- whenever an INSERT brings in a brand-new offer (so the first
-- price point is always recorded). UPSERT path covered by both.
--
-- Why a trigger (not a JS-side diff in ingestion.ts):
--   • Works regardless of which ingest path runs. Future ingest
--     paths automatically get history without code coordination.
--   • Single source of truth in the DB; nothing can sneak past it.
--   • Cheaper than reading the old row JS-side just to compare.
--
-- Schema:
--   offer_id       — FK to offers (cascaded delete; we don't keep
--                    orphan history when an offer is removed).
--   price          — the price at this point in time (NGN or USD
--                    per the offer's currency column at the time).
--   currency       — denormalised so the read path doesn't need a
--                    join to interpret the price; currency rarely
--                    changes on an offer but we want history-time
--                    truth.
--   discount_percent — captured for "was on sale at X% off" stories.
--   recorded_at    — when the price was first seen at this value.
--
-- Indexing:
--   (offer_id, recorded_at desc) — primary access pattern: "show
--      me this offer's price history, newest first".
--   (product_id, recorded_at desc) — for cross-store rollups
--      ("lowest seen across any store for this product").
--   product_id is denormalised on insert (via the trigger) so we
--   don't pay a join cost on hot read paths.
--
-- IDEMPOTENT — function + trigger drop-and-create.
-- ──────────────────────────────────────────────────────────────────

create table if not exists offer_price_history (
  id               bigserial primary key,
  offer_id         uuid not null references offers(id) on delete cascade,
  product_id       uuid not null references products(id) on delete cascade,
  price            numeric(12,2) not null,
  currency         text not null check (currency in ('NGN', 'USD')),
  discount_percent integer,
  recorded_at      timestamptz not null default now()
);

create index if not exists offer_price_history_offer_idx
  on offer_price_history (offer_id, recorded_at desc);

create index if not exists offer_price_history_product_idx
  on offer_price_history (product_id, recorded_at desc);


-- ── Trigger function ────────────────────────────────────────────────
-- Fires on INSERT (always, captures the first price point) and on
-- UPDATE (only when current_price actually changed — no point
-- recording identical-price re-upserts).
--
-- NULL handling: if the old price was NULL (shouldn't happen — the
-- schema requires current_price NOT NULL) we treat it as a change.

create or replace function record_offer_price_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT')
     or (tg_op = 'UPDATE' and (
       new.current_price is distinct from old.current_price
       or new.currency is distinct from old.currency
     ))
  then
    insert into offer_price_history (offer_id, product_id, price, currency, discount_percent, recorded_at)
    values (new.id, new.product_id, new.current_price, new.currency, new.discount_percent, coalesce(new.scraped_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists offer_price_history_trigger on offers;

create trigger offer_price_history_trigger
  after insert or update of current_price, currency on offers
  for each row execute function record_offer_price_change();


-- ── Backfill: seed history with one row per existing offer ─────────
-- For offers that were ingested BEFORE this migration, we have no
-- historical rows. Seed each with a single starting point using the
-- offer's current scraped_at as recorded_at, so the UI doesn't have
-- to special-case "no history yet" for the entire existing catalog.
-- Idempotent via NOT EXISTS — re-runs after future ingests are safe
-- and won't duplicate.

insert into offer_price_history (offer_id, product_id, price, currency, discount_percent, recorded_at)
select o.id, o.product_id, o.current_price, o.currency, o.discount_percent, coalesce(o.scraped_at, now())
from offers o
where not exists (
  select 1 from offer_price_history h where h.offer_id = o.id
);


-- ── RPC: product_price_history(product_id, days_back) ──────────────
-- Returns per-store min/max/latest price for a product over a window.
-- Used by the PriceComparisonBar to surface:
--   • lowest_seen — the historical floor (anywhere in the window)
--   • latest      — current displayed price
--   • last_change — when the latest price first appeared
--
-- Lightweight: rows are pre-indexed by (product_id, recorded_at).

create or replace function product_price_history(
  p_product_id uuid,
  p_days_back  integer default 90
)
returns table (
  store_id        text,
  lowest_seen     numeric(12,2),
  lowest_seen_at  timestamptz,
  latest          numeric(12,2),
  latest_at       timestamptz,
  currency        text
)
language sql
stable
as $$
  with windowed as (
    select
      o.store_id,
      h.price,
      h.currency,
      h.recorded_at
    from offer_price_history h
    join offers o on o.id = h.offer_id
    where h.product_id = p_product_id
      and h.recorded_at > now() - (p_days_back || ' days')::interval
  ),
  per_store as (
    select
      store_id,
      currency,
      min(price)                                                            as lowest_seen,
      (array_agg(recorded_at order by price asc, recorded_at asc))[1]       as lowest_seen_at,
      (array_agg(price order by recorded_at desc))[1]                       as latest,
      max(recorded_at)                                                      as latest_at
    from windowed
    group by store_id, currency
  )
  select store_id, lowest_seen, lowest_seen_at, latest, latest_at, currency
  from per_store;
$$;


-- ── Sanity checks ───────────────────────────────────────────────────
--   -- After applying, every existing offer should have at least one history row
--   select count(*) from offer_price_history;
--   select count(*) from offers;
--
--   -- Pick a product with multiple stores
--   select * from product_price_history(
--     p_product_id => (select id from products limit 1),
--     p_days_back  => 90
--   );
--
--   -- Trigger smoke test: update a current_price, then check history
--   update offers set current_price = current_price + 1 where id = (select id from offers limit 1);
--   select recorded_at, price from offer_price_history
--   where offer_id = (select id from offers limit 1)
--   order by recorded_at desc limit 5;
