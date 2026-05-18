-- ══════════════════════════════════════════════════════════════════
-- LAUNCH MIGRATIONS BUNDLE
-- ══════════════════════════════════════════════════════════════════
-- Paste-ready bundle of every outstanding migration as of May 2026
-- launch-readiness pass. Includes:
--   0007 — product_requests table
--   0014 — newsletter_subscribers.category column
--   0015 — outbound_clicks + popular_products RPC
--   0027 — offer_price_history + trigger + RPC
--   0035 — aggressive stores.country backfill
--
-- All migrations are idempotent — safe to re-run.
-- Order matters only inside 0027 (trigger needs table first) and
-- inside 0035 (TLD passes before name passes).
--
-- Verify after running:
--   npx tsx scripts/check-migrations.ts
-- ══════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════
-- ║ 0007
-- ╚═══════════════════════════════════════════════════════════════
-- ──────────────────────────────────────────────────────────────────
-- Product-request capture: when a user searches for something Havlo
-- can't find (truly empty state on /deals or /compare), we offer
-- "notify me when found" as one of the recovery options. This table
-- holds those signups.
--
-- Doubles as catalog-demand intelligence: every row is a user
-- explicitly asking for a product we don't currently surface. Sort
-- by query frequency to know what to ingest next.
--
-- Idempotency: unique on (email, query) so re-submitting the same
-- query/email combo no-ops. A user can subscribe to multiple
-- different products though (different query → different row).
-- ──────────────────────────────────────────────────────────────────

create table if not exists product_requests (
  id          uuid        primary key default gen_random_uuid(),
  query       text        not null,
  email       text        not null,
  country     text,
  source      text        not null default 'unknown',  -- 'deals' | 'compare'
  user_agent  text,
  notified_at timestamptz,                              -- set when we email them
  created_at  timestamptz not null default now()
);

-- Plain-column unique index (NOT functional). Supabase's PostgREST
-- `onConflict: "email,query"` parameter resolves to PostgreSQL's
-- ON CONFLICT (email, query), which only matches a unique index on
-- those literal columns. A functional index like (lower(email),
-- lower(query)) is treated as a different index and the upsert fails
-- with 'no unique constraint matching the ON CONFLICT specification'.
-- Casing is normalised in the API layer (both email and query are
-- lowercased before insert) so the plain index gives correct dedup.
create unique index if not exists product_requests_email_query_idx
  on product_requests (email, query);

-- Lookup index for the catalog-demand leaderboard query (group by
-- lower(query) to count requests per term).
create index if not exists product_requests_query_idx
  on product_requests (query);

create index if not exists product_requests_pending_idx
  on product_requests (created_at desc)
  where notified_at is null;

-- RLS: lock down. Only service-role (server-side) reads + writes.
-- The /api/notify-product route uses service role; no direct client
-- access (PII protection — we don't want users querying each other's
-- emails).
alter table product_requests enable row level security;

-- No policies = no access for anon / authenticated roles.
-- Service-role bypasses RLS automatically.

-- ╔═══════════════════════════════════════════════════════════════
-- ║ 0014
-- ╚═══════════════════════════════════════════════════════════════
-- ──────────────────────────────────────────────────────────────────
-- Add category targeting to newsletter_subscribers.
--
-- Powers the "Get Phones deals in your inbox" subscribe widget on
-- /deals (visible whenever the user has filtered to a specific
-- category). Subscribers with a non-null `category` get only the
-- daily digest items in that category; null = standard catch-all
-- newsletter (existing behaviour preserved for all current rows).
--
-- Schema additions:
--   • category text — slug from src/lib/data/categories.ts (phones,
--     audio, computing, …) or null for catch-all.
--   • partial index on (category, country) where status='active' so
--     the daily send job can fan out efficiently per category.
--
-- Migration is idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────

alter table newsletter_subscribers
  add column if not exists category text;

create index if not exists newsletter_category_idx
  on newsletter_subscribers (category, country)
  where status = 'active';

comment on column newsletter_subscribers.category is
  'Category slug (phones / audio / computing / …) when subscriber wants only that category. NULL = catch-all daily roundup.';

-- ╔═══════════════════════════════════════════════════════════════
-- ║ 0015
-- ╚═══════════════════════════════════════════════════════════════
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

