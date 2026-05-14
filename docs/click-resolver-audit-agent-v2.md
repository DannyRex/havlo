# Click Resolver Audit — Agent Prompt v2

> This supersedes `click-resolver-audit-agent.md` (v1). v1 asked the
> agent to record final destinations manually. v2 leverages the
> `click_resolutions` telemetry table (migration 0021) so the agent
> only needs to **trigger** clicks across diverse stores — engineering
> reads the table afterwards to see exactly what each redirect did.

Paste the section below into Claude (with browser access), Claude in
Chrome, or any AI agent that can drive a real browser.

---

## Agent prompt (copy from here)

You are a QA agent stress-testing Havlo's outbound click resolver
(https://havlo.io). Your job is to trigger outbound clicks across as
many different merchant stores as possible in three markets (NG / UK /
US) so the engineering team can review the resulting telemetry rows in
the `click_resolutions` table.

You do **not** need to record where each click lands. The `/api/go`
route writes one row per redirect to `click_resolutions` with the full
input (store_id, store_name, title_hint, original_url) and output
(resolved_url, resolution_step). Your only job is to fire enough
diverse clicks that engineering can query the table and see patterns.

### Coverage target

At least **20 distinct stores per market** (NG / UK / US), **3 clicks
per store**. Aim for 60-80 total clicks per market, 180-240 across all
three markets.

The priority store lists below are derived from a recent catalog
audit. If a store is not visible in /deals when you visit, skip it
and pick the next one.

#### NG priority stores (target all 8)

```
konga         healthplus     ajebomarket    supermart
threechub     medplus        bitmarte       slot
```

#### UK priority stores (target ≥ 20)

```
asos          currys         amazon uk      argos
john lewis    very           jd sports      halfords
qvc uk        selfridges     sports direct  ao.com
dunelm        debenhams      marks elec     b&q
the range     next           boots          smyths
matalan       waitrose       iceland        screwfix
```

#### US priority stores (target ≥ 20)

```
best buy      macy's         walmart        dick's sporting
fashion nova  adidas         ebay           target
kohl's        home depot     old navy       nike
gamestop      nordstrom      ulta beauty    staples
wayfair       sephora        newegg         qvc
```

### Procedure per market

For each of the three markets:

1. Open https://havlo.io in incognito / private mode.

2. Use the country picker (top-right flag) to switch markets between
   rounds.

3. Visit https://havlo.io/{market}/deals (where {market} is `ng`,
   `uk`, or `us`).

4. The default tab is "Local stores." Stay on it for the first half
   of clicks. Switch to "International" for the second half so the
   stores roster includes cross-border options too (AliExpress,
   Shein, Temu, DHgate, etc.).

5. Scroll the deal grid. The store name appears as a chip on each
   card. Find a card whose store badge matches an entry in the
   priority list above.

6. Click the card → land on the Havlo PDP. Click the primary
   "View at {Merchant}" button. The new tab opens; let it settle.
   You don't need to do anything with the destination tab — telemetry
   already captured the click.

7. Close the destination tab. Return to /{market}/deals (back button
   or relink).

8. Repeat for the next priority store on the list. Aim for 3 distinct
   clicks per store before moving on (different cards from the same
   merchant — gives us multiple data points per store).

9. After completing 20+ stores in the market, move to the next
   market.

### Constraints

- **Do NOT log in** to any merchant site. If a merchant redirects to
  a login wall, just close the tab.
- **Do NOT add anything to a cart** or submit any forms.
- **Do NOT enter any personal information** on merchant sites.
- **Do NOT click multiple times on the same card.** One PDP click +
  one merchant click per card. Repeats inflate the telemetry without
  adding signal.
- **Wait ~2-3 seconds** between merchant clicks to let each telemetry
  row write before firing the next.
- **Skip cards whose CTA is "Compare prices across stores"** instead
  of "View at {Merchant}" — those are PDPs without a clickable
  outbound and won't produce a telemetry row.

### What to report back

After completing all three markets, reply with a short summary in
this exact format:

```
## Summary

- NG clicks fired: <N> across <M> distinct stores
- UK clicks fired: <N> across <M> distinct stores
- US clicks fired: <N> across <M> distinct stores
- Total clicks: <N>

### Stores attempted but not found in /deals

NG: <list any priority stores that had no cards visible during the run>
UK: <same>
US: <same>

### Anomalies noticed while clicking

<one-line notes on anything that looked wrong from the user's perspective —
e.g. "All Fashion Nova clicks open a Google search page instead of
fashionnova.com," "Argos clicks went to a Currys product page,"
"JD Sports redirect took >10 seconds.">
```

That's it. Don't try to debug or fix anything. Don't open dev tools
or inspect networking. Just trigger the clicks, note any wrong-looking
destinations briefly, and report counts.

