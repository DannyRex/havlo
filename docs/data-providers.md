# Data providers

Havlo reads deals through a **provider abstraction** so we can swap data sources (scraped CSV → SerpAPI live → Konga affiliate feed → Amazon PAAPI) without touching API routes or UI components.

## Architecture

```
┌──────────────────────┐
│  /api/deals          │──┐
│  /api/live-search    │  │
└──────────────────────┘  │
                          ▼
              ┌────────────────────────┐
              │  src/lib/providers     │
              │  ───────────────────   │
              │  index.ts (registry)   │
              │  types.ts (contracts)  │
              └────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     BrowseProvider  SearchProvider  …more later
            │             │
   ┌────────┴────┐   ┌────┴────────┐
   │ static-     │   │ serpapi-    │
   │ scraped     │   │ shopping    │
   │ (always on) │   │ (env-keyed) │
   └─────────────┘   └─────────────┘
```

## Two provider types

### `BrowseProvider`
Backs the `/deals` feed — paginated browsing of pre-fetched product data.
- `fetchDeals(query)` returns filtered + sorted `Deal[]`
- `getOriginCounts(query)` returns `{all, local, intl}` counts for the toggle
- Static today (wraps `src/lib/data/deals.ts`); will be DB-backed once we wire ingestion crons

### `SearchProvider`
Backs `/api/live-search` — hits external shopping APIs with the user's free-text query.
- `searchDeals({q, countryCode, limit})` returns canonical `Deal[]`
- Multiple providers run in parallel; results are URL-deduped at the route layer
- Currently: SerpAPI Google Shopping (active when `SERPAPI_KEY` is set)

## Wiring SerpAPI Google Shopping

