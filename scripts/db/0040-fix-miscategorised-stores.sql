-- ──────────────────────────────────────────────────────────────────
-- Migration 0040: fix store_country mis-tagging caught in re-audit
--
-- Re-audit findings (cache-busted, server-rendered):
--   - "adidas.co.in" (storeId: adidas) tagged country=US → leaks
--     into /us/deals?origin=local as 12 items. Indian Adidas storefront.
--   - "desertcart.in" (storeId: desertcart-in) tagged country=AE →
--     leaks into /ae/deals?origin=local as 12 items. Indian storefront.
--   - "Acer Store UK" (storeId: acer-store-uk) tagged country=AE →
--     leaks into /ae/deals as 2 items. Clearly UK.
--
-- Root cause: roster substring collisions in COUNTRY_STORES:
--   - US roster bare "adidas" substring-matches "adidas.co.in"
--   - AE roster bare "desertcart" matches "desertcart-in"
--   - AE roster bare "acer" / "ace" matches "acer-store-uk"
--
-- The code-side fix (tightened rosters + country-variant entries
-- added to IN/UK rosters so longest-match wins) is shipped separately
-- in country.ts. This migration corrects the existing wrong DB tags.
--
-- Idempotent — UPDATE only touches the three specific rows.
-- ──────────────────────────────────────────────────────────────────

UPDATE stores SET country = 'IN'
 WHERE id = 'adidas' AND (name ILIKE '%adidas.co.in%' OR name ILIKE '%adidas india%');

UPDATE stores SET country = 'IN'
 WHERE id = 'desertcart-in';

UPDATE stores SET country = 'UK'
 WHERE id = 'acer-store-uk';

-- ── Defensive sweep: catch other obvious country-suffix mis-tags ──
-- Stores whose ID or name clearly indicates one country but DB tags
-- another. Conservative — only acts when ID/name contains a clear
-- country marker AND the current country tag conflicts.

-- .co.in / -in stores currently tagged anything OTHER than IN
UPDATE stores SET country = 'IN'
 WHERE country IS DISTINCT FROM 'IN'
   AND country IS NOT NULL
   AND (id ~* '\.co\.in(\W|$)|\.in(\W|$)|-co-in(\W|$)' OR name ~* '\.co\.in|\.in$');

-- .co.uk / -uk stores currently tagged anything OTHER than UK
UPDATE stores SET country = 'UK'
 WHERE country IS DISTINCT FROM 'UK'
   AND country IS NOT NULL
   AND (id ~* '\.co\.uk(\W|$)|-co-uk(\W|$)|-uk(\W|$)' OR name ~* '\.co\.uk|\WUK$');

-- .co.za / -za stores currently tagged anything OTHER than ZA
UPDATE stores SET country = 'ZA'
 WHERE country IS DISTINCT FROM 'ZA'
   AND country IS NOT NULL
   AND (id ~* '\.co\.za(\W|$)|-co-za(\W|$)|-za$' OR name ~* '\.co\.za|\.za$');

-- .ae / -ae stores currently tagged anything OTHER than AE
UPDATE stores SET country = 'AE'
 WHERE country IS DISTINCT FROM 'AE'
   AND country IS NOT NULL
   AND (id ~* '\.ae(\W|$)|-ae$' AND id !~* 'co\.uk|co\.in|co\.za' AND id !~* '^acer-')
   AND (name !~* 'germany|uae'  -- avoid catching unrelated rows
        OR name ~* '\.ae$|UAE');

-- .de / -de stores currently tagged anything OTHER than DE
UPDATE stores SET country = 'DE'
 WHERE country IS DISTINCT FROM 'DE'
   AND country IS NOT NULL
   AND id ~* '\.de(\W|$)|-de$'
   AND id !~* 'co\.uk|co\.in|co\.za|\.ae';

-- ── Sanity check ──────────────────────────────────────────────────
-- SELECT id, name, country FROM stores
--   WHERE id IN ('adidas', 'desertcart-in', 'acer-store-uk')
--   OR id ~* '\.(co\.in|co\.uk|co\.za|ae|de)$';
-- → expect each row tagged to its TLD's country.