-- ╔═══════════════════════════════════════════════════════════════
-- ║ 0027
-- ╚═══════════════════════════════════════════════════════════════
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

-- ╔═══════════════════════════════════════════════════════════════
-- ║ 0035
-- ╚═══════════════════════════════════════════════════════════════
-- ──────────────────────────────────────────────────────────────────
-- Migration 0035: aggressive backfill of stores.country
--
-- Context (May 2026 launch-readiness pass): after 0011 + 0033's
-- explicit-roster backfills landed, 890 of 1,000 stores STILL had
-- country=NULL. The roster regexes only matched stores we'd
-- explicitly enumerated; the long tail (American Eagle Outfitters,
-- Sony Store Online UK, Dell South Africa, Cash Crusaders, AT&T,
-- mobile-phones-direct, wallis-uk, oppostore.co.uk, wmf-com-de,
-- and ~300+ other clearly country-anchored stores) stayed NULL.
--
-- Consequence: those stores get filtered OUT for every visitor in
-- filterDealsForCountry (since they're not in any country roster
-- AND they're untagged). Effectively orphaned — paid SerpAPI
-- credits to ingest them, but they never reach a user.
--
-- This migration uses three heuristic layers, each more specific:
--   1. TLD in storeId — `.co.uk`, `.de`, `.co.za`, `.ae`, `.com.ng`
--      etc. Most reliable signal — a domain TLD strongly implies
--      market anchorage.
--   2. Name/ID suffix — `-uk`, `-de`, `-za`, `uk` / `germany` /
--      `south africa` / `uae` / `india` substring in NAME.
--   3. Common-brand catch-all for big retailers not on the rosters
--      yet (American Eagle, AT&T, Bath & Body Works, etc.) —
--      adds another layer of US/UK coverage.
--
-- Order matters: each UPDATE skips rows where country IS NOT NULL,
-- so the more-reliable signal (TLD) gets first pass. Later passes
-- can't overwrite an established tag.
--
-- Expected result: ~600-700 of the 890 NULL rows get tagged. The
-- residue (~200-300) are stores with truly opaque IDs / names
-- (Unihertz, "AND", "Big Apple Buddy", etc.) — those stay NULL,
-- which means they're filtered out of every market pool. That's
-- correct: if we can't confidently place a store, the user
-- shouldn't see it.
--
-- Idempotent — all UPDATEs are WHERE country IS NULL.
-- ──────────────────────────────────────────────────────────────────

-- ── Layer 1: TLD in storeId (most reliable) ───────────────────────

-- UK: .co.uk, .uk
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND (id ~* '\.co\.uk(\W|$)|\.uk(\W|$)|-co-uk(\W|$)|-uk-' OR id ~* '\.co-uk(\W|$)');

-- Germany: .de
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND (id ~* '\.de(\W|$)|-de(\W|$)' AND id !~* 'aldi-de-uk');  -- defensive: avoid mis-tagging German-named UK stores

-- South Africa: .co.za, .za
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND id ~* '\.co\.za(\W|$)|\.za(\W|$)|-co-za(\W|$)|-za(\W|$)';

-- UAE: .ae
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND id ~* '\.ae(\W|$)|-ae(\W|$)';

-- India: .in, .co.in
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND id ~* '\.in(\W|$)|\.co\.in(\W|$)|-co-in(\W|$)|-in(\W|$)';

-- Nigeria: .com.ng, .ng
UPDATE stores SET country = 'NG'
 WHERE country IS NULL
   AND id ~* '\.com\.ng(\W|$)|\.ng(\W|$)|-com-ng(\W|$)';

-- US: .com, .us — applied LAST among TLDs because .com is the
-- broadest signal. Only catches stores whose ID is JUST .com /
-- domain.com (no country prefix). After UK/DE/ZA/AE/IN/NG pre-
-- claim, leftover .com stores are presumed US-anchored.
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND (id ~* '\.com(\W|$)|-com(\W|$)|\.us(\W|$)|-us(\W|$)');

-- ── Layer 2: name/ID suffix patterns ──────────────────────────────

-- UK: "UK" suffix in name, "-uk" in id
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND (
     name ~* '\W(UK|United Kingdom|Britain)(\W|$)'
     OR id ~* '(^|\W)uk(\W|$)|-uk-|^uk-'
     OR name ~* '(^|\s)(Argos|Currys|John Lewis|Boots|Next|M&S|Marks & Spencer|Selfridges|Harrods|Debenhams|JD Sports|Sports Direct|Argos|Halfords|Wickes|Screwfix|B&Q|Smyths)(\s|$)'
   );

-- South Africa: name patterns
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND (
     name ~* 'south africa|\WSA(\W|$)'
     OR id ~* 'south-africa|-sa$|^sa-'
     OR name ~* '(^|\s)(Takealot|Makro|Loot|Wantitall|Yuppiechef|Superbalist|Zando|Everyshop|Incredible Connection|Cellucity|Cash Crusaders|Wellness Warehouse|Dis-Chem|Clicks)(\s|$)'
   );

-- Germany: name patterns
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND (
     name ~* 'germany|deutschland'
     OR id ~* 'germany|deutschland'
     OR name ~* '(^|\s)(MediaMarkt|Saturn|Otto|Zalando|Conrad|Lidl|Kaufland|Tchibo|Notebooksbilliger|Cyberport|Alternate)(\s|$)'
   );

-- UAE: name patterns
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND (
     name ~* '\W(UAE|U\.A\.E\.|Dubai|Abu Dhabi|Emirates)(\W|$)'
     OR id ~* 'uae|dubai|emirates'
     OR name ~* '(^|\s)(Noon|Sharaf DG|Carrefour UAE|Lulu Hypermarket|Centrepoint|Namshi|Ounass|6thStreet|Jumbo|Splash|Babyshop|Letstango|Menakart|Desertcart)(\s|$)'
   );

-- India: name patterns
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND (
     name ~* '\WIndia(\W|$)|\WIndian(\W|$)'
     OR id ~* '(^|-)india(-|$)|(^|-)indian(-|$)'
     OR name ~* '(^|\s)(Flipkart|Myntra|Ajio|Tata CLiQ|Snapdeal|Nykaa|FirstCry|Meesho|Croma|Reliance Digital|Vijay Sales|Naaptol|IndiaMART|Purplle|Boat Lifestyle|Mamaearth)(\s|$)'
   );

-- Nigeria: name patterns
UPDATE stores SET country = 'NG'
 WHERE country IS NULL
   AND (
     name ~* '\WNigeria(\W|$)|\WNaira(\W|$)'
     OR id ~* '(^|-)nigeria(-|$)'
     OR name ~* '(^|\s)(Konga|Jumia|Slot|3C Hub|Pointek|Fouani|Spar Nigeria|HealthPlus|MedPlus|Supermart|Essenza|Kara|Ajebomarket|Bitmarte|Obiwezy)(\s|$)'
   );

-- US: name patterns — runs LAST so other country tags get first pick
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND (
     name ~* '\W(USA|U\.S\.|U\.S\.A\.|America)(\W|$)'
     OR id ~* '(^|-)usa?(-|$)|(^|-)america(-|$)'
     OR name ~* '(^|\s)(Amazon|Walmart|Best Buy|Target|Newegg|Home Depot|Macy.s|Kohl.s|Nordstrom|Sephora|Ulta|Wayfair|Lowes|Lowe.s|Staples|Old Navy|Gap|Banana Republic|Nike|Adidas|GameStop|JCPenney|Fashion Nova|Dick.s Sporting Goods|Bloomingdales|Neiman Marcus|Saks|Bed Bath|Ann Taylor|LOFT|J\.Crew|Michael Kors|Tory Burch|Ralph Lauren|Coach|Crocs|Old Navy|American Eagle|Abercrombie|Hollister|Urban Outfitters|Free People|Anthropologie|Verizon|AT&T|T-Mobile|Boost Mobile|Cricket Wireless|Microsoft Store|Xbox|Best Buy Mobile|TigerDirect|Micro Center|Bath & Body Works|Victoria.s Secret)(\s|$)'
   );

-- ── Layer 3: brand-domain inference for storeIds that ARE domains
--    but didn't match a TLD regex (e.g. "freepeople" without .com) ─

-- Brand-domain US (catches storeIds like "freepeople", "jcpenney"
-- where the brand name is the ID itself)
UPDATE stores SET country = 'US'
 WHERE country IS NULL
   AND id IN (
     'freepeople','free-people','urbanoutfitters','urban-outfitters',
     'anthropologie','jcpenney','j-c-penney','jcpenny',
     'old-navy','oldnavy','gap','banana-republic','bananarepublic',
     'gamestop','game-stop','newegg','wayfair','etsy','staples',
     'kohls','kohl-s','macys','macy-s','nordstrom','sephora','ulta',
     'wayfair','lowes','homedepot','home-depot','staples',
     'best-buy','bestbuy','walmart','target','newegg','costco','bjs',
     'verizon','att','at-t','t-mobile','tmobile','boost-mobile',
     'boostmobile','cricket-wireless','cricketwireless','sprint',
     'fashion-nova','fashion-nova-com','fashionnova',
     'ralph-lauren','ralphlauren','michael-kors','michaelkors',
     'tory-burch','toryburch','calvin-klein','calvinklein',
     'american-eagle','american-eagle-outfitters','ae-outfitters',
     'abercrombie','abercrombie-fitch','hollister','hollisterco',
     'coach','crocs','crocs-com','bath-body-works','bathandbodyworks',
     'bed-bath-beyond','bedbath','victorias-secret','victoriassecret',
     'ann-taylor','anntaylor','loft','j-crew','jcrew',
     'urban-outfitters','free-people','anthropologie',
     'big-apple-buddy','academy-sports-outdoors','academy',
     'going-going-gone','goinggoinggone','ggg',
     'nfm','nebraska-furniture','nebraskafurniture',
     'qvc','qvc-com','qvc.com','hsn',
     'dicks-sporting-goods','dick-s-sporting-goods','dickssportinggoods',
     'b-h-photo-video-audio','bhphoto','bhphotovideo','b-h-photo',
     'fashionnova-com','tigerdirect','microcenter','micro-center',
     'juvia-s-place','juvias-place','juviasplace',
     'sephora-com','ulta-com','ulta-beauty','sephora-beauty',
     'macys-com','macy-s-com'
   );

-- Brand-domain UK
UPDATE stores SET country = 'UK'
 WHERE country IS NULL
   AND id IN (
     'currys','argos','john-lewis','johnlewis','john-lewis-co-uk',
     'boots','boots-com','next','next-co-uk','very','very-co-uk',
     'ao-com','ao','asos','jdsports','jd-sports','sports-direct',
     'sportsdirect','marks-spencer','marks-and-spencer','m-s',
     'selfridges','harrods','debenhams','dunelm','halfords',
     'wickes','screwfix','b-q','b-and-q','diy-com',
     'smyths','smyths-toys','river-island','primark','matalan',
     'house-of-fraser','tesco','sainsbury','sainsburys','aldi',
     'lidl-uk','iceland','morrisons','waitrose','ocado',
     'tk-maxx','tkmaxx','tk-max',
     'wallis-uk','wallis','dorothy-perkins','warehouse-uk',
     'mobile-phones-direct','mobilephonesdirect','three-uk',
     'ee','ee-co-uk','ee-mobile','vodafone-uk','vodafone',
     'sony-store-online-uk','sony-uk','samsung-uk',
     'sky-uk','sky-mobile','virgin-mobile','virgin-uk',
     'currys-business','currys-pc-world',
     'oppostore','oppostore-co-uk','xiaomi-uk','huawei-uk',
     'justmylook','justmylook-com','look-fantastic','lookfantastic',
     'feelunique','feel-unique','beauty-bay','beautybay',
     'hotel-chocolat','hotelchocolat','robert-dyas','robertdyas',
     'the-range','therange','toolstation','machine-mart',
     'wickes','homebase','b-and-m','poundland',
     'monsoon','accessorize','phase-eight','phaseeight','hobbs',
     'fatface','fat-face','white-stuff','whitestuff','joules','seasalt',
     'made-com','made','loaf-com','loaf','dfs',
     'kurt-geiger','kurtgeiger','clarks-uk','clarks',
     'cath-kidston','cathkidston','radley-uk','radley',
     'the-perfume-shop','perfume-shop','superdrug',
     'molton-brown','moltonbrown','lush','the-body-shop','thebodyshop'
   );

-- Brand-domain DE
UPDATE stores SET country = 'DE'
 WHERE country IS NULL
   AND id IN (
     'mediamarkt','media-markt','saturn','otto','zalando','idealo',
     'notebooksbilliger','alternate','cyberport','lidl','kaufland',
     'real-de','tchibo','conrad','computeruniverse','voelkner',
     'rewe','edeka','mytoys','bonprix','redcoon','comtech',
     'douglas','rossmann','dm-de','dm','deichmann','thalia','weltbild',
     'hugendubel','schiesser','esprit-de','h-m-de',
     'apple-de','microsoft-de','xbox-de','sony-de','samsung-de',
     'wmf-com-de','wmf','bosch-de','siemens-de','miele-de',
     'fielmann','apollo','sanicare','medpex','docmorris',
     'jumbo-de','jumbo'
   );

-- Brand-domain ZA
UPDATE stores SET country = 'ZA'
 WHERE country IS NULL
   AND id IN (
     'takealot','makro','loot','loot-co-za','wantitall',
     'yuppiechef','superbalist','zando','everyshop',
     'incredible-connection','incredibleconnection',
     'checkers','pick-n-pay','picknpay','shoprite',
     'wellness-warehouse','wellnesswarehouse',
     'clicks-co-za','clicks','dis-chem','dischem',
     'woolworths-sa','woolworths-co-za','woolworthsza','woolworths',
     'raru','raru-co-za','evetech','bobshop','spree','spree-co-za',
     'mr-price','mrp-com','mrprice','edgars','ackermans',
     'pep','pepstores','game-co-za','game-stores',
     'builders-warehouse','builders-co-za','builders',
     'cellucity','cellucity-co-za',
     'dell-south-africa','dell-sa','hp-south-africa',
     'cash-crusaders','cashcrusaders',
     'kalahari','kalahari-com'
   );

-- Brand-domain AE
UPDATE stores SET country = 'AE'
 WHERE country IS NULL
   AND id IN (
     'noon','noon-com','sharaf-dg','sharafdg','carrefour-ae',
     'carrefour-uae','lulu-hypermarket','luluhypermarket','luluwebstore',
     'first-cry-ae','firstcry-ae','centrepoint','centrepointstores',
     'namshi','ounass','6thstreet',
     'ace','acehardware-ae','ace-ae','jumbo-ae','jumbo-electronics',
     'emax','emax-ae','plug-ins','plugins-ae',
     'max-fashion','maxfashion-ae','splash','splashfashions',
     'babyshop','babyshopstores','mothercare-ae','shukran',
     'homecentre','home-centre','westelm-ae','west-elm-uae',
     'pottery-barn-uae','ubuy-ae','desertcart','desertcart-ae',
     'letstango','letstango-com','menakart','menakart-com'
   );

-- Brand-domain IN
UPDATE stores SET country = 'IN'
 WHERE country IS NULL
   AND id IN (
     'flipkart','myntra','ajio','tata-cliq','tatacliq',
     'snapdeal','nykaa','firstcry','firstcry-com','meesho','croma',
     'reliance-digital','reliancedigital','vijay-sales','vijaysales',
     'shopclues','naaptol','naaptol-com','indiamart',
     'purplle','1mg','tata-1mg','lenskart','boat-lifestyle',
     'mamaearth','swiggy','zomato','blinkit',
     'limeroad','voonik','abof','yepme',
     'vivo-india','oneplus-india','samsung-india','xiaomi-india',
     'smytten','swiss-beauty','hyugalife','sangeetha-mobiles',
     'desertcart-in','kamal-imaging','outdoorphoto'
   );

-- ── Sanity checks (run after applying) ────────────────────────────
-- 1. NULL count should drop dramatically:
--    SELECT country, count(*) FROM stores GROUP BY country ORDER BY 2 DESC;
--    → expect NULL ~250-350 (down from ~890), US ~250+, UK ~80+,
--       DE ~30+, ZA ~25+, AE ~20+, IN ~25+, NG ~25+
--
-- 2. Spot-check known stores:
--    SELECT id, name, country FROM stores
--     WHERE id IN ('american-eagle-outfitters', 'wallis-uk',
--                  'dell-south-africa', 'wmf-com-de', 'naaptol',
--                  'at-t', 'cellucity', 'noon-com');
--    → all should have country populated.
--
-- 3. Confirm NG roster:
--    SELECT count(*) FROM stores WHERE country = 'NG';
--    → expect ≥ 20 (was 9 pre-migration)
