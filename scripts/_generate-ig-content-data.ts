#!/usr/bin/env tsx
/* Generate real-data Instagram comparison content.

   Queries the production catalog for products that have a meaningful
   cross-store price spread, downloads their product images locally,
   and writes a JSON manifest the Python renderer reads.

   Selection criteria:
     · At least 2 distinct in-stock offers
     · Lowest and highest in-stock prices both > USD 20 equivalent
       (skip the trivial-savings posts that don't make a story)
     · Spread (max-min)/max >= 10%   (skip too-close-to-call rows)
     · Spread (max-min) absolute > 1500 NGN (~ $1 USD min absolute)
     · products.image_url is set and HTTPS
     · products.brand is non-null (we want recognizable brands —
       Apple / Sony / Samsung / Nike etc. — for shareability)

   Image download: per-merchant User-Agent so retailer CDNs don't
   403 the request. Saves originals to outputs/havlo-instagram/sources/.

   Output: outputs/havlo-instagram/real-data.json
   Use:    cd outputs/havlo-instagram && python3 render-real.py
*/

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const OUT_DIR     = resolve(__dirname, "..", "outputs", "havlo-instagram");
const SOURCES_DIR = resolve(OUT_DIR, "sources");
const MANIFEST    = resolve(OUT_DIR, "real-data.json");

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SOURCES_DIR, { recursive: true });

/* Fetch with browser-like UA — retailer CDNs (Currys, John Lewis,
   Amazon, etc.) sometimes 403 the default Node UA. */
function fetchImage(url: string, outPath: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Accept": "image/avif,image/webp,image/png,image/*,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": new URL(url).origin + "/",
      },
      timeout: 8000,
    }, (res) => {
      /* Follow one redirect (Cloudinary, image-CDN redirects). */
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return resolvePromise(fetchImage(res.headers.location, outPath));
      }
      if (res.statusCode !== 200) {
        console.warn(`  ! HTTP ${res.statusCode} for ${url.slice(0, 80)}`);
        return resolvePromise(false);
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) {
          console.warn(`  ! tiny response (${buf.length}b) for ${url.slice(0, 80)}`);
          return resolvePromise(false);
        }
        writeFileSync(outPath, buf);
        resolvePromise(true);
      });
      res.on("error", () => resolvePromise(false));
    });
    req.on("timeout", () => { req.destroy(); resolvePromise(false); });
    req.on("error", () => resolvePromise(false));
  });
}

/* Friendly display names per store — fallback to title-case of the
   store_id if not mapped. */
const STORE_DISPLAY: Record<string, string> = {
  "konga": "Konga",
  "jumia": "Jumia",
  "slot":  "Slot",
  "threechub": "3C Hub",
  "essenza": "Essenza",
  "kara": "Kara",
  "supermart": "Supermart",
  "healthplus": "HealthPlus",
  "medplus": "MedPlus",
  "ajebomarket": "Ajebomarket",
  "bitmarte": "Bitmarte",
  "obiwezy": "Obiwezy",
  "amazon": "Amazon",
  "amazon-uk": "Amazon UK",
  "amazon-de": "Amazon DE",
  "amazon-ae": "Amazon UAE",
  "amazon-in": "Amazon India",
  "amazon-co-uk": "Amazon UK",
  "argos": "Argos",
  "currys": "Currys",
  "john-lewis-partners": "John Lewis",
  "asos": "ASOS",
  "best-buy": "Best Buy",
  "walmart": "Walmart",
  "macy-s": "Macy's",
  "ebay": "eBay",
  "noon": "Noon",
  "flipkart": "Flipkart",
  "nykaa": "Nykaa",
  "takealot": "Takealot",
  "selfridges": "Selfridges",
  "boots": "Boots",
  "next": "Next",
  "matalan": "Matalan",
  "dunelm": "Dunelm",
  "qvc-uk": "QVC UK",
  "jd-sports": "JD Sports",
  "ali-express": "AliExpress",
  "aliexpress": "AliExpress",
  "shein": "SHEIN",
};
function storeDisplay(id: string): string {
  return STORE_DISPLAY[id] ?? id.split("-").map((s) => s[0]?.toUpperCase() + s.slice(1)).join(" ");
}

