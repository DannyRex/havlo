#!/usr/bin/env tsx
/* ─────────────────────────────────────────────────────────────────
   Trending-SKU ingest — runs SerpAPI Google Shopping for a curated
   list of specific, high-volume product names so the catalog has
   genuine multi-store comparison density on items users actually
   want to buy.

   The standard cron (scripts/ingest-providers.ts) runs CATEGORY-LEVEL
   queries ("phones", "laptops", "running shoes"). Those surface a
   broad mix but mostly single-store + long-tail rows. Comparison
   shines when the SAME product surfaces at MULTIPLE retailers —
   that requires querying for SPECIFIC products, which is what this
   does.

   The seed list below is split per country: each market gets ~30-50
   products that are realistically buyable in that market. The
   product NAMES are normalized chip-form ("Apple iPhone 15 Pro",
   "Stanley Quencher 40oz") so SerpAPI's matcher returns clean SERPs
   instead of fragmented sub-variants.

   Cost: ~30-50 queries × N countries (default: just the country you
   pass) × 1 SerpAPI credit each. Default run (all 6 countries × ~40
   seeds = ~240 credits) costs ~$1-2. Expected: +1000-2000 cross-
   store products with high comparison density (most popular SKUs
   show up at 4-10 retailers via Google Shopping).

   Usage:
     npx tsx scripts/ingest-trending-skus.ts                   # all countries
     npx tsx scripts/ingest-trending-skus.ts --country=ng      # just NG
     npx tsx scripts/ingest-trending-skus.ts --limit=10 --dry-run
*/

try { process.loadEnvFile?.(".env.local"); } catch {}
import { getActiveSearchProviders } from "../src/lib/providers";
import { ingestDeals } from "../src/lib/providers/ingestion";