---

## What this enables (engineering side)

After the agent finishes, run these queries against Supabase:

### Query 1: Did we cover the 20 stores per market?

```sql
SELECT
  country,
  COUNT(DISTINCT store_id) AS distinct_stores,
  COUNT(*)                  AS total_clicks
FROM click_resolutions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND country IN ('ng', 'uk', 'us')
GROUP BY country
ORDER BY country;
```

### Query 2: Per-store breakdown of which fallback branch fired

Shows, for every store the agent clicked, how many redirects hit
each branch of the resolver. A healthy store sits at `passthrough` or
`serpapi_resolved`. Stores stuck at `merchant_search` or
`smart_fallback` are giving users a less precise destination than
they should. `havlo_compare` or `havlo_deals` means we couldn't
resolve at all.

```sql
SELECT
  country,
  store_id,
  store_name,
  COUNT(*) AS clicks,
  SUM(CASE WHEN resolution_step = 'passthrough'        THEN 1 ELSE 0 END) AS passthrough,
  SUM(CASE WHEN resolution_step = 'serpapi_resolved'   THEN 1 ELSE 0 END) AS serpapi,
  SUM(CASE WHEN resolution_step = 'cache_hit'          THEN 1 ELSE 0 END) AS cache_hit,
  SUM(CASE WHEN resolution_step = 'merchant_search'    THEN 1 ELSE 0 END) AS merchant_search,
  SUM(CASE WHEN resolution_step = 'smart_fallback'     THEN 1 ELSE 0 END) AS smart_fallback,
  SUM(CASE WHEN resolution_step = 'merchant_homepage'  THEN 1 ELSE 0 END) AS homepage,
  SUM(CASE WHEN resolution_step = 'havlo_compare'      THEN 1 ELSE 0 END) AS havlo_compare,
  SUM(CASE WHEN resolution_step = 'havlo_deals'        THEN 1 ELSE 0 END) AS havlo_deals
FROM click_resolutions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND country IN ('ng', 'uk', 'us')
GROUP BY country, store_id, store_name
ORDER BY country, clicks DESC;
```

### Query 3: Inspect the wrong-destination cases

For each click that ended at a non-passthrough, non-serpapi step,
look at the inputs that produced the wrong resolution. Pattern in
the original_url + store_id is what tells us whether the issue is:

- **Stale curated entry** — original_url already a merchant URL but
  resolver still fell back (means our domain match failed)
- **Stale SerpAPI relay** — Google relay we couldn't resolve via
  SerpAPI (relay expired or product_id missing)
- **Missing curated entry** — store has no row in
  `merchant-search-urls.ts` → smart_fallback or compare bounce

```sql
SELECT
  country,
  store_id,
  store_name,
  title_hint,
  resolution_step,
  serpapi_attempted,
  serpapi_resolved,
  -- Trim long URLs for readability
  LEFT(original_url, 120) AS original_url_truncated,
  LEFT(resolved_url, 120) AS resolved_url_truncated,
  created_at
FROM click_resolutions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND resolution_step IN (
    'merchant_search', 'smart_fallback', 'merchant_homepage',
    'havlo_compare', 'havlo_deals'
  )
ORDER BY country, store_id, created_at DESC;
```

### Query 4: Specific "wrong outbound" suspicions

The Fashion Nova US case from the retest report:

```sql
SELECT
  store_id,
  store_name,
  title_hint,
  resolution_step,
  serpapi_attempted,
  serpapi_resolved,
  LEFT(original_url, 180) AS original_url,
  LEFT(resolved_url, 180) AS resolved_url,
  referer,
  created_at
FROM click_resolutions
WHERE store_id ILIKE '%fashion%'
   OR store_name ILIKE '%fashion%nova%'
ORDER BY created_at DESC
LIMIT 20;
```

## Running the audit

```bash
# 1. Trigger the agent (paste prompt into Claude in Chrome / similar).
#    Agent runs for 30-60 min, fires 180-240 clicks across 3 markets.

# 2. After agent finishes, run Query 1 to verify coverage.

# 3. Run Query 2 to find stores that aren't routing cleanly.

# 4. Run Query 3 to inspect the wrong-resolution rows in detail.

# 5. Fix the top 5 worst-performing stores: update
#    merchant-search-urls.ts entries, tighten storeId matching, etc.

# 6. Re-run the agent on just those stores to verify the fix took.
```

## Why this beats v1

- v1: agent recorded final URLs manually → noisy, miss-prone, slow
- v2: agent only triggers clicks → faster, no transcription errors
- v2: engineering queries telemetry → full context per click
  (resolution_step, serpapi_attempted, original_url) that the agent
  can't see from the browser
