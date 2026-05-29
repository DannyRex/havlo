# Havlo · B2B data product strategy

> "Are we gathering enough data to aggregate and sell market research reports to retailers and manufacturers?"

Short answer: **yes for 3 of 5 sellable report categories today, no for the most valuable two**. The blocking gaps are:
1. **PDP view events** — we know who CLICKS OUT, not who LOOKS. Without this, no funnel data, no "products with high interest but low click-through" report.
2. **Stockout transition log** — `offers.in_stock` flips silently. We can see the current state but not the time series.

Every day these are missing is a day of permanent data debt — you can't reconstruct historical view counts or in_stock transitions retroactively. **Open the tap now even if the B2B product is a year away.**

---

## What we collect today (data inventory)

| Table | Rows-ish | What it tells us |
|---|---:|---|
| `products` | 14,800 | brand, model, category, signature, GTIN/MPN/google_shopping_id when known |
| `offers` | 19,200 | current_price, original_price, discount_percent, currency, in_stock, scraped_at per store |
| `offer_price_history` | ~16,000 | every price CHANGE per offer, 90-day retention |
| `search_query_log` | growing | every search query + country + surface + result_count + clicked_through |
| `outbound_clicks` | growing | deal_id + query + position + mode + clicked_at |
| `price_alerts` | growing | email + product_id (or query) + target_ngn + country — **pure intent signal** |
| `newsletter_subscribers` | growing | email + country + source — engagement signal |
| `ingestion_runs` | growing | per-provider scrape telemetry |

## Reports we could sell TODAY (with what's there)

### A. Cross-store price intelligence (Profitero / DataWeave analog)
**Buyers**: brands monitoring how stores discount their SKUs; retailers benchmarking competitors.
**Data we have**: `offer_price_history` × 90 days × all our markets.
**Reports**:
- Per SKU: price distribution across stores, discount intensity over time, time-to-restock.
- Per brand: where is brand X discounted hardest? Which retailer is the price-leader in country Z?
- Per category: median discount and standard deviation across the catalog.

### B. Search-demand reports (Google Trends but commerce-specific)
**Buyers**: retailers planning assortment; brands planning launches.
**Data we have**: `search_query_log` with country + date + result_count.
**Reports**:
- Top queries per country per week + WoW growth.
- Zero-result queries — direct catalog-gap signal to retailers.
- Brand share of voice in search per category.
- Query velocity for new product launches ("iPhone 17" curve from launch to peak).

### C. Latent-demand reports (the price-alert goldmine)
**Buyers**: brands setting price; retailers thinking about clearance markdowns.
**Data we have**: `price_alerts` — every user-set target price with email + product context.
**Reports**:
- "Across X waiting users, the median target for Brand Y model Z is $W" — pure willingness-to-pay distribution.
- Latent demand by category (volume of alerts per category per week).
- "If you drop SKU X to $Y, you will trigger N price-alert emails to users who have already self-identified as buyers" — direct conversion-trigger product.

## Reports we'd struggle to ship without the gap fixes

### D. Funnel & engagement reports (THIS IS WHERE THE MONEY IS)
**Buyers**: anyone selling on Havlo + their competitors.
**Why blocked**: we track CLICK-OUT events but not PDP VIEW events. So we can answer "which products were clicked through?" but not "which products were viewed but not clicked?" — the latter is the more valuable signal because it identifies products with high awareness but weak conversion.

**What we'd need**: PDP view events with `session_id` (anonymous cookie), `product_id`, `source` (Google / organic-search / from-deals / from-similar-rail / from-compare), `country`, `viewed_at`. Plus referrer / search query when origin is internal.

### E. Stockout & supply-chain reports
**Buyers**: brands monitoring distribution; retailers benchmarking inventory.
**Why blocked**: `offers.in_stock` is a current-state column; the previous value is overwritten silently. No time series of when product X went out of stock at store Y, or how often it churns.

**What we'd need**: an `inventory_state_transitions` table that logs every `in_stock` flip with `from_state`, `to_state`, `offer_id`, `product_id`, `store_id`, `at`.

---

## Code-level data-tap changes I'm shipping today

### 1. PDP view event capture
A fire-and-forget POST from the PDP page server-rendered shell. Logs `session_id` (anonymous, cookie-set on first visit), `country`, `product_id`, `offer_id`, `source` (referrer-derived: `google`, `direct`, `internal-deals`, `internal-compare`, `internal-similar`, `internal-blog`, `other`), `viewed_at`.

Anonymous + non-PII so it stays GDPR-safe with no consent prompt. The session_id is a UUID stored in a `havlo_anon_session` cookie with a 30-day rolling expiry, hashed before storage so it can't be reversed to track identity.

### 2. Stockout transition log
Postgres trigger on `offers` AFTER UPDATE OF in_stock — when the value flips, log a row to `inventory_state_transitions` with `from_state`, `to_state`, the offer/product/store ids, and timestamp. Single-row write per flip; negligible cost; retains a complete time series.

### 3. Click attribution: add `source` field to outbound_clicks
The existing logger captures `query`, `position`, `mode` — but not which SURFACE the click happened on. Add a `source` field (`pdp-hero`, `deals-card`, `similar-rail`, `compare-row`, etc.) so reports can split conversion rate by surface.

### 4. Aggregation rollup table for B2B query performance
A `b2b_daily_rollups` materialized view refreshed nightly that pre-aggregates per (country, category, brand, day):
- PDP view count
- Click-through count
- Conversion rate (CTR)
- Median price + discount in catalog
- New-stockout count
- New price-alert count

When a buyer requests a report, the API reads this table instead of scanning the raw event tables. Keeps query cost flat regardless of how rich the underlying log gets.

### 5. CSV export endpoint scaffold
`/api/b2b/export` (auth-gated to a service-account API key) that streams a CSV of the requested rollup. Doesn't build the product but proves the delivery path.

---

## What I'm NOT shipping today (deliberate non-decisions)

- **Customer-facing dashboard** — too early. First we need 3-6 months of view-event accumulation, plus a real sales conversation with a target buyer to validate which report shape they'd pay for.
- **Public B2B website** — same reason. Once a paying customer is interested, the dashboard + sales site is a 2-3 week build.
- **PII collection** — keep everything anonymous + GDPR-safe by construction. No tying view events to email addresses, no IP-level targeting.

---

## Suggested 6-month roadmap

1. **Month 0–1 (NOW)**: ship the data-tap changes above. Start accumulating event history.
2. **Month 2**: build the b2b_daily_rollups query layer. Generate the first reports internally so we can SEE what the data looks like.
3. **Month 3**: produce one PDF report per category as a sales artifact (e.g. "Nigeria Smartphone Pricing Q3 2026 — what 47 stores are charging for the Samsung Galaxy A06"). Take it to 5 NG retailers.
4. **Month 4**: based on what those 5 conversations reveal, lock the first paying report shape.
5. **Month 5**: build the static delivery (PDF / CSV monthly subscription).
6. **Month 6**: live dashboard with API access for the higher-tier subscription.

Pricing benchmark: DataWeave / Profitero charge $20k–$200k/year per brand client. Havlo's regional / emerging-market focus differentiates — there's no incumbent doing this for NG / IN / AE specifically. Even at $5k/year per client × 10 clients = $50k ARR while we're getting started.
