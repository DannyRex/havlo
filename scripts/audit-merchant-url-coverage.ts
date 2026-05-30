#!/usr/bin/env -S npx tsx
/* Audit outbound merchant-URL coverage for the /api/go fallback chain.

   Why this exists: when a stored offer URL can't be used directly (the
   Google-Shopping relay case — SerpAPI's resolver is retired, so every
   relay now falls through), /api/go synthesises a destination from the
   store identity. This script measures, across every in-stock store,
   which tier that synthesis lands in:

     CURATED  — merchantSearchUrl / merchantHomepage hit the hand-
                verified MERCHANTS table (real domain, often a real
                search page). This is the safe tier.
     GUESS    — fell through to smartFallbackUrl, which only ever
                returns a SYNTHESISED HOMEPAGE (never a search page) and
                can get the TLD wrong for UK/regional brands (e.g.
                "Appliance City" -> appliancecity.com, a parked non-UK
                domain, instead of appliancecity.co.uk). This is the
                risk surface.
     NONE     — no merchant signal at all; the user would bounce to the
                Havlo /compare page.

   Run it after adding MERCHANTS entries to watch the GUESS/NONE counts
   shrink, and to pick the next highest-impact stores to curate (the
   GUESS list is ranked by in-stock offer count). The synthesised URL is
   printed for every GUESS row so wrong-TLD guesses are visible at a
   glance.

   Usage:  npx tsx scripts/audit-merchant-url-coverage.ts
   Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   (read-only: it only SELECTs from offers/stores). */
import { createClient } from "@supabase/supabase-js";
import { merchantSearchUrl, smartFallbackUrl, merchantHomepage } from "../src/lib/merchant-search-urls";
import { inferStoreCountry } from "../src/lib/country";

try { process.loadEnvFile?.(".env.local"); } catch {/* env may be set externally */}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error("Missing Supabase env."); process.exit(1); }
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const DUMMY = "test product 123";

async function fetchStores() {
  const PAGE = 1000;
  const counts = new Map<string, { name: string; count: number }>();
  let from = 0, pages = 0;
  for (;;) {
    const { data, error } = await supa
      .from("offers")
      .select("store_id, in_stock, stores(name)")
      .eq("in_stock", true)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ store_id: string; stores: { name: string } | { name: string }[] | null }>) {
      const sf = row.stores; const store = Array.isArray(sf) ? sf[0] : sf;
      const name = store?.name ?? row.store_id; const key = row.store_id;
      const cur = counts.get(key);
      if (cur) cur.count += 1; else counts.set(key, { name, count: 1 });
    }
    pages += 1;
    if (data.length < PAGE) break;
    from += PAGE;
    if (pages > 1000) break;
  }
  console.error(`Scanned ${pages} page(s), ${counts.size} distinct stores.`);
  return [...counts.entries()]
    .map(([store_id, { name, count }]) => ({ store_id, store_name: name, offer_count: count }))
    .sort((a, b) => b.offer_count - a.offer_count);
}

function classify(storeId: string, storeName: string) {
  const curated = merchantSearchUrl(storeId, storeName, DUMMY);
  if (curated) return { tier: "CURATED", url: curated.url };
  const guess = smartFallbackUrl(storeId, storeName, DUMMY);
  if (guess) return { tier: "GUESS", url: guess.url };
  const home = merchantHomepage(storeId, storeName);
  if (home) return { tier: "CURATED", url: home.url };
  return { tier: "NONE", url: "(Havlo /compare)" };
}

async function main() {
  const rows = await fetchStores();
  const guesses: Array<{ id: string; name: string; n: number; url: string; cc: string }> = [];
  const none: Array<{ id: string; name: string; n: number }> = [];
  let curatedCount = 0;
  for (const r of rows) {
    const c = classify(r.store_id, r.store_name);
    if (c.tier === "CURATED") curatedCount += 1;
    else if (c.tier === "GUESS") guesses.push({ id: r.store_id, name: r.store_name, n: r.offer_count, url: c.url, cc: inferStoreCountry(r.store_id, r.store_name) ?? "?" });
    else none.push({ id: r.store_id, name: r.store_name, n: r.offer_count });
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`distinct stores : ${rows.length}`);
  console.log(`CURATED (verified table): ${curatedCount}`);
  console.log(`GUESS  (smartFallback)  : ${guesses.length}`);
  console.log(`NONE   (-> Havlo)       : ${none.length}`);

  console.log(`\n=== GUESS rows (synthesised domain — risk surface), ranked by offers ===`);
  console.log(`offers\tcc\tstore_id\tstore_name\t->guess`);
  for (const g of guesses) console.log(`${g.n}\t${g.cc}\t${g.id}\t${g.name}\t${g.url}`);

  console.log(`\n=== NONE rows (no merchant signal -> Havlo /compare), ranked by offers ===`);
  console.log(`offers\tstore_id\tstore_name`);
  for (const x of none) console.log(`${x.n}\t${x.id}\t${x.name}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
