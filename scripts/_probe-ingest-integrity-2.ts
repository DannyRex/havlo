/* Phase 3 deep-probe — second round.

   First-round probe found the surface debt (NULL country, stale offers,
   orphans). This round digs deeper into less-obvious quality issues:

     1. Image URL coverage — % products with no image, % with broken
        non-HTTP image URLs
     2. Price sanity — implausibly small prices (< 0.01), absurdly
        large prices (> 1e9), discount_percent > 100 (impossible)
     3. Currency vs is_international consistency — USD offers with
        is_international=false, NGN offers with is_international=true
     4. Currency vs store_country consistency at the OFFER level
        (the earlier probe only looked at NGN — now we look at all)
     5. Duplicate offers per (product_id, store_id) — offers table's
        unique constraint is (store_id, url), so the same product
        could legitimately have N offers per store if the store
        lists it on N URLs (legitimate). But the median should be 1.
     6. Product title sanity — empty, too-short, all-caps, suspicious
        characters (HTML, encoded entities)
     7. Brand+model parse coverage — what % of products have non-null
        brand and model? Lower is bad for the variant-gate logic.
     8. Provider mix per store — should be 1 provider per store
        typically. Multi-provider stores indicate ingest contention.
     9. last_seen_at distribution — how fresh is the catalog?
    10. Same-URL re-tagging — does a single URL appear with multiple
        product_ids? If so, the URL dedup isn't working. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function fetchPaged<T>(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const q = filters(supa.from(table).select(select)).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) { console.warn(error.message); break; }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function count(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<number> {
  const { count: n, error } = await filters(supa.from(table).select("*", { count: "exact", head: true }));
  if (error) return -1;
  return n ?? 0;
}

function pad(n: number | string, w = 7) { return String(n).padStart(w); }
function pct(n: number, total: number) { return total > 0 ? `${(n / total * 100).toFixed(1)}%` : "—"; }

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  /* 1. Image coverage ────────────────────────────────────────────── */
  console.log("── 1. Image URL coverage ─────────────────────────");
  const totalProducts = await count(supa, "products", (q) => q);
  const noImage = await count(supa, "products", (q) => q.is("image_url", null));
  const emptyImage = await count(supa, "products", (q) => q.eq("image_url", ""));
  console.log(`  total products:          ${pad(totalProducts)}`);
  console.log(`  image_url IS NULL:       ${pad(noImage)}  (${pct(noImage, totalProducts)})`);
  console.log(`  image_url = '':          ${pad(emptyImage)}  (${pct(emptyImage, totalProducts)})`);
  /* Non-HTTP image URLs (file://, data:, javascript:, etc.) */
  const httpsImage = await count(supa, "products", (q) => q.like("image_url", "https:%"));
  const httpImage  = await count(supa, "products", (q) => q.like("image_url", "http:%"));
  const otherProto = totalProducts - noImage - emptyImage - httpsImage - httpImage;
  console.log(`  https://: ${pad(httpsImage)}   http://: ${pad(httpImage)}   other-proto: ${pad(otherProto)}`);

  /* 2. Price sanity ────────────────────────────────────────────── */
  console.log("\n── 2. Price sanity ──────────────────────────────");
  const tooSmall = await count(supa, "offers", (q) => q.eq("in_stock", true).lt("current_price", 0.01));
  const tooLarge = await count(supa, "offers", (q) => q.eq("in_stock", true).gt("current_price", 1e9));
  const negativeDiscount = await count(supa, "offers", (q) => q.lt("discount_percent", 0));
  const overHundred = await count(supa, "offers", (q) => q.gt("discount_percent", 100));
  const exactly100 = await count(supa, "offers", (q) => q.eq("discount_percent", 100));
  console.log(`  in_stock offers price < 0.01:    ${tooSmall}`);
  console.log(`  in_stock offers price > 1e9:     ${tooLarge}`);
  console.log(`  discount_percent < 0:            ${negativeDiscount}`);
  console.log(`  discount_percent > 100:          ${overHundred}`);
  console.log(`  discount_percent = 100 (free?):  ${exactly100}`);

  /* 3. Currency vs is_international ────────────────────────────── */
  console.log("\n── 3. Currency vs is_international ──────────────");
  /* Currency is on the OFFER. is_international is on the OFFER too
     (via the view's join from stores). Spec: USD ↔ is_international=true,
     NGN ↔ is_international=false. Anything else is a mistake. */
  /* product_best_offers is a view; mismatch checks should run against
     the underlying offers + stores join. Use offers + stores fetch
     and bucket in JS. */
  const offers = await fetchPaged<{ store_id: string; currency: string }>(
    supa, "offers", "store_id, currency", (q) => q.eq("in_stock", true),
  );
  const stores = await fetchPaged<{ id: string; is_international: boolean }>(
    supa, "stores", "id, is_international", (q) => q,
  );
  const storeIntl = new Map(stores.map((s) => [s.id, s.is_international] as const));
  let usdLocal = 0, ngnIntl = 0, unknownStore = 0;
  for (const o of offers) {
    const intl = storeIntl.get(o.store_id);
    if (intl === undefined) { unknownStore++; continue; }
    if (o.currency === "USD" && intl === false) usdLocal++;
    if (o.currency === "NGN" && intl === true)  ngnIntl++;
  }
  console.log(`  USD offer on non-intl store:     ${usdLocal}`);
  console.log(`  NGN offer on intl store:         ${ngnIntl}`);
  console.log(`  offer pointing at missing store: ${unknownStore}`);

  /* 4. Offer currency vs store country ─────────────────────────── */
  console.log("\n── 4. Offer currency vs store country ───────────");
  const storesFull = await fetchPaged<{ id: string; country: string | null }>(
    supa, "stores", "id, country", (q) => q,
  );
  const storeCountry = new Map(storesFull.map((s) => [s.id, s.country] as const));
  /* Expectation: NGN offers ⇒ store.country = NG.
                  GBP-tagged offers (if any) ⇒ store.country = UK, etc.
     But the catalog only stores NGN/USD. We've already checked NGN→NG.
     Here we look at USD offers on country-tagged stores: that's normal
     (SerpAPI normalises everything to USD) but should be tracked. */
  let usdOnTagged: Record<string, number> = {};
  for (const o of offers) {
    if (o.currency !== "USD") continue;
    const cc = storeCountry.get(o.store_id);
    if (cc) usdOnTagged[cc] = (usdOnTagged[cc] ?? 0) + 1;
  }
  const sorted = Object.entries(usdOnTagged).sort((a, b) => b[1] - a[1]);
  console.log(`  USD offers per country-tagged store (SerpAPI norm to USD is normal):`);
  for (const [cc, n] of sorted) console.log(`    ${cc.padEnd(4)} ${pad(n)}`);

  /* 5. Offers per (product, store) ─────────────────────────────── */
  console.log("\n── 5. Offers per (product_id, store_id) pair ────");
  const offersFull = await fetchPaged<{ product_id: string; store_id: string }>(
    supa, "offers", "product_id, store_id", (q) => q,
  );
  const psCount = new Map<string, number>();
  for (const o of offersFull) {
    const k = `${o.product_id}|${o.store_id}`;
    psCount.set(k, (psCount.get(k) ?? 0) + 1);
  }
  const distribution = new Map<number, number>();
  for (const n of psCount.values()) distribution.set(n, (distribution.get(n) ?? 0) + 1);
  /* Sort by count ascending */
  const distSorted = Array.from(distribution.entries()).sort((a, b) => a[0] - b[0]);
  console.log(`  distribution of offer count per (product, store):`);
  for (const [count, freq] of distSorted) {
    console.log(`    ${count} offers × ${pad(freq)} pairs`);
  }
  const overOne = Array.from(psCount.values()).filter((n) => n > 1).length;
  console.log(`  pairs with > 1 offer:  ${overOne}`);

  /* 6. Title sanity ────────────────────────────────────────────── */
  console.log("\n── 6. Title sanity ──────────────────────────────");
  const titles = await fetchPaged<{ id: string; title: string }>(
    supa, "products", "id, title", (q) => q,
  );
  let shortTitle = 0, htmlTitle = 0, entityTitle = 0, allCaps = 0;
  for (const t of titles) {
    if (!t.title || t.title.length < 8) shortTitle++;
    if (/<[a-z][^>]*>/i.test(t.title))  htmlTitle++;
    if (/&[a-z]+;|&#\d+;/i.test(t.title)) entityTitle++;
    /* All-caps title with at least 10 chars and 80%+ uppercase letters */
    const letters = t.title.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 10 && letters.length / Math.max(1, t.title.length) > 0.3) {
      const upper = (t.title.match(/[A-Z]/g) ?? []).length;
      if (upper / letters.length > 0.8) allCaps++;
    }
  }
  console.log(`  too short (< 8 chars):           ${shortTitle}`);
  console.log(`  contains HTML tags:              ${htmlTitle}`);
  console.log(`  contains HTML entities (&amp;):  ${entityTitle}`);
  console.log(`  all-caps titles (>80%):          ${allCaps}`);

  /* 7. Brand+model parse coverage ──────────────────────────────── */
  console.log("\n── 7. Brand+model parse coverage ────────────────");
  const noBrand = await count(supa, "products", (q) => q.is("brand", null));
  const noModel = await count(supa, "products", (q) => q.is("model", null));
  const noBoth  = await count(supa, "products", (q) => q.is("brand", null).is("model", null));
  console.log(`  brand IS NULL:           ${pad(noBrand)}  (${pct(noBrand, totalProducts)})`);
  console.log(`  model IS NULL:           ${pad(noModel)}  (${pct(noModel, totalProducts)})`);
  console.log(`  BOTH brand+model NULL:   ${pad(noBoth)}  (${pct(noBoth, totalProducts)})`);

  /* 8. Provider mix per store ──────────────────────────────────── */
  console.log("\n── 8. Provider mix per store ────────────────────");
  const offersProv = await fetchPaged<{ store_id: string; source_provider: string | null }>(
    supa, "offers", "store_id, source_provider", (q) => q.eq("in_stock", true),
  );
  const provPerStore = new Map<string, Set<string>>();
  for (const o of offersProv) {
    if (!o.source_provider) continue;
    let set = provPerStore.get(o.store_id);
    if (!set) { set = new Set(); provPerStore.set(o.store_id, set); }
    set.add(o.source_provider);
  }
  const multiProv = Array.from(provPerStore.entries()).filter(([, s]) => s.size > 1);
  console.log(`  stores written-to by > 1 provider: ${multiProv.length}`);
  for (const [sid, set] of multiProv.slice(0, 8)) {
    console.log(`    ${sid.padEnd(25)} ${Array.from(set).join(", ")}`);
  }

  /* 9. Freshness distribution ─────────────────────────────────── */
  console.log("\n── 9. Freshness distribution (in_stock=true) ────");
  const buckets = [1, 3, 7, 14, 30, 90, 180];
  for (const days of buckets) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    const n = await count(supa, "offers", (q) => q.eq("in_stock", true).gte("last_seen_at", cutoff));
    console.log(`  last_seen_at within ${days}d:   ${pad(n)}`);
  }

  /* 10. Same URL on different products ────────────────────────── */
  console.log("\n── 10. Same URL on different product_ids ───────");
  const allOffers = await fetchPaged<{ url: string; product_id: string }>(
    supa, "offers", "url, product_id", (q) => q,
  );
  const urlMap = new Map<string, Set<string>>();
  for (const o of allOffers) {
    if (!o.url) continue;
    let s = urlMap.get(o.url);
    if (!s) { s = new Set(); urlMap.set(o.url, s); }
    s.add(o.product_id);
  }
  const splitUrls: Array<[string, number]> = [];
  urlMap.forEach((set, url) => { if (set.size > 1) splitUrls.push([url, set.size]); });
  console.log(`  URLs pointing at > 1 product_id: ${splitUrls.length}`);
  splitUrls.sort((a, b) => b[1] - a[1]);
  for (const [u, n] of splitUrls.slice(0, 5)) {
    console.log(`    ${u.slice(0, 80)}…  → ${n} products`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
