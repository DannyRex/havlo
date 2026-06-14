-- 0081-decouple-price-history.sql
-- Make the price-history asset SURVIVE offer / product / store deletion.
--
-- WHY: offer_price_history (0027) has offer_id + product_id as FKs with
-- ON DELETE CASCADE. So deleting an offer (or a product, or, via the
-- offers it owns, a store) ERASES that price history. That is how the
-- Payporte removal silently deleted Payporte's price trail: the moment its
-- offers were deleted, the cascade took their history with them.
--
-- The price history IS the moat (the multi-store, time-stamped price graph
-- nobody else has). It must only ever grow. A row should not depend on the
-- offer / product / store that produced it still existing.
--
-- WHAT THIS DOES (all countries, the table is global):
--   1. Snapshot store_id + store_name onto each history row, so a row is
--      self-contained even after the store is removed.
--   2. Make offer_id + product_id NULLABLE and switch their FKs to
--      ON DELETE SET NULL. Deleting an offer/product now NULLS the link
--      and KEEPS the row (price, currency, discount, store, recorded_at).
--   3. Teach the trigger to write the store snapshot going forward.
--   4. Backfill the store snapshot for existing rows.
--
-- Charts/RPC (product_price_history) read by product_id, so live products
-- keep working unchanged; only rows whose product was deleted go
-- product_id = NULL (still queryable for B2B/price-graph use, just no
-- longer attached to a live PDP). dedup still re-points history to the
-- canonical product first, so normal merges keep product_id populated.
--
-- ROLLBACK: re-add the FKs with ON DELETE CASCADE and set the columns
-- NOT NULL (only safe if no NULLs exist). Apply in the Supabase SQL editor.

-- 1) store snapshot columns
alter table offer_price_history
  add column if not exists store_id   text,
  add column if not exists store_name text;

-- 2) columns nullable so a delete can SET NULL instead of cascading
alter table offer_price_history alter column offer_id   drop not null;
alter table offer_price_history alter column product_id drop not null;

-- 2b) swap the FKs from CASCADE to SET NULL (history survives the delete)
alter table offer_price_history
  drop constraint if exists offer_price_history_offer_id_fkey;
alter table offer_price_history
  add  constraint offer_price_history_offer_id_fkey
  foreign key (offer_id) references offers(id) on delete set null;

alter table offer_price_history
  drop constraint if exists offer_price_history_product_id_fkey;
alter table offer_price_history
  add  constraint offer_price_history_product_id_fkey
  foreign key (product_id) references products(id) on delete set null;

-- 3) trigger now snapshots the store too. NEW.store_id is on the offer row
--    (no join); store_name is a single PK lookup on the tiny stores table,
--    only on a real price change, so the write cost is negligible.
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
    insert into offer_price_history
      (offer_id, product_id, store_id, store_name, price, currency, discount_percent, recorded_at)
    values
      (new.id, new.product_id, new.store_id,
       (select s.name from stores s where s.id = new.store_id),
       new.current_price, new.currency, new.discount_percent,
       coalesce(new.scraped_at, now()));
  end if;
  return new;
end;
$$;

-- trigger definition unchanged (re-create defensively)
drop trigger if exists offer_price_history_trigger on offers;
create trigger offer_price_history_trigger
  after insert or update of current_price, currency on offers
  for each row execute function record_offer_price_change();

-- 4) backfill the store snapshot for existing rows whose offer still exists
update offer_price_history h
set store_id   = o.store_id,
    store_name = s.name
from offers o
left join stores s on s.id = o.store_id
where h.offer_id = o.id
  and h.store_id is null;
