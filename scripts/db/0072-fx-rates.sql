-- 0072-fx-rates.sql
-- Single source of truth for currency conversion, replacing the hardcoded
-- USD->NGN rate that had drifted between layers: SQL RPCs used 1650
-- (0054/0055/0056), TS used 1600 (utils.ts USD_TO_NGN + ingestion +
-- providers). Same offer therefore got two different NGN values depending
-- on which layer computed it -- exactly the kind of self-contradiction the
-- numbers are not supposed to have.
--
-- Populated daily by scripts/fetch-fx-rates.ts (.github/workflows/fx-rates.yml)
-- from open.er-api.com (keyless, free, and crucially carries NGN -- the
-- ECB-based feeds like Frankfurter do not). SQL reads it via fx_rate();
-- TS reads it via src/lib/fx.ts. Apply in the Supabase SQL editor.

create table if not exists fx_rates (
  base       text        not null,
  quote      text        not null,
  rate       numeric     not null check (rate > 0),
  source     text,
  updated_at timestamptz not null default now(),
  primary key (base, quote)
);

-- Seed with the values currently hardcoded so behaviour is UNCHANGED until
-- the cron writes live rates. USD->NGN is seeded at 1650 (the SQL rate the
-- RPCs compiled with) so price-history / 30d-low / alerts keep reading the
-- exact same number today -- the only immediate effect of this migration is
-- that the TS side (which used 1600) now also reads 1650, killing the drift.
insert into fx_rates (base, quote, rate, source) values
  ('USD', 'NGN', 1650,   'seed'),
  ('USD', 'GBP', 0.79,   'seed'),
  ('USD', 'EUR', 0.92,   'seed'),
  ('USD', 'AED', 3.6725, 'seed'),
  ('USD', 'INR', 83,     'seed'),
  ('USD', 'ZAR', 18,     'seed')
on conflict (base, quote) do nothing;

-- fx_rate(base, quote): the stored rate, or a safe fallback so a missing
-- row can never zero out a price. STABLE -> the planner evaluates it once
-- per query rather than per row. Keep the USD->NGN fallback at 1650 so it
-- matches the seed + the previous SQL literal even if the table is empty.
create or replace function fx_rate(p_base text, p_quote text)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select rate from fx_rates where base = p_base and quote = p_quote),
    case when p_base = 'USD' and p_quote = 'NGN' then 1650 else 1 end
  );
$$;
