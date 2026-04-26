# Havlo — Forward Roadmap

A staged plan from "production-ready MVP" to "competitive product."
Each phase is independent — pick what to ship next based on signal.

---

## ▸ PHASE 7 — Production hardening

> **Goal**: a deployed site you can confidently send people to.
> **Effort**: ~half a day total

### 7a · GitHub Actions cron *(20 min)*

- Single workflow at `.github/workflows/refresh-data.yml`
- Schedule: daily 04:00 UTC (~05:00 Lagos)
- Sequence per run:
  1. `npm run scrape` (Playwright → updates `deals.ts`)
  2. `npm run ingest:scraped` (deals.ts → DB)
  3. `npm run ingest` (SerpAPI 6 countries × 10 categories → DB)
- Env vars pulled from GitHub repo secrets
- `workflow_dispatch` trigger so you can run manually from the Actions tab
- **Cost**: free on public repos / well within Hobby quota on private; ~60 SerpAPI credits/day = ~$27/mo on the Developer tier

### 7b · Production smoke-test pass *(you, 30 min)*

After Phase 7a's first cron run completes:
- Re-run the comprehensive test prompt against `dealesty.vercel.app` (or `havlo.io` once 8a lands)
- Generate fresh report
- I fix anything that's still broken

### 7c · Real OG / social share images *(30 min)*

- Next.js 14 `opengraph-image.tsx` files in:
  - `src/app/opengraph-image.tsx` → homepage
  - `src/app/deals/opengraph-image.tsx` → "Deals" branded card
  - `src/app/compare/opengraph-image.tsx` → "Find for less"
- Auto-generated 1200×630 PNGs at build time using Next's `ImageResponse` API
- Brand-consistent: havlo wordmark, dark zinc-950 panel, the "Find similar products for less" tagline
- Twitter card metadata aligned

### 7d · Performance pass *(1 hour)*

- Run Lighthouse against prod
- Pick off easy wins:
  - `priority` flag on hero images (LCP candidate)
  - `next/font` preload on Inter
  - Audit bundle size with `@next/bundle-analyzer`
  - Image sizing hints
- Target: Performance ≥ 90 desktop, ≥ 70 mobile

---

## ▸ PHASE 8 — Brand & domain

> **Goal**: havlo.io live, branded properly.
> **Effort**: 2-3 days, half mine half yours

### 8a · Domain hookup *(you, ~30 min)*

- Point `havlo.io` at Vercel
- Add to Vercel project domains, configure DNS A/CNAME records
- Wait for SSL cert provisioning (auto)

### 8b · Canonical URLs sweep *(15 min, mine)*

- Update `metadataBase` in `app/layout.tsx` from `havlo.io` placeholder to actual production URL
- Update `sitemap.ts` SITE constant
- Update `robots.ts` host field
- Verify all `og:url` use the new domain

### 8c · Contact path *(20 min, mine)*

- Build a tiny `app/contact/page.tsx` — clean form posting to a `formspree.io` or `loops.so` endpoint (free tier)
- Update Footer's `mailto:hello@havlo.io` link (which doesn't yet have a mailbox) to point at the contact page instead
- Add `/contact` to sitemap + nav

### 8d · Email setup *(you, 15 min)*

- Set up `hello@havlo.io` mailbox (Cloudflare Email Routing → free forward to your gmail; or Google Workspace if you want proper IMAP)
- Verify the contact-form recipient

---

## ▸ PHASE 9 — Free data sources

> **Goal**: replace SerpAPI calls with free affiliate feeds → cost goes down, NG coverage goes up.
> **Effort**: ongoing as approvals land

### 9a · Konga affiliate provider *(~half day mine, after their approval lands)*

- Apply at konga.com/affiliates (you, 5 min)
- Once approved: build `src/lib/providers/browse-konga.ts` against their product feed API
- Register in provider registry; runs alongside SerpAPI in `npm run ingest`
- NG-specific catalog flows in for free

### 9b · AliExpress affiliate provider *(~half day mine, after approval)*

- AliExpress Affiliate Portal (you, 10 min — usually approved within 24h)
- Build `src/lib/providers/search-aliexpress.ts`
- Massive catalog of cross-border products at typically 50-90% off Western prices — perfect for "find for less"
- Free with affiliate account

