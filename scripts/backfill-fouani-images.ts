#!/usr/bin/env tsx
/* One-off backfill: the first Fouani ingest stored image.origin
   ("image.webp?_dc=...") instead of the absolute CDN URL
   (base_url + "/" + webp_image), so Fouani products show no image.
   Re-fetch each Fouani product page, rebuild the correct URL, and update
   products.image_url where it is currently missing or non-absolute.
   The self-host cron will mirror these to Supabase Storage on its next run;
   meanwhile the DO Spaces CDN URL loads directly. */
try { (process as any).loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";

const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UA = "Mozilla/5.0 (compatible; HavloBot/1.0; +https://havlo.io)";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20_000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function imageUrlFromHtml(html: string): string | undefined {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(\{.+?\})<\/script>/s);
  if (!m) return undefined;
  try {
    const nd = JSON.parse(m[1]);
    const img = nd?.props?.pageProps?.data?.data?.image;
    if (!img) return undefined;
    const file = img.webp_image || img.origin || img.webp_thumbnail || img.thumbnail;
    if (!file) return undefined;
    if (/^https?:\/\//i.test(file)) return file;
    if (!img.base_url) return undefined;
    return `${String(img.base_url).replace(/\/+$/, "")}/${String(file).replace(/^\/+/, "")}`;
  } catch { return undefined; }
}

async function mapLimit<T, U>(items: T[], limit: number, fn: (x: T) => Promise<U>): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (true) { const idx = i++; if (idx >= items.length) return; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

async function main() {
  // distinct Fouani product_id -> a product page url
  const { data: offers, error } = await supa
    .from("offers").select("product_id, url").eq("store_id", "fouani").eq("in_stock", true);
  if (error) throw error;
  const byProd = new Map<string, string>();
  for (const o of offers ?? []) if (!byProd.has(o.product_id)) byProd.set(o.product_id, o.url);
  const entries = [...byProd.entries()];
  console.log(`Fouani products to check: ${entries.length}`);

  // current image_url per product
  const ids = entries.map(([pid]) => pid);
  const current = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supa.from("products").select("id, image_url").in("id", ids.slice(i, i + 200));
    for (const p of data ?? []) current.set(p.id, p.image_url);
  }

  let fixed = 0, alreadyOk = 0, noImage = 0, failed = 0;
  await mapLimit(entries, 6, async ([pid, url]) => {
    const cur = current.get(pid) ?? null;
    if (cur && /^https?:\/\//i.test(cur)) { alreadyOk++; return; } // already absolute (hosted or good)
    const html = await fetchHtml(url);
    if (!html) { failed++; return; }
    const img = imageUrlFromHtml(html);
    if (!img) { noImage++; return; }
    const { error: upErr } = await supa.from("products").update({ image_url: img }).eq("id", pid);
    if (upErr) { failed++; console.warn(`  ✗ ${pid}: ${upErr.message}`); return; }
    fixed++;
  });

  console.log(`\nfixed (image_url set to CDN url): ${fixed}`);
  console.log(`already absolute (skipped):       ${alreadyOk}`);
  console.log(`no image on page:                 ${noImage}`);
  console.log(`fetch/update failed:              ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
