# Google Search Console audit prompt — Havlo (havlo.io)

Drop this into an AI agent with **Google Search Console access** for `havlo.io` (verified property). The agent should work through it section by section and produce a prioritised report. Estimated time: 90–120 minutes once GSC + a crawl-emulation tool are available.

---

## Context for the agent

You are auditing **havlo.io**, an independent price-comparison platform live in six markets:

- 🇳🇬 Nigeria (primary market, `/ng/`)
- 🇬🇧 United Kingdom (`/uk/`, hreflang `en-GB`)
- 🇺🇸 United States (`/us/`)
- 🇮🇳 India (`/in/`)
- 🇦🇪 United Arab Emirates (`/ae/`)
- 🇿🇦 South Africa (`/za/`)

**Stack**: Next.js 14 App Router on Vercel, Supabase backend. Approx. 14,800 product PDPs, daily-ish ingestion.

**Recent SEO code work shipped** (so you can validate them as live):
- Sitemap now includes ~14,800 product PDPs under `/ng/p/{offer_id}` with hreflang alternates
- PDP JSON-LD enriched with `description`, `sku`, `productID`, `mainEntityOfPage`, `priceValidUntil`, `dateModified`, plus `AggregateOffer` (lowPrice/highPrice/offerCount) when multi-store
- Organization JSON-LD logo is now `/icon.png` 512x512 via `ImageObject`
- WebSite `SearchAction` `urlTemplate` now points at `https://havlo.io/ng/deals?search={search_term_string}&origin=all`
- ItemList JSON-LD uses real product brand (not store name)

Validate each of those against live `view-source:` output before reporting them as broken.

---

## Audit checklist

### 1. Coverage & indexation

In **GSC > Indexing > Pages**:

- [ ] Total indexed URL count vs total submitted (compute submitted from `https://havlo.io/sitemap.xml`)
- [ ] List the top 10 reasons in "Not indexed" (Crawled - currently not indexed / Discovered - currently not indexed / Duplicate canonical / Soft 404 / Redirect error / Page with redirect / etc.)
- [ ] For each reason, sample 5 URLs and triage:
  - If they're real pages that should be indexed → flag the root cause (canonical conflict? thin content? missing internal links? blocked by robots?)
  - If they're noise (orphaned offer IDs, stale `/p/{id}` redirects, etc.) → confirm robots/redirect already excludes them
- [ ] Specifically check **how many `/ng/p/{offer_id}` URLs are indexed** vs submitted. The sitemap update went live in the latest deploy; you may need to wait ~24h for re-crawl, but you can spot-check via `site:havlo.io/ng/p/` query
- [ ] Verify hreflang clusters — pick 5 random products. For each, confirm GSC's "International Targeting > Languages" section shows the right set of `en-NG / en-GB / en-US / en-IN / en-AE / en-ZA / x-default` with no "Hreflang return tag errors"

### 2. Rich Results

In **GSC > Enhancements**:

- [ ] **Products** — count of valid + invalid + warnings. For each warning class:
  - Sample 3 URLs
  - Run the live URL through Google's Rich Results Test (richresults.com/test)
  - Common warnings to triage: missing `aggregateRating`, missing `review`, missing `gtin/mpn`, `priceValidUntil` in the past, `availability` enum mismatch
- [ ] **Breadcrumb** — same per warning class
- [ ] **Sitelinks search box** — confirm the `SearchAction` is recognised on the homepage (`havlo.io/`). The Rich Results Test should report "Sitelinks search box: Eligible"
- [ ] **Organization / Logo** — Knowledge Graph status. The new `/icon.png` should resolve as the brand logo
- [ ] Find any Rich Results categories Havlo is NOT yet emitting that would unlock SERP real estate for our product type:
  - `FAQPage` on `/about`, `/for-merchants`, `/how-we-make-money`
  - `Article` / `BlogPosting` on `/[country]/blog/{slug}` (verify structured data is present)
  - `OfferCatalog` on `/[country]/deals` for the listing page
  - `ImageObject` markup on PDP hero images for image search visibility

### 3. Performance — Core Web Vitals

In **GSC > Experience > Core Web Vitals**:

- [ ] Mobile & Desktop URLs by status (Good / Needs improvement / Poor)
- [ ] Top URLs in "Needs improvement" or "Poor" — identify whether the bottleneck is LCP, CLS, or INP
- [ ] For PDP pages specifically, check the **LCP element**. We know images use raw `<img>` (not `next/image`) because of Vercel's image transform free-tier cap. If LCP is the hero image, prioritise:
  - Self-hosted image optimiser via Cloudflare/Bunny (so we can keep using `next/image`)
  - OR explicit `width`/`height` attributes + `loading="eager"` + `fetchpriority="high"` on hero images
- [ ] Cross-reference with PageSpeed Insights for 5 sample URLs (1 homepage, 2 PDPs, 1 deals, 1 compare)

### 4. Mobile usability

In **GSC > Experience > Mobile Usability** (when GSC re-enables this report) OR via the PageSpeed Insights mobile tab:

- [ ] Content wider than screen
- [ ] Clickable elements too close together
- [ ] Text too small to read

Code-level mobile responsiveness was verified at 375x812 viewport during the May 28-29 work. Confirm against live mobile-emulated PSI runs.