const argv = process.argv.slice(2);
const arg  = (n: string): string | null => {
  const f = argv.find((a) => a.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : null;
};

const ONLY_COUNTRY = arg("country");
const LIMIT_PER_COUNTRY = arg("limit") ? Number(arg("limit")) : null;
const DRY_RUN = argv.includes("--dry-run");

/* ── Curated trending SKUs per market ─────────────────────────────
   Each entry spans the full category breadth so we don't ingest
   "all electronics" or "all fashion" — we ingest the SKUs that
   genuinely move and have cross-store presence.

   Selection criteria for each entry:
     - Specific product name (not a category)
     - Confirmed to have ≥ 3 stores carrying it in that market
     - Recognizable across multiple price tiers (Apple iPhone 15,
       Stanley Quencher, Nike Air Max — high SERP density)
     - Mix of evergreen (AirPods, Sambas) + current generation
       (iPhone 17, MacBook M5) so the comparison density is fresh

   Maintain by reviewing the search_query_log popular_searches RPC
   monthly + adjusting based on what Google Trends says is rising. */
const TRENDING_BY_COUNTRY: Record<string, string[]> = {
  ng: [
    /* Electronics — phones, laptops, audio */
    "iPhone 15 Pro 256GB", "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra",
    "Samsung Galaxy A55 5G", "Tecno Camon 30", "Infinix Hot 50 Pro",
    "MacBook Air M3 256GB", "MacBook Pro M4 14 inch", "Dell XPS 13",
    "AirPods Pro 2", "AirPods 4", "Sony WH-1000XM5", "JBL Flip 6",
    /* Fashion */
    "Nike Air Force 1", "Adidas Samba", "Nike Dunk Low", "New Balance 530",
    "Levi's 501 Original",
    /* Beauty — Essenza/luxury fragrance is huge in NG */
    "AFNAN 9 PM", "Carolina Herrera Good Girl", "Versace Eros",
    "Lancome La Vie Est Belle", "Dior Sauvage", "Tom Ford Tobacco Vanille",
    /* Home / appliances */
    "Dyson V12 Detect Slim", "Stanley Quencher 40oz", "Ninja Air Fryer",
    "Nespresso Vertuo", "iRobot Roomba",
    /* Health (pharmacy chain catalog is strong) */
    "Accu-Chek Active glucose meter", "Centrum Adults Multivitamin",
    "Cetaphil Daily Facial Cleanser", "CeraVe Moisturizing Cream",
    /* Gaming */
    "PlayStation 5 Slim", "Xbox Series X 1TB", "Nintendo Switch OLED",
    /* Sports */
    "Garmin Forerunner 265", "Apple Watch Ultra 2",
  ],
  uk: [
    "iPhone 16 Pro", "Samsung Galaxy S24", "Google Pixel 9 Pro",
    "MacBook Pro M4 14 inch", "iPad Pro M4",
    "AirPods Pro 2", "Sony WH-1000XM5", "Bose QuietComfort Ultra",
    "Nintendo Switch 2", "PlayStation 5 Pro",
    "Nike Air Max 95", "Adidas Samba OG", "New Balance 530",
    "Charlotte Tilbury Pillow Talk", "Sol de Janeiro Brazilian Bum Bum",
    "Drunk Elephant Protini", "Olaplex No.3", "MAC Ruby Woo",
    "Dyson Airwrap Complete", "Dyson V15 Detect", "Le Creuset Dutch Oven",
    "Ninja Foodi", "Smeg toaster", "Nespresso Vertuo Plus",
    "Apple Watch Ultra 2", "Garmin Fenix 7",
    "Lululemon Align leggings",
  ],
  us: [
    "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra", "Google Pixel 9 Pro",
    "MacBook Pro M4", "MacBook Air M3", "iPad Air M2",
    "AirPods Pro 2", "Sony WH-1000XM5", "Bose QuietComfort Ultra",
    "Nintendo Switch 2", "PlayStation 5 Pro", "Steam Deck OLED",
    "Stanley Quencher 40oz", "Yeti Rambler 30oz", "Owala FreeSip 24oz",
    "Hydro Flask 32oz", "Stojo collapsible cup",
    "Nike Air Force 1", "Nike Dunk Low", "Adidas Samba OG", "New Balance 990v6",
    "Dyson Airwrap Complete", "Dyson V12 Detect Slim",
    "Le Creuset Dutch Oven", "Lodge Cast Iron Skillet",
    "Olaplex No.3", "Drunk Elephant Protini", "Tatcha Dewy Skin Cream",
    "Apple Watch Ultra 2", "Garmin Forerunner 265",
    "Lululemon Define Jacket",
  ],
  de: [
    "iPhone 16 Pro", "Samsung Galaxy S24 Ultra", "Google Pixel 9",
    "MacBook Pro M4", "iPad Pro M4",
    "AirPods Pro 2", "Bose QuietComfort Ultra", "Sennheiser Momentum 4",
    "Nintendo Switch 2", "PlayStation 5",
    "Adidas Samba OG", "Adidas Stan Smith", "New Balance 574",
    "Birkenstock Boston", "Le Creuset",
    "Dyson V12", "Vorwerk Thermomix TM6", "Smeg toaster",
    "Apple Watch Series 10", "Garmin Fenix 7",
    "Charlotte Tilbury", "Estee Lauder Advanced Night Repair",
  ],
  in: [
    "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra", "OnePlus 13",
    "OnePlus Nord 4", "Samsung Galaxy M55",
    "MacBook Air M3", "Dell XPS 13",
    "boAt Airdopes 161", "boAt Rockerz 450", "OnePlus Buds 3", "JBL Flip 6",
    "Nintendo Switch", "PlayStation 5",
    "Nike Air Max 90", "Adidas Samba", "Puma Suede",
    "Lakme 9 to 5 foundation", "Maybelline Fit Me", "Mamaearth Vitamin C serum",
    "Forest Essentials Soundarya", "The Ordinary Niacinamide",
    "Dyson V8 Absolute", "Philips Air Fryer", "Prestige Iris Mixer",
    "Apple Watch SE", "Noise ColorFit Pulse Grand 2",
  ],
  ae: [
    "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra",
    "MacBook Pro M4", "iPad Pro M4",
    "AirPods Pro 2", "Sony WH-1000XM5", "Bose QuietComfort Ultra",
    "Nintendo Switch 2", "PlayStation 5",
    "Nike Air Max 95", "Adidas Samba OG", "Yeezy Slide",
    "AFNAN Supremacy Silver", "Lattafa Khamrah", "Armaf Club de Nuit Intense",
    "Tom Ford Black Orchid", "Creed Aventus", "Maison Francis Kurkdjian Baccarat",
    "Dyson Airwrap", "Dyson V15 Detect", "Le Creuset",
    "Apple Watch Ultra 2", "Garmin Fenix 7",
  ],
  za: [
    "iPhone 16 Pro", "Samsung Galaxy S24", "Huawei P60 Pro",
    "MacBook Air M3", "iPad Air M2",
    "AirPods Pro 2", "Sony WH-1000XM5", "JBL Flip 6",
    "Nintendo Switch", "PlayStation 5",
    "Nike Air Max 90", "Adidas Samba", "New Balance 574",
    "Yeti Rambler 30oz", "Le Creuset Dutch Oven",
    "Dyson V12", "Nespresso Vertuo",
    "Garmin Forerunner 165", "Apple Watch SE",
    "Charlotte Tilbury", "Olaplex No.3",
  ],
};

async function main() {
  const providers = await getActiveSearchProviders();
  const serpapi = providers.find((p) => p.id === "serpapi-shopping");
  if (!serpapi) {
    console.error("serpapi-shopping provider not active. Check SERPAPI_KEY.");
    process.exit(1);
  }

  const countries = ONLY_COUNTRY
    ? (TRENDING_BY_COUNTRY[ONLY_COUNTRY] ? [ONLY_COUNTRY] : [])
    : Object.keys(TRENDING_BY_COUNTRY);
  if (countries.length === 0) {
    console.error(`No trending list for country=${ONLY_COUNTRY}`);
    process.exit(1);
  }

  const totalQueries = countries.reduce((s, c) => s + (LIMIT_PER_COUNTRY ?? TRENDING_BY_COUNTRY[c].length), 0);
  console.log(`Trending-SKU ingest — countries=${countries.join(",")}, ~${totalQueries} queries`);
  console.log(`Cost estimate: ~$${(totalQueries * 0.005).toFixed(2)} (1 SerpAPI credit per query)`);
  if (DRY_RUN) {
    console.log("\nDry-run: not invoking SerpAPI.");
    for (const c of countries) {
      const list = TRENDING_BY_COUNTRY[c].slice(0, LIMIT_PER_COUNTRY ?? undefined);
      console.log(`\n  [${c}] ${list.length} queries:`);
      for (const q of list) console.log(`    "${q}"`);
    }
    return;
  }

  const startMs = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (const country of countries) {
    const seeds = TRENDING_BY_COUNTRY[country].slice(0, LIMIT_PER_COUNTRY ?? undefined);
    console.log(`\n── [${country}] ${seeds.length} queries ──`);
    for (let i = 0; i < seeds.length; i++) {
      const q = seeds[i];
      const sourceQuery = `trending-sku:${country}:${q}`;
      try {
        const deals = await serpapi.searchDeals({
          q,
          countryCode: country,
          limit:       20,
          mode:        "market",
        });
        const r = await ingestDeals(deals, serpapi.id, sourceQuery);
        totalFetched  += r.fetched;
        totalUpserted += r.upserted;
        totalErrors   += r.errors.length;
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        console.log(`  ${i + 1}/${seeds.length} [${country}] "${q.slice(0, 38).padEnd(38)}" → fetched=${r.fetched} upserted=${r.upserted} (${elapsed}s)`);
      } catch (err) {
        console.warn(`  ${i + 1}/${seeds.length} [${country}] FAIL: ${(err as Error).message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════════════════`);
  console.log(`Done in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
  console.log(`  Total fetched:  ${totalFetched}`);
  console.log(`  Total upserted: ${totalUpserted}`);
  console.log(`  Total errors:   ${totalErrors}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