### 9c · Amazon PAAPI v5 *(~1 day mine, requires Associates approval)*

- You: Amazon Associates account (NG/US/UK depending on which marketplace you want first)
- **⚠️ Note**: Associates needs 3 qualifying sales within 180 days or it's revoked — only do this when you have meaningful traffic
- Build PAAPI provider with HMAC-SHA256 request signing
- 8.6k req/day baseline = effectively free at our volume
- Replaces SerpAPI for Amazon-specific queries

### 9d · ScraperAPI fallback *(optional, ~1 hour)*

- For SERP queries Amazon doesn't cover and Konga isn't in
- Cheaper than SerpAPI for Amazon but similar for Google ($12-15/k)
- Only add if SerpAPI cost becomes painful

---

## ▸ PHASE 10 — Engagement features

> **Goal**: turn one-time visitors into recurring users.
> **Effort**: weeks of work

### 10a · Country selector *(~3 days mine)*

- Cookie-based country preference (NG default, can switch to UK / US / KE / GH / etc.)
- `useCountry()` hook + `<CountryProvider>`
- Localized currency display (NGN/USD/GBP based on country)
- Filter `/deals` ingest queries per country
- Country-specific homepage trending picks
- The "global mindset" you flagged at the start

### 10b · User accounts *(~1 week mine)*

- Supabase Auth — email magic-link only (no passwords, no Google/Apple OAuth complexity yet)
- `users` table linked to Supabase `auth.users`
- "Sign in to save" CTA on dupe cards
- Profile route for managing account

### 10c · Saved products + price tracking *(~3 days, depends on 10b)*

- `saved_products` table: user_id ↔ product_id
- Heart icon on every card (currently visual-only)
- Email digest: "3 products you saved went on sale this week"
- Triggered weekly via cron

### 10d · Browser extension *(~2 weeks mine, biggest UX bet)*

- Manifest V3 extension for Chrome + Firefox + Edge
- When user is on Jumia/Konga/Amazon/ASOS product page → Havlo icon shows alt-count + click → opens `/compare?url=current_page`
- Highest-leverage acquisition surface — captures intent at the exact moment people are about to buy
- Use the existing `/api/sniff` endpoint internally

### 10e · Click + conversion analytics *(~half day mine)*

- Real `clicks` / `saves` tracking on offers (currently hardcoded in `STORE_META`)
- Per-store click-through dashboard
- Identifies which retailers actually convert → informs which affiliate programs are worth applying for

---

## ▸ PHASE 11 — Growth & monetization

> **Goal**: revenue + sustainable user acquisition.
> **Effort**: kicks off once Phase 10 is shipping signal.

### 11a · Affiliate revenue layer

- Wire affiliate IDs into outbound URLs (`?tag=havlo-21` for Amazon, etc.)
- Click-attribution tracking
- Real revenue dashboard

### 11b · Newsletter / email digest infrastructure

- Resend / Loops / Postmark for transactional + marketing
- Weekly "biggest deals across stores" email
- Account-triggered "your saved product is on sale" notifications

### 11c · SEO content engine

- Auto-generated landing pages per category × country (e.g. `/deals/phones/ng`, `/compare/iphone-15-pro`)
- Long-tail keywords drive organic traffic
- Each page server-rendered with real data from the DB

### 11d · Display ads as bridge revenue

- AdSense or Mediavine until affiliate revenue dominates
- Header bidding once you have meaningful traffic

---

## Recommended next 4 weeks

| Week | Theme | Deliverables |
|------|-------|--------------|
| **1** | Production-ready | Phase 7 (cron, OG, perf) + Phase 8 (havlo.io live) |
| **2** | Real data | Phase 9a (Konga) + 9b (AliExpress affiliate) |
| **3** | Globalize | Phase 10a (country selector) |
| **4** | Engagement foundation | Phase 10b (auth) + 10c (saved products MVP) |

That gets you from "demo deployed" to "real users can sign in, save products from multiple Nigerian + global retailers, with localized pricing" in a month. Browser extension (10d) and affiliate revenue (11a) come after that as growth bets.

---

## Where to start

**My vote: 7a — GitHub Actions cron.**

It's quick, ships independently, and means tomorrow morning your DB is fresh whether you remember to run anything or not. Then you do the smoke test (7b), and we move down the list.