### 5. Search performance (queries + clicks)

In **GSC > Performance > Search results**:

- [ ] Last 3 months — total clicks, impressions, CTR, average position
- [ ] **Top 50 queries by impressions** — for each:
  - Does the landing page actually answer the query?
  - Is CTR below the position-expected CTR curve (sub-1% for pos 1-3 = something's wrong with title/snippet)?
  - Is position fluctuating > 5 places? (Volatility signal)
- [ ] **Top 50 pages by impressions** — for each:
  - Is the canonical right? (Spot-check with `view-source:` of each)
  - Is the title/description in current copy what GSC shows?
- [ ] **Queries with high impressions + zero clicks** — title/description rewrite candidates
- [ ] **Pages getting indexed but no impressions** — content quality / topical signals weak
- [ ] **Branded vs non-branded split** — branded ("havlo") should be growing; non-branded growth is the real SEO win

### 6. Backlinks & domain authority

In **GSC > Links**:

- [ ] Top linking sites (external)
- [ ] Top linked pages
- [ ] Top linking text
- [ ] Internal linking — pages getting fewer than 3 internal links are crawl-priority orphans. Sample 20 PDPs and audit
- [ ] Identify the highest-priority pages that have ZERO external backlinks — these are PR / outreach targets

### 7. Security & manual actions

- [ ] **GSC > Security & Manual actions** — confirm zero issues
- [ ] **GSC > Legacy tools and reports** — anything orange/red?

### 8. International targeting

- [ ] **GSC > Legacy tools > International Targeting** — confirm hreflang clusters validate, no return-tag errors
- [ ] Test each country variant for query-language match (e.g. NG users searching in English see /ng/ results, not /us/)

### 9. URL inspection

For the following high-priority URLs, run the **URL Inspection tool** and report each result:

- `https://havlo.io/`
- `https://havlo.io/ng`
- `https://havlo.io/uk/deals`
- `https://havlo.io/ng/p/5d69e490-8dd1-409d-a303-77b24f4cb227` (the canonical PDP we test against)
- `https://havlo.io/about`
- `https://havlo.io/for-merchants`
- `https://havlo.io/ng/compare`
- `https://havlo.io/scan`
- `https://havlo.io/ng/blog`
- `https://havlo.io/sitemap.xml` (verify it serves + product entries present + last-modified looks fresh)

For each:
- Indexability state (Indexed / Not indexed / Discovered / Crawled)
- Canonical Google chose vs the canonical we declared
- Mobile/desktop usability flags
- Rich results detected

### 10. Robots & sitemap

- [ ] Fetch `https://havlo.io/robots.txt`. Confirm:
  - `Sitemap:` directive points at `/sitemap.xml`
  - No accidental `Disallow: /` or broad path exclusions
  - User-agent groups for Googlebot, Bingbot, GPTBot, ClaudeBot are sensible
- [ ] Fetch `https://havlo.io/sitemap.xml`. Confirm:
  - All six country homepages emit hreflang alternates
  - Product PDPs are present (post-May 29 deploy)
  - lastModified timestamps look fresh
  - Total URL count < 50,000 (per-file cap; if approaching, time to split via `generateSitemaps()`)

### 11. AI agent crawl / GEO

A new lever in 2026: large LLM crawlers (GPTBot, ClaudeBot, Perplexity, Google-Extended) are indexing the web for AI answer surfaces. Confirm:

- [ ] **robots.txt** explicitly allows the crawlers we want to surface in (GPTBot, ClaudeBot at minimum; Perplexity if their bot ID is published)
- [ ] **llms.txt** at the root — does Havlo have one? If not, recommend creating one with the key product / about / pricing / API docs the LLM crawlers should consume preferentially

---

## Deliverable shape

Produce a single Markdown report with these sections, in this order:

1. **Critical (ship today)** — anything actively suppressing indexation: broken canonical, sitemap missing, Rich Results errors flagged on > 1% of URLs, hreflang return-tag errors
2. **High (ship this week)** — items affecting CTR or position: title/description rewrites for high-impression-low-CTR queries, missing structured data for our content type, mobile usability issues
3. **Medium (this month)** — opportunity-cost items: backlink targets, internal-link orphans, performance budget improvements
4. **Watch list** — metrics to track over the next 30 days, baseline numbers documented

For each item: include the **specific URLs affected**, the **GSC report section** where you found it, the **suggested fix** (code-level patch shape preferred when applicable), and an **estimated impact** (e.g. "≈ 4% of total impressions" or "blocks indexation of 12k PDPs").

End with the **30-day re-audit calendar entry** so it gets re-run.

---

## What you SHOULDN'T spend time on

These are already handled at the code level (verified May 29 2026) — skip unless GSC flags them anew:

- Sitemap structure / hreflang generation (`src/app/sitemap.ts`, `src/lib/seo.ts`)
- Per-page metadata exports (every route has `export const metadata` or `generateMetadata`)
- PDP product JSON-LD (enriched in deploy `4b632aa`)
- Canonical URL declarations
- Country routing / hreflang on PDPs
- Search relevance on /deals (separately fixed in `c80f5f2` — wait 7 days for query-impression re-baseline before reporting)
- Console errors (zero on tested surfaces as of May 29 2026)
