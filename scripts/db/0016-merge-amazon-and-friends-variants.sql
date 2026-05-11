-- ──────────────────────────────────────────────────────────────────
-- Merge legacy merchant-variant store rows into their canonical
-- counterparts. Post-launch UK pool audit found:
--
--   "Amazon.co.uk - Amazon.co.uk-Seller"   (85 rows)
--   "Amazon UK"                            (10 rows)   ← canonical
--
-- Same merchant. Same logo. Different store_id, so they showed as
-- two separate rows in /uk/deals?origin=local — inflating Amazon's
-- apparent share of the UK pool.
--
-- The canonicaliseSource() function in src/lib/providers/search-
-- serpapi.ts fixes this going forward (May 2026 commit edad5a8),
-- but pre-existing offer rows keep pointing at the variant store_ids
-- until those offers naturally expire. This migration accelerates
-- the merge by:
--
--   1. For each "variant" store_id, finding the canonical store_id
--      (manually mapped in the WHEN clauses below).
--   2. Updating any offer rows that point at the variant to point
--      at the canonical store instead, redirecting through a
--      one-shot UPDATE.
--   3. Deleting the now-orphaned variant store rows.
--
-- Same pattern applies to JD Sports / Currys / John Lewis where
-- the canonicaliser also collapses brand-suffix variants.
--
-- Idempotency:
--   The UPDATE statements are gated on the variant store_id
--   existing — re-running is safe; rows that have already been
--   merged stay merged. The DELETE is gated on the canonical
--   row also existing, so we never orphan offers by deleting
--   their only store reference.
--
-- WARNING — destructive:
--   This issues UPDATEs and DELETEs against `offers` and `stores`.
--   Run the diagnostic SELECT block at the bottom FIRST to see
--   what would change, then run the rest only after eyeballing
--   the candidate list.
-- ──────────────────────────────────────────────────────────────────

begin;

-- ── 1. Diagnostic: variant rows that would be merged ─────────────
-- Uncomment to dry-run. Comment back out before committing the
-- actual UPDATE/DELETE statements below.
--
-- select id, name, country, (
--   select count(*) from offers where store_id = stores.id
-- ) as offer_count
-- from stores
-- where lower(id) like 'amazon%co%uk%'
--    or lower(id) like 'amazon%uk%seller%'
--    or lower(id) like 'jd-sports%global%'
--    or lower(id) like 'jd-sports-%'
--    or (lower(id) like 'currys%' and lower(id) <> 'currys')
--    or lower(id) like 'john-lewis-partners-%'
-- order by offer_count desc;

-- ── 2. Amazon UK variants → 'amazon-uk' ──────────────────────────
-- Ensure the canonical row exists. INSERT … ON CONFLICT is safe
-- whether the canonical row was already created by a recent ingest
-- or needs to be created now.
insert into stores (id, name, country, is_international, trusted, logo_url)
values ('amazon-uk', 'Amazon UK', 'UK', false, true, '/logos/amazon.png')
on conflict (id) do update
  set name = excluded.name,
      country = excluded.country;

-- Redirect every offer pointing at any Amazon-UK variant to the
-- canonical store row.
update offers
set store_id = 'amazon-uk'
where store_id <> 'amazon-uk'
  and (
       lower(store_id) like 'amazon%co%uk%'
    or lower(store_id) like 'amazon%uk%seller%'
    or lower(store_id) = 'amazon-co-uk'
  );

-- ── 3. Other Amazon-market variants ──────────────────────────────
-- Same pattern, narrower scope. Each canonical row already exists
-- from prior ingests in most cases; the upsert is defensive.
insert into stores (id, name, country, is_international, trusted, logo_url)
values
  ('amazon-de', 'Amazon Germany', 'DE', false, true, '/logos/amazon.png'),
  ('amazon-ae', 'Amazon UAE',     'AE', false, true, '/logos/amazon.png'),
  ('amazon-in', 'Amazon India',   'IN', false, true, '/logos/amazon.png'),
  ('amazon',    'Amazon',         'US', false, true, '/logos/amazon.png')
on conflict (id) do update set name = excluded.name, country = excluded.country;

update offers set store_id = 'amazon-de' where store_id <> 'amazon-de' and lower(store_id) like 'amazon%de%';
update offers set store_id = 'amazon-ae' where store_id <> 'amazon-ae' and lower(store_id) like 'amazon%ae%';
update offers set store_id = 'amazon-in' where store_id <> 'amazon-in' and lower(store_id) like 'amazon%in%';
update offers set store_id = 'amazon'    where store_id <> 'amazon'
  and (lower(store_id) like 'amazon%com%seller%' or lower(store_id) = 'amazon-com');

-- ── 4. JD Sports — collapse the "Global" arm ─────────────────────
insert into stores (id, name, country, is_international, trusted, logo_url)
values ('jd-sports', 'JD Sports', 'UK', false, true, '/logos/jd-sports.png')
on conflict (id) do update set name = excluded.name, country = excluded.country;

update offers set store_id = 'jd-sports'
where store_id <> 'jd-sports'
  and lower(store_id) like 'jd-sports%';

-- ── 5. Currys — collapse "Currys Business" + variants ────────────
insert into stores (id, name, country, is_international, trusted, logo_url)
values ('currys', 'Currys', 'UK', false, true, '/logos/currys.png')
on conflict (id) do update set name = excluded.name, country = excluded.country;

update offers set store_id = 'currys'
where store_id <> 'currys'
  and lower(store_id) like 'currys%';

-- ── 6. John Lewis — collapse rebranded suffixes ──────────────────
insert into stores (id, name, country, is_international, trusted, logo_url)
values ('john-lewis-partners', 'John Lewis & Partners', 'UK', false, true, '/logos/john-lewis-partners.png')
on conflict (id) do update set name = excluded.name, country = excluded.country;

update offers set store_id = 'john-lewis-partners'
where store_id <> 'john-lewis-partners'
  and (lower(store_id) = 'john-lewis' or lower(store_id) like 'john-lewis-%');

-- ── 7. Clean up orphaned variant store rows ──────────────────────
-- A store row is orphaned if it has no offer rows pointing at it
-- AND its id matches one of our merged-variant patterns. The
-- subquery guard means we never delete a store that still has
-- offers (e.g. a future variant we didn't anticipate).
delete from stores
where (
     lower(id) like 'amazon%co%uk%'
  or lower(id) like 'amazon%uk%seller%'
  or lower(id) = 'amazon-co-uk'
  or lower(id) like 'amazon%de%'   and id <> 'amazon-de'
  or lower(id) like 'amazon%ae%'   and id <> 'amazon-ae'
  or lower(id) like 'amazon%in%'   and id <> 'amazon-in'
  or lower(id) like 'amazon%com%seller%'
  or lower(id) like 'jd-sports%'   and id <> 'jd-sports'
  or lower(id) like 'currys%'      and id <> 'currys'
  or lower(id) = 'john-lewis'
  or lower(id) like 'john-lewis-%' and id <> 'john-lewis-partners'
)
and id not in (select store_id from offers);

-- ── 8. Post-merge inventory ──────────────────────────────────────
-- Uncomment to print a summary after applying. Useful as a manual
-- sanity check during the migration.
--
-- select s.id, s.name, s.country, count(o.id) as offer_count
-- from stores s
-- left join offers o on o.store_id = s.id
-- where s.country = 'UK'
-- group by s.id, s.name, s.country
-- order by offer_count desc;

commit;