/* Country symbol per ISO-2. */
const COUNTRY_SYMBOL: Record<string, string> = {
  NG: "₦", UK: "£", US: "$", DE: "€", AE: "AED ", IN: "₹", ZA: "R",
};
const COUNTRY_FX: Record<string, number> = {
  NG: 1, UK: 0.000847, US: 0.000625, DE: 0.000575, AE: 0.00229, IN: 0.0521, ZA: 0.0114,
};
function formatPrice(amount: number, currency: "NGN" | "USD", country: string): string {
  /* Normalise to NGN then convert. Same math the app uses. */
  const ngn = currency === "NGN" ? amount : amount * 1500;
  const targetCurrency = country.toUpperCase();
  const fx = COUNTRY_FX[targetCurrency] ?? COUNTRY_FX.NG;
  const target = ngn * fx;
  const symbol = COUNTRY_SYMBOL[targetCurrency] ?? "";
  if (targetCurrency === "NG") {
    return `${symbol}${Math.round(target).toLocaleString()}`;
  }
  if (target >= 100) {
    return `${symbol}${Math.round(target).toLocaleString()}`;
  }
  return `${symbol}${target.toFixed(2)}`;
}

interface Candidate {
  product_id:  string;
  title:       string;
  brand:       string;
  category:    string | null;
  country:     string;
  image_url:   string;
  image_local: string;
  cheap:       { store_id: string; store_name: string; price: number; currency: "NGN" | "USD"; display: string };
  dear:        { store_id: string; store_name: string; price: number; currency: "NGN" | "USD"; display: string };
  saving_display: string;
  saving_pct:  number;
}

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
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supabase"); process.exit(1); }

  console.log("▶ Pulling cross-store comparison candidates from production...");

  /* Pull every in-stock offer with its country tag. */
  const offers = await fetchPaged<{
    product_id: string; store_id: string; store_country: string | null;
    current_price: number; currency: "NGN" | "USD"; is_international: boolean;
  }>(
    supa, "product_best_offers",
    "product_id, store_id, store_country, current_price, currency, is_international",
    (q) => q,
  );

  /* Pull products with brand + image. */
  const productList = await fetchPaged<{ id: string; title: string; brand: string | null; category_slug: string | null; image_url: string | null }>(
    supa, "products",
    "id, title, brand, category_slug, image_url",
    (q) => q.not("brand", "is", null).not("image_url", "is", null).ilike("image_url", "https:%"),
  );
  const productById = new Map(productList.map((p) => [p.id, p] as const));

  /* IMPORTANT: product_best_offers picks the CHEAPEST in-stock offer
     per product via LATERAL JOIN — so it returns ONE row per product.
     For cross-store comparison we need the actual offers table directly,
     joined for store_name. */
  const allOffers = await fetchPaged<{
    product_id: string; store_id: string; current_price: number; currency: "NGN" | "USD";
  }>(
    supa, "offers",
    "product_id, store_id, current_price, currency",
    (q) => q.eq("in_stock", true),
  );
  /* Pull store country/anchor info separately so we can decide which
     market each candidate belongs in. */
  const stores = await fetchPaged<{ id: string; name: string; country: string | null; is_international: boolean }>(
    supa, "stores", "id, name, country, is_international", (q) => q,
  );
  const storeById = new Map(stores.map((s) => [s.id, s] as const));
  void offers; // baseline kept for sanity

  /* Bucket offers by product. Each product gets [{store_id, price, currency}, ...]. */
  type OfferBucket = { store_id: string; current_price: number; currency: "NGN" | "USD" };
  const byProduct = new Map<string, OfferBucket[]>();
  for (const o of allOffers) {
    if (!byProduct.has(o.product_id)) byProduct.set(o.product_id, []);
    byProduct.get(o.product_id)!.push(o);
  }

  /* Score each product. We want: branded, has image, ≥2 stores,
     meaningful price spread, recognizable category. */
  const candidates: Array<{
    pid: string;
    spreadPct: number;
    spreadNgn: number;
    cheap: OfferBucket;
    dear: OfferBucket;
    product: { id: string; title: string; brand: string | null; category_slug: string | null; image_url: string | null };
    country: string;
  }> = [];

  for (const [pid, bucket] of byProduct.entries()) {
    if (bucket.length < 2) continue;
    const product = productById.get(pid);
    if (!product) continue;
    if (!product.image_url || !product.brand) continue;

    /* Normalize prices to NGN for comparison. */
    const priced = bucket.map((o) => ({
      ...o,
      ngn: o.currency === "NGN" ? o.current_price : o.current_price * 1500,
    })).filter((o) => o.ngn > 0);
    if (priced.length < 2) continue;

    priced.sort((a, b) => a.ngn - b.ngn);

    /* Pick cheapest + dearest from DISTINCT stores. Same-store rows
       are SKU variants of the same product (different storage tier,
       refurbished vs new) — not a comparison story.

       Also require both stores to be either anchored to the SAME
       country, or one of them to be a global cross-border merchant
       reachable from any market. Cross-country pairs (Jumia in NG
       vs Flipkart in IN) confuse the audience for either market. */
    let cheap = priced[0];
    let dear: typeof priced[0] | null = null;
    for (let i = priced.length - 1; i >= 0; i--) {
      if (priced[i].store_id !== cheap.store_id) { dear = priced[i]; break; }
    }
    if (!dear) continue;

    const cheapStore = storeById.get(cheap.store_id);
    const dearStore  = storeById.get(dear.store_id);
    if (!cheapStore || !dearStore) continue;

    /* Country compatibility: both must share the same anchor country
       OR one must be a global cross-border (is_international + no
       country anchor — AliExpress, SHEIN, etc.) that's reachable
       from any market. */
    const cheapCC = cheapStore.country;
    const dearCC  = dearStore.country;
    const cheapIsGlobal = cheapStore.is_international && !cheapStore.country;
    const dearIsGlobal  = dearStore.is_international && !dearStore.country;

    let country: string;
    if (cheapCC && dearCC && cheapCC === dearCC) {
      country = cheapCC;
    } else if (cheapCC && dearIsGlobal) {
      country = cheapCC;
    } else if (dearCC && cheapIsGlobal) {
      country = dearCC;
    } else if (cheapCC && !dearCC && !dearIsGlobal) {
      continue;  // dear store is country-anchored to a different market
    } else if (!cheapCC && dearCC) {
      continue;  // cheap store missing anchor; ambiguous
    } else {
      continue;  // not a clean cross-store-same-market comparison
    }

    const spreadNgn = dear.ngn - cheap.ngn;
    const spreadPct = spreadNgn / dear.ngn;

    /* Quality filters — tuned for Instagram credibility.
       Skip implausible 70-99% spreads (almost always different SKUs
       merged as one product) and skip trivial < 10% diffs that
       don't make a story. */
    if (cheap.ngn < 30000) continue;        // baseline ~$20 USD min
    if (spreadPct < 0.10)  continue;        // <10% isn't a story
    if (spreadPct > 0.45)  continue;        // >45% suggests SKU mismatch
    if (spreadNgn < 5000)  continue;        // absolute floor

    candidates.push({ pid, spreadPct, spreadNgn, cheap, dear, product, country });
  }

  /* Rank by absolute savings (more impressive numbers tell better
     stories) within a recognizable-brand floor. Then trim to top N
     per country. */
  candidates.sort((a, b) => b.spreadNgn - a.spreadNgn);

  /* Take top 2 per country for an even spread, max 8 total. */
  const perCountry: Record<string, typeof candidates> = {};
  const picked: typeof candidates = [];
  for (const c of candidates) {
    perCountry[c.country] ??= [];
    if (perCountry[c.country].length >= 2) continue;
    perCountry[c.country].push(c);
    picked.push(c);
    if (picked.length >= 8) break;
  }

  console.log(`Selected ${picked.length} candidates across ${Object.keys(perCountry).length} markets`);
  for (const c of picked) {
    console.log(`  ${c.country}  ${c.product.brand!.padEnd(10)}  spread=${c.spreadPct*100|0}%  ${c.spreadNgn|0} NGN  "${c.product.title.slice(0, 50)}"`);
  }

  /* Download images and build manifest. */
  const manifest: Candidate[] = [];
  for (let i = 0; i < picked.length; i++) {
    const c = picked[i];
    const ext = (c.product.image_url!.split(".").pop() || "jpg").split("?")[0].slice(0, 4);
    const outPath = resolve(SOURCES_DIR, `${i + 1}-${c.pid.slice(0, 8)}.${ext}`);
    if (!existsSync(outPath)) {
      const ok = await fetchImage(c.product.image_url!, outPath);
      if (!ok) {
        console.warn(`  ! skipping ${c.pid.slice(0, 8)} (image fetch failed)`);
        continue;
      }
    }
    const cheapName = storeDisplay(c.cheap.store_id);
    const dearName  = storeDisplay(c.dear.store_id);
    manifest.push({
      product_id:  c.pid,
      title:       c.product.title,
      brand:       c.product.brand!,
      category:    c.product.category_slug,
      country:     c.country,
      image_url:   c.product.image_url!,
      image_local: outPath,
      cheap: {
        store_id:   c.cheap.store_id,
        store_name: cheapName,
        price:      c.cheap.current_price,
        currency:   c.cheap.currency,
        display:    formatPrice(c.cheap.current_price, c.cheap.currency, c.country),
      },
      dear: {
        store_id:   c.dear.store_id,
        store_name: dearName,
        price:      c.dear.current_price,
        currency:   c.dear.currency,
        display:    formatPrice(c.dear.current_price, c.dear.currency, c.country),
      },
      saving_display: formatPrice(c.spreadNgn, "NGN", c.country),
      saving_pct:     Math.round(c.spreadPct * 100),
    });
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Wrote ${manifest.length} candidates to ${MANIFEST}`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