1. Get an API key at [serpapi.com](https://serpapi.com/) (free tier: 100 searches/month, paid: $50/mo for 5k).
2. Add to `.env.local`:
   ```
   SERPAPI_KEY=your_key_here
   ```
3. Restart `npm run dev`. The provider self-activates via `process.env.SERPAPI_KEY?.trim()`.
4. Test: `curl "http://localhost:3000/api/live-search?q=iphone+15+pro&country=ng"`

The provider:
- Calls `https://serpapi.com/search.json?engine=google_shopping&gl=ng&hl=en&q=...`
- Maps `shopping_results[]` → canonical `Deal[]`
- Caches via Next.js fetch revalidation (10-min TTL) — so repeated queries don't burn credits
- Currency inferred from `countryCode` (NG → NGN, else USD)

## Adding a new provider

1. Implement `BrowseProvider` or `SearchProvider` from `src/lib/providers/types.ts`.
2. Make `isActive()` env-driven so users can toggle without code changes:
   ```ts
   isActive() { return Boolean(process.env.MY_API_KEY?.trim()); }
   ```
3. Register in `src/lib/providers/index.ts`:
   ```ts
   import { myNewProvider } from "./my-new-provider";
   const SEARCH_PROVIDERS: SearchProvider[] = [
     serpapiSearchProvider,
     myNewProvider,  // ← add here
   ];
   ```
4. Throw `ProviderError` for known failures (network, auth, rate limit). Caller catches per-provider so one failure doesn't break the whole request.

## Persistence layer (Phase 5b shipped)

Live data has a home: `products`, `offers`, `stores`, `ingestion_runs` tables in Supabase, plus a helper view `product_best_offers` that joins them.

```
provider.searchDeals()  ─→  ingestDeals()  ─→  upsert into products + offers
                                                          │
                                                          ▼
                                              dbBrowseProvider reads
                                              from product_best_offers
                                                          │
                                                          ▼
                                                /api/deals serves DB rows
```

**Setup**:
1. Run the migration in Supabase SQL editor:
   ```sh
   psql $SUPABASE_DB_URL -f scripts/db/0001-products-offers-schema.sql
   # or paste the file into the Supabase SQL editor
   ```
2. Confirm tables exist: `stores`, `products`, `offers`, `ingestion_runs`, plus the `product_best_offers` view.
3. The `dbBrowseProvider` self-activates on the next request once products exist (cached 5 min per process).

**Provider selection priority** (see `src/lib/providers/index.ts`):
1. `db-products` — when Supabase is configured AND products table has rows
2. `static-scraped` — always-available baseline fallback

So your data path goes: cron populates DB → DB has rows → `getActiveBrowseProvider()` returns `dbBrowseProvider` → `/api/deals` serves live rows. Until cron runs, static data continues serving traffic. Zero downtime.

## Cron-runnable ingestion (Phase 5c shipped)

```sh
npm run ingest                                 # all categories, all active SearchProviders
npm run ingest -- --category=phones,laptops    # subset of categories
npm run ingest -- --provider=serpapi-shopping  # specific provider only
npm run ingest -- --country=ng --limit=24      # tune locale + per-category cap

npm run ingest:serpapi                         # convenience alias for SerpAPI-only
```

The script:
- Loads `.env.local` via Node 20.6+ built-in (no dotenv dep)
- Iterates active SearchProviders × target categories
- For each (provider, category) pair: calls `searchDeals()` → `ingestDeals()` → records results
- Prints per-row status with totals at the end
- Records each run in `ingestion_runs` for observability

**Schedule it** as a daily cron — examples:

```cron
# crontab — pulls fresh deals every 6 hours
0 */6 * * * cd /app && npm run ingest >> ingest.log 2>&1
```

```yaml
# Vercel Cron (vercel.json)
{
  "crons": [
    { "path": "/api/cron/ingest", "schedule": "0 */6 * * *" }
  ]
}
```

```yaml
# GitHub Actions (.github/workflows/ingest.yml)
on:
  schedule: [{ cron: "0 */6 * * *" }]
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run ingest
        env:
          SUPABASE_URL:               ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY:  ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SERPAPI_KEY:                ${{ secrets.SERPAPI_KEY }}
```

## PostgreSQL Full-Text Search (Phase 6)

Replaces the brand-list-driven heuristic search engine. **No more hardcoded `BRANDS`, `PRODUCT_TYPES`, or `CATEGORY_KEYWORDS`** — the data drives relevance.

**Setup**:
1. Apply the migration in Supabase SQL Editor:
   ```sh
   # paste scripts/db/0002-fts-search.sql into the editor and run
   ```
2. Verify the function exists:
   ```sql
   SELECT title, rank FROM search_products_fts('rayban', 5);
   SELECT title, rank FROM search_products_fts('iphone 15 pro max', 5);
   SELECT title, rank FROM search_products_fts('noise cancelling', 5);
   ```
3. The `pgFtsSearchProvider` in `src/lib/providers/search-pgfts.ts` self-activates — it's already registered in the `SEARCH_PROVIDERS` array.

**What this gives you for free** (no code changes per query):
- Stemming: `headphones` matches `headphone`
- Stop words filtered automatically
- `websearch_to_tsquery` parses natural-language queries (handles quotes, AND/OR/NOT)
- `ts_rank` ordering by relevance
- Trigram similarity (`pg_trgm`) for typo tolerance: `rayban` ~ `ray-ban`, `airpod` ~ `airpods`

**Test the merged search** (pg-fts + SerpAPI in parallel):
```sh
curl "http://localhost:3000/api/live-search?q=rayban&limit=12" | jq '.providers, .items[].title'
```
You should see `["pg-fts", "serpapi-shopping"]` in providers and items from both sources.

## Roadmap

| Source | Status | Notes |
|--------|--------|-------|
| Static scraped data | ✅ Baseline fallback | `src/lib/data/deals.ts`, used until DB is populated |
| SerpAPI Google Shopping | ✅ Live (set `SERPAPI_KEY`) | `~$15/1k searches` at Developer tier |
| DB-backed BrowseProvider | ✅ Auto-activates when DB has rows | Run migration + `npm run ingest` |
| **Postgres FTS search** | ✅ **Apply 0002 to activate** | Free, self-updating with the corpus |
| Amazon PAAPI v5 | 📋 Free with Associates approval | ~262k req/day baseline; covers global Amazon |
| AliExpress affiliate API | 📋 Free with affiliate approval | Cross-border / global products |
| Konga affiliate | 📋 Apply at konga.com/affiliates | NG-specific; was active per latest check |
| AWIN / CJ / ShareASale | 📋 Free with merchant approval | CSV product feeds |
| ScraperAPI / SearchAPI.io | 📋 Cheaper SERP fallback | If outgrowing SerpAPI free tier |
| Apify Google Shopping | 📋 Pay-per-result | Best for cron-batch with bursty volume |

## Next steps

- **Phase 5d**: Wire `/api/live-search` results into the `/compare` UI as a "Live offers from Google Shopping" section alongside the existing dupe grid.
- **Phase 5e**: Add Amazon PAAPI provider once Associates approval lands.
- **Phase 5f**: Add a server-rendered SearchProvider for `/api/compare` that augments the existing vector results with live SERP data.
